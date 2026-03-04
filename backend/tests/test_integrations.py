from __future__ import annotations

from uuid import uuid4


def _auth_user(client):
    email = f'integration-{uuid4().hex[:8]}@example.com'
    r = client.post(
        '/v1/auth/register',
        json={'name': 'Integration User', 'email': email, 'password': 'Password1', 'confirmPassword': 'Password1'},
    )
    assert r.status_code == 200
    assert r.json()['success'] is True


def _event(
    *,
    idempotency_key: str,
    doc_type: str,
    partner: str = 'Walmart',
    env: str = 'production',
    refs: dict | None = None,
    source: str = 'edi',
):
    return {
        'idempotencyKey': idempotency_key,
        'sourceSystem': source,
        'environment': env,
        'partner': partner,
        'docType': doc_type,
        'direction': 'outbound',
        'status': 'completed',
        'occurredAt': '2026-03-03T10:00:00Z',
        'businessRefs': refs or {},
        'controlRefs': {'isaControlNo': f'ISA-{idempotency_key[-6:]}'},
        'rawPayload': {'message': doc_type},
    }


def _oauth_token(client, client_id: str, client_secret: str) -> str:
    res = client.post(
        '/v1/oauth/token',
        data={
            'grant_type': 'client_credentials',
            'client_id': client_id,
            'client_secret': client_secret,
        },
    )
    assert res.status_code == 200
    return res.json()['data']['access_token']


def test_integration_api_key_required(client):
    res = client.post('/v1/integrations/events', json=_event(idempotency_key='k-1-abcdefg', doc_type='850'))
    assert res.status_code == 401


def test_integration_api_key_invalid(client):
    res = client.post(
        '/v1/integrations/events',
        headers={'x-api-key': 'wrong-key'},
        json=_event(idempotency_key='k-2-abcdefg', doc_type='850'),
    )
    assert res.status_code == 401


def test_integration_idempotency_and_related_856_850(client):
    _auth_user(client)
    headers = {'x-api-key': 'dev-integration-key'}
    e850 = _event(idempotency_key='k-850-abcdefg', doc_type='850', refs={'poNo': 'PO-1001'})
    create_850 = client.post('/v1/integrations/events', headers=headers, json=e850)
    assert create_850.status_code == 200
    id850 = create_850.json()['data']['transactionId']

    e856 = _event(idempotency_key='k-856-abcdefg', doc_type='856', refs={'poNo': 'PO-1001'})
    create_856 = client.post('/v1/integrations/events', headers=headers, json=e856)
    assert create_856.status_code == 200
    body_856 = create_856.json()['data']
    assert body_856['linking']['linked'] is True
    assert id850 in body_856['linking']['relatedTransactionIds']
    id856 = body_856['transactionId']

    idem = client.post('/v1/integrations/events', headers=headers, json=e856)
    assert idem.status_code == 200
    assert idem.json()['data']['transactionId'] == id856

    related = client.get(f'/v1/transactions/{id856}/related')
    assert related.status_code == 200
    assert related.json()['success'] is True
    assert any(x['transactionId'] == id850 and x['relationType'] == 'response_to' for x in related.json()['data']['upstream'])


def test_linking_945_940_and_214_204(client):
    _auth_user(client)
    headers = {'x-api-key': 'dev-integration-key'}
    client.post('/v1/integrations/events', headers=headers, json=_event(idempotency_key='k-940-abcdefg', doc_type='940', refs={'warehouseOrderNo': 'WO-1'}))
    r945 = client.post('/v1/integrations/events', headers=headers, json=_event(idempotency_key='k-945-abcdefg', doc_type='945', refs={'warehouseOrderNo': 'WO-1'}))
    assert r945.status_code == 200
    assert r945.json()['data']['linking']['linked'] is True

    client.post('/v1/integrations/events', headers=headers, json=_event(idempotency_key='k-204-abcdefg', doc_type='204', refs={'loadNo': 'LOAD-1'}))
    r214 = client.post('/v1/integrations/events', headers=headers, json=_event(idempotency_key='k-214-abcdefg', doc_type='214', refs={'loadNo': 'LOAD-1'}))
    assert r214.status_code == 200
    assert r214.json()['data']['linking']['linked'] is True


def test_batch_partial_success(client):
    headers = {'x-api-key': 'dev-integration-key'}
    payload = [
        _event(idempotency_key='k-batch-ok-abcdefg', doc_type='850'),
        {'docType': '850'},  # invalid
    ]
    res = client.post('/v1/integrations/events/batch', headers=headers, json=payload)
    assert res.status_code == 200
    data = res.json()['data']
    assert data['total'] == 2
    assert data['successCount'] == 1


def test_integration_oauth_environment_isolation(client):
    create = client.post(
        '/v1/oauth/clients',
        headers={'x-admin-key': 'dev-oauth-admin-key'},
        data={'name': 'sandbox-int', 'scopes': 'integrations:write integrations:read', 'environment': 'sandbox'},
    )
    assert create.status_code == 200
    cid = create.json()['data']['client_id']
    csecret = create.json()['data']['client_secret']
    token = _oauth_token(client, cid, csecret)
    headers = {'Authorization': f'Bearer {token}'}

    ok_res = client.post('/v1/integrations/events', headers=headers, json=_event(idempotency_key='k-sbx-abcdefg', doc_type='850', env='sandbox'))
    assert ok_res.status_code == 200

    deny_res = client.post('/v1/integrations/events', headers=headers, json=_event(idempotency_key='k-prd-abcdefg', doc_type='850', env='production'))
    assert deny_res.status_code == 403
