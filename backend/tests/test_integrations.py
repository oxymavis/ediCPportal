from __future__ import annotations

from uuid import uuid4

from app.db.session import SessionLocal
from app.models import Transaction, TransactionSystemEvent


def _transaction_push(
    *,
    idempotency_key: str,
    doc_type: str = '850',
    direction: str = 'inbound',
    status: str = 'received',
    raw_content: str = 'ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *260608*1200*U*00401*000000001*0*T*>~',
    refs: dict | None = None,
):
    return {
        'idempotencyKey': idempotency_key,
        'sourceSystem': 'edi',
        'environment': 'production',
        'partner': 'Walmart',
        'docType': doc_type,
        'direction': direction,
        'status': status,
        'occurredAt': '2026-06-08T10:00:00Z',
        'businessRefs': refs or {},
        'controlRefs': {'isaControlNo': f'ISA-{idempotency_key[-6:]}'},
        'externalEventId': f'ext-{idempotency_key}',
        'payloadFormat': 'x12',
        'rawContent': raw_content,
        'rawPayload': {'senderId': 'SENDER', 'receiverId': 'RECEIVER', 'records': 1},
    }


def _system_event(
    *,
    idempotency_key: str,
    system: str,
    stage: str,
    event_type: str,
    status: str,
    input_data=None,
    output_data=None,
    errors: list | None = None,
    attempt_no: int = 1,
    is_final: bool = False,
):
    return {
        'idempotencyKey': idempotency_key,
        'system': system,
        'stage': stage,
        'eventType': event_type,
        'status': status,
        'occurredAt': '2026-06-08T10:05:00Z',
        'message': f'{system} {stage} {status}',
        'inputFormat': 'json' if input_data is not None else None,
        'inputData': input_data,
        'outputFormat': 'json' if output_data is not None else None,
        'outputData': output_data,
        'errors': errors or [],
        'durationMs': 120,
        'traceId': f'trace-{system}-{attempt_no}',
        'attemptNo': attempt_no,
        'isFinal': is_final,
        'metadata': {'service': f'{system}-integration-service'},
    }


def _oauth_token(client, client_id: str, client_secret: str) -> str:
    response = client.post(
        '/v1/oauth/token',
        data={
            'grant_type': 'client_credentials',
            'client_id': client_id,
            'client_secret': client_secret,
        },
    )
    assert response.status_code == 200
    return response.json()['data']['access_token']


def test_transaction_api_key_required(client):
    response = client.post(
        '/v1/integrations/transactions',
        json=_transaction_push(idempotency_key='txn-no-key-abcdefg'),
    )
    assert response.status_code == 401


def test_transaction_push_persists_original_data_and_is_idempotent(client):
    headers = {'x-api-key': 'dev-integration-key'}
    raw = 'ISA*00*...~GS*PO*SENDER*RECEIVER*20260608*1200*1*X*004010~'
    payload = _transaction_push(
        idempotency_key='txn-push-abcdefg',
        raw_content=raw,
        refs={'poNo': 'PO-2001'},
    )

    response = client.post('/v1/integrations/transactions', headers=headers, json=payload)
    replay = client.post('/v1/integrations/transactions', headers=headers, json=payload)

    assert response.status_code == 200
    assert response.json()['data']['idempotent'] is False
    transaction_id = response.json()['data']['transactionId']
    assert replay.json()['data']['transactionId'] == transaction_id
    assert replay.json()['data']['idempotent'] is True

    db = SessionLocal()
    try:
        transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
        assert transaction is not None
        assert transaction.raw == raw
        assert transaction.payload_format == 'x12'
        assert transaction.raw_payload['senderId'] == 'SENDER'
        assert transaction.business_refs['poNo'] == 'PO-2001'
    finally:
        db.close()


def test_transaction_external_event_dedupe(client):
    headers = {'x-api-key': 'dev-integration-key'}
    first = _transaction_push(idempotency_key='txn-ext-a-abcdefg')
    second = _transaction_push(idempotency_key='txn-ext-b-abcdefg')
    second['externalEventId'] = first['externalEventId']

    created = client.post('/v1/integrations/transactions', headers=headers, json=first)
    duplicate = client.post('/v1/integrations/transactions', headers=headers, json=second)

    assert duplicate.json()['data']['transactionId'] == created.json()['data']['transactionId']
    assert duplicate.json()['data']['idempotent'] is True


