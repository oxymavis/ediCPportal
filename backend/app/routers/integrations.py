from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Transaction, TransactionLink, TransactionSystemEvent
from app.schemas.common import fail, ok
from app.schemas.integration import TransactionPushRequest, TransactionSystemEventRequest
from app.services.deps import get_actor, require_integration_client, require_scope
from app.services.linking import build_links_for_transaction

router = APIRouter(
    prefix='/v1/integrations',
    tags=['integrations'],
    dependencies=[Depends(get_actor), Depends(require_integration_client), Depends(require_scope('integrations'))],
)


COMPLETED_STATUSES = {'completed', 'complete', 'success', 'succeeded', 'delivered', 'acknowledged', 'done', 'ok'}
PROCESSING_STATUSES = {'processing', 'process', 'in_progress', 'pending', 'queued', 'sent', 'sending', 'validated'}
FAILED_STATUSES = {'failed', 'fail', 'failure', 'error', 'errored', 'rejected', 'cancelled', 'canceled'}


def _standard_status(status_value: str | None) -> str:
    normalized = str(status_value or '').strip().lower().replace('-', '_').replace(' ', '_')
    if normalized in COMPLETED_STATUSES or 'complete' in normalized or 'success' in normalized:
        return 'completed'
    if normalized in PROCESSING_STATUSES or 'process' in normalized or 'pending' in normalized:
        return 'processing'
    if normalized in FAILED_STATUSES or 'fail' in normalized or 'error' in normalized or 'reject' in normalized:
        return 'failed'
    return 'received'


def _require_api_key_actor(actor: dict) -> None:
    if actor.get('kind') != 'api_key':
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='API key credentials are required')


def _push_to_transaction(payload: TransactionPushRequest) -> Transaction:
    raw_payload = dict(payload.rawPayload or {})
    raw_payload.setdefault('externalStatus', payload.status)
    integration_type = raw_payload.get('integrationType') or ('edi' if payload.sourceSystem == 'edi' else 'api')
    channel = raw_payload.get('channel') or ('AS2' if integration_type == 'edi' else 'REST_API')
    control = payload.controlRefs
    size_kb = max(len(payload.rawContent.encode('utf-8')) / 1024, 0.1)
    return Transaction(
        id=f'TRX-{payload.docType}-{uuid4().hex[:10]}',
        type=payload.docType,
        doc_type=payload.docType,
        type_name=f'Document {payload.docType}',
        partner=payload.partner,
        direction=payload.direction,
        status=_standard_status(payload.status),
        date=payload.occurredAt.strftime('%Y-%m-%d'),
        time=payload.occurredAt.strftime('%H:%M:%S'),
        size=f'{size_kb:.1f} KB',
        records=int(raw_payload.get('records', 0) or 0),
        control_number=control.isaControlNo or control.gsControlNo or control.stControlNo or uuid4().hex[:10].upper(),
        sender_id=str(raw_payload.get('senderId') or 'external'),
        receiver_id=str(raw_payload.get('receiverId') or 'external'),
        integration_type=integration_type,
        channel=channel,
        source_system=payload.sourceSystem,
        external_event_id=payload.externalEventId,
        idempotency_key=payload.idempotencyKey,
        business_refs=payload.businessRefs.model_dump(exclude_none=True),
        control_refs=payload.controlRefs.model_dump(exclude_none=True),
        occurred_at=payload.occurredAt.replace(tzinfo=None),
        payload_format=payload.payloadFormat,
        raw=payload.rawContent,
        raw_payload=raw_payload,
        logs=[
            {
                'timestamp': payload.occurredAt.isoformat(),
                'level': 'info',
                'system': payload.sourceSystem,
                'stage': 'transaction_ingestion',
                'message': f'Transaction ingested from {payload.sourceSystem}',
                'externalStatus': payload.status,
            }
        ],
        errors=[],
        environment=payload.environment,
    )