def test_inbound_system_lifecycle_preserves_each_system_input_and_output(client):
    headers = {'x-api-key': 'dev-integration-key'}
    created = client.post(
        '/v1/integrations/transactions',
        headers=headers,
        json=_transaction_push(idempotency_key='txn-inbound-life-abcdefg', refs={'poNo': 'PO-LIFE-1'}),
    )
    transaction_id = created.json()['data']['transactionId']

    events = [
        _system_event(
            idempotency_key='event-edi-transform-0001',
            system='edi-gateway',
            stage='x12_to_canonical_json',
            event_type='transformation',
            status='completed',
            input_data={'rawReference': transaction_id},
            output_data={'poNo': 'PO-LIFE-1', 'lines': [{'sku': 'SKU-1', 'qty': 2}]},
        ),
        _system_event(
            idempotency_key='event-oms-create-0001',
            system='oms',
            stage='create_sales_order',
            event_type='processing',
            status='completed',
            input_data={'poNo': 'PO-LIFE-1', 'lines': [{'sku': 'SKU-1', 'qty': 2}]},
            output_data={'orderNo': 'SO-1001', 'status': 'CREATED'},
        ),
        _system_event(
            idempotency_key='event-wms-create-0001',
            system='wms',
            stage='create_warehouse_order',
            event_type='processing',
            status='completed',
            input_data={'orderNo': 'SO-1001'},
            output_data={'warehouseOrderNo': 'WO-1001', 'status': 'ACCEPTED'},
            is_final=True,
        ),
    ]
    for event in events:
        response = client.post(
            f'/v1/integrations/transactions/{transaction_id}/system-events',
            headers=headers,
            json=event,
        )
        assert response.status_code == 200

    timeline = client.get(
        f'/v1/integrations/transactions/{transaction_id}/timeline',
        headers=headers,
    )
    data = timeline.json()['data']
    assert data['transaction']['status'] == 'completed'
    assert data['transaction']['rawContent'].startswith('ISA')
    assert [event['system'] for event in data['events']] == ['edi-gateway', 'oms', 'wms']
    assert data['events'][0]['output']['data']['poNo'] == 'PO-LIFE-1'
    assert data['events'][1]['output']['data']['orderNo'] == 'SO-1001'
    assert data['events'][2]['output']['data']['warehouseOrderNo'] == 'WO-1001'


def test_system_event_failure_records_structured_error_and_retry(client):
    headers = {'x-api-key': 'dev-integration-key'}
    created = client.post(
        '/v1/integrations/transactions',
        headers=headers,
        json=_transaction_push(
            idempotency_key='txn-outbound-error-abcdefg',
            direction='outbound',
            doc_type='945',
        ),
    )
    transaction_id = created.json()['data']['transactionId']
    failed_event = _system_event(
        idempotency_key='event-wms-failed-0001',
        system='wms',
        stage='load_shipment_confirmation',
        event_type='validation',
        status='failed',
        input_data={'warehouseOrderNo': ''},
        errors=[
            {
                'code': 'WMS_REQUIRED_FIELD',
                'message': 'warehouseOrderNo is required',
                'field': 'warehouseOrderNo',
                'severity': 'error',
                'retryable': True,
                'details': {'source': 'WMS'},
            }
        ],
    )
    failed = client.post(
        f'/v1/integrations/transactions/{transaction_id}/system-events',
        headers=headers,
        json=failed_event,
    )
    replay = client.post(
        f'/v1/integrations/transactions/{transaction_id}/system-events',
        headers=headers,
        json=failed_event,
    )

    assert failed.json()['data']['transactionStatus'] == 'failed'
    assert replay.json()['data']['idempotent'] is True

    retry = _system_event(
        idempotency_key='event-wms-retry-0002',
        system='wms',
        stage='load_shipment_confirmation',
        event_type='validation',
        status='completed',
        input_data={'warehouseOrderNo': 'WO-2001'},
        output_data={'accepted': True},
        attempt_no=2,
        is_final=True,
    )
    retried = client.post(
        f'/v1/integrations/transactions/{transaction_id}/system-events',
        headers=headers,
        json=retry,
    )
    assert retried.json()['data']['transactionStatus'] == 'completed'

    db = SessionLocal()
    try:
        transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
        system_events = (
            db.query(TransactionSystemEvent)
            .filter(TransactionSystemEvent.transaction_id == transaction_id)
            .order_by(TransactionSystemEvent.attempt_no.asc())
            .all()
        )
        assert transaction is not None
        assert transaction.errors[0]['code'] == 'WMS_REQUIRED_FIELD'
        assert transaction.errors[0]['retryable'] is True
        assert len(system_events) == 2
        assert system_events[1].attempt_no == 2
    finally:
        db.close()


def test_system_events_query_and_not_found(client):
    headers = {'x-api-key': 'dev-integration-key'}
    missing = client.get('/v1/integrations/transactions/TRX-MISSING/system-events', headers=headers)
    assert missing.json()['code'] == 'TRX_NOT_FOUND'

    created = client.post(
        '/v1/integrations/transactions',
        headers=headers,
        json=_transaction_push(idempotency_key=f'txn-events-{uuid4().hex[:12]}'),
    )
    transaction_id = created.json()['data']['transactionId']
    response = client.get(
        f'/v1/integrations/transactions/{transaction_id}/system-events',
        headers=headers,
    )
    assert response.json()['data']['eventCount'] == 0


def test_batch_and_legacy_routes_are_not_exposed(client):
    headers = {'x-api-key': 'dev-integration-key'}
    assert client.post('/v1/integrations/transactions/batch', headers=headers, json={'items': []}).status_code == 404
    assert client.get('/v1/integrations/jobs/any-job', headers=headers).status_code == 404
    assert client.post('/v1/integrations/events', headers=headers, json={}).status_code == 404


def test_transaction_push_requires_api_key_even_if_oauth_has_scope(client):
    created = client.post(
        '/v1/oauth/clients',
        headers={'x-admin-key': 'dev-oauth-admin-key'},
        data={'name': 'oauth-int', 'scopes': 'integrations:write integrations:read', 'environment': 'all'},
    )
    token = _oauth_token(client, created.json()['data']['client_id'], created.json()['data']['client_secret'])
    response = client.post(
        '/v1/integrations/transactions',
        headers={'Authorization': f'Bearer {token}'},
        json=_transaction_push(idempotency_key='txn-oauth-deny-abcdefg'),
    )
    assert response.status_code == 401