def _process_transaction_push(db: Session, payload: TransactionPushRequest) -> dict:
    existing = db.query(Transaction).filter(Transaction.idempotency_key == payload.idempotencyKey).first()
    if existing:
        linked_ids = [
            link.to_transaction_id
            for link in db.query(TransactionLink).filter(TransactionLink.from_transaction_id == existing.id).all()
        ]
        return {
            'success': True,
            'transactionId': existing.id,
            'status': existing.status,
            'idempotent': True,
            'linking': {'linked': len(linked_ids) > 0, 'relatedTransactionIds': linked_ids},
        }

    if payload.externalEventId:
        duplicate = (
            db.query(Transaction)
            .filter(
                Transaction.external_event_id == payload.externalEventId,
                Transaction.source_system == payload.sourceSystem,
            )
            .first()
        )
        if duplicate:
            return {
                'success': True,
                'transactionId': duplicate.id,
                'status': duplicate.status,
                'idempotent': True,
                'linking': {'linked': False, 'relatedTransactionIds': []},
            }

    transaction = _push_to_transaction(payload)
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    linking = build_links_for_transaction(db, transaction)
    return {
        'success': True,
        'transactionId': transaction.id,
        'status': transaction.status,
        'idempotent': False,
        'linking': linking,
    }


def _system_event_payload(event: TransactionSystemEvent) -> dict:
    return {
        'eventId': event.id,
        'transactionId': event.transaction_id,
        'idempotencyKey': event.idempotency_key,
        'system': event.system,
        'stage': event.stage,
        'eventType': event.event_type,
        'status': event.status,
        'externalStatus': event.external_status,
        'occurredAt': event.occurred_at.isoformat(),
        'message': event.message,
        'input': {'format': event.input_format, 'data': event.input_data} if event.input_format or event.input_data is not None else None,
        'output': {'format': event.output_format, 'data': event.output_data} if event.output_format or event.output_data is not None else None,
        'errors': event.errors or [],
        'durationMs': event.duration_ms,
        'traceId': event.trace_id,
        'attemptNo': event.attempt_no,
        'isFinal': event.is_final,
        'metadata': event.event_metadata or {},
        'createdAt': event.created_at.isoformat() if event.created_at else None,
    }


def _apply_event_to_transaction(transaction: Transaction, payload: TransactionSystemEventRequest, event_status: str) -> None:
    if event_status == 'failed':
        transaction.status = 'failed'
    elif event_status in {'received', 'processing'}:
        transaction.status = 'processing'
    elif payload.isFinal:
        transaction.status = 'completed'
    elif transaction.status != 'failed':
        transaction.status = 'processing'

    logs = list(transaction.logs or [])
    logs.append(
        {
            'timestamp': payload.occurredAt.isoformat(),
            'level': 'error' if event_status == 'failed' else 'info',
            'system': payload.system,
            'stage': payload.stage,
            'eventType': payload.eventType,
            'status': event_status,
            'externalStatus': payload.status,
            'message': payload.message or f'{payload.system}/{payload.stage} changed to {event_status}',
            'idempotencyKey': payload.idempotencyKey,
            'traceId': payload.traceId,
            'attemptNo': payload.attemptNo,
        }
    )
    transaction.logs = logs

    if payload.errors:
        errors = list(transaction.errors or [])
        errors.extend(
            {
                **item.model_dump(),
                'system': payload.system,
                'stage': payload.stage,
                'occurredAt': payload.occurredAt.isoformat(),
                'traceId': payload.traceId,
                'attemptNo': payload.attemptNo,
            }
            for item in payload.errors
        )
        transaction.errors = errors


@router.post('/transactions')
def push_transaction(payload: TransactionPushRequest, db: Session = Depends(get_db), actor=Depends(require_integration_client)):
    _require_api_key_actor(actor)
    return ok(_process_transaction_push(db, payload))


@router.post('/transactions/{transaction_id}/system-events')
def push_transaction_system_event(
    transaction_id: str,
    payload: TransactionSystemEventRequest,
    db: Session = Depends(get_db),
    actor=Depends(require_integration_client),
):
    _require_api_key_actor(actor)
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        return fail('Transaction not found', 'TRX_NOT_FOUND')

    existing = (
        db.query(TransactionSystemEvent)
        .filter(
            TransactionSystemEvent.transaction_id == transaction_id,
            TransactionSystemEvent.idempotency_key == payload.idempotencyKey,
        )
        .first()
    )
    if existing:
        return ok(
            {
                'transactionId': transaction.id,
                'transactionStatus': transaction.status,
                'idempotent': True,
                'event': _system_event_payload(existing),
            }
        )

    event_status = _standard_status(payload.status)
    event = TransactionSystemEvent(
        id=f'TSE-{uuid4().hex[:20]}',
        transaction_id=transaction.id,
        idempotency_key=payload.idempotencyKey,
        system=payload.system,
        stage=payload.stage,
        event_type=payload.eventType,
        status=event_status,
        external_status=payload.status,
        occurred_at=payload.occurredAt.replace(tzinfo=None),
        message=payload.message,
        input_format=payload.inputFormat,
        input_data=payload.inputData,
        output_format=payload.outputFormat,
        output_data=payload.outputData,
        errors=[item.model_dump() for item in payload.errors],
        duration_ms=payload.durationMs,
        trace_id=payload.traceId,
        attempt_no=payload.attemptNo,
        is_final=payload.isFinal,
        event_metadata=payload.metadata,
    )
    _apply_event_to_transaction(transaction, payload, event_status)
    db.add(event)
    db.commit()
    db.refresh(event)
    return ok(
        {
            'transactionId': transaction.id,
            'transactionStatus': transaction.status,
            'idempotent': False,
            'event': _system_event_payload(event),
        }
    )


@router.get('/transactions/{transaction_id}/system-events')
def get_transaction_system_events(
    transaction_id: str,
    db: Session = Depends(get_db),
    actor=Depends(require_integration_client),
):
    _require_api_key_actor(actor)
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        return fail('Transaction not found', 'TRX_NOT_FOUND')
    events = (
        db.query(TransactionSystemEvent)
        .filter(TransactionSystemEvent.transaction_id == transaction_id)
        .order_by(TransactionSystemEvent.occurred_at.asc(), TransactionSystemEvent.created_at.asc())
        .all()
    )
    return ok(
        {
            'transactionId': transaction.id,
            'transactionStatus': transaction.status,
            'eventCount': len(events),
            'events': [_system_event_payload(event) for event in events],
        }
    )


@router.get('/transactions/{transaction_id}/timeline')
def get_transaction_timeline(
    transaction_id: str,
    db: Session = Depends(get_db),
    actor=Depends(require_integration_client),
):
    _require_api_key_actor(actor)
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        return fail('Transaction not found', 'TRX_NOT_FOUND')
    events = (
        db.query(TransactionSystemEvent)
        .filter(TransactionSystemEvent.transaction_id == transaction_id)
        .order_by(TransactionSystemEvent.occurred_at.asc(), TransactionSystemEvent.created_at.asc())
        .all()
    )
    return ok(
        {
            'transaction': {
                'transactionId': transaction.id,
                'direction': transaction.direction,
                'docType': transaction.doc_type or transaction.type,
                'partner': transaction.partner,
                'status': transaction.status,
                'sourceSystem': transaction.source_system,
                'occurredAt': transaction.occurred_at.isoformat(),
                'payloadFormat': transaction.payload_format,
                'rawContent': transaction.raw,
                'rawPayload': transaction.raw_payload or {},
                'businessRefs': transaction.business_refs or {},
                'controlRefs': transaction.control_refs or {},
                'errors': transaction.errors or [],
            },
            'events': [_system_event_payload(event) for event in events],
        }
    )
