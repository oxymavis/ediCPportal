from __future__ import annotations

import json
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Transaction, TransactionLink
from app.schemas.common import fail, ok
from app.schemas.integration import IntegrationEvent
from app.services.deps import get_actor, require_integration_client, require_scope
from app.services.linking import build_links_for_transaction

router = APIRouter(
    prefix='/v1/integrations',
    tags=['integrations'],
    dependencies=[Depends(get_actor), Depends(require_integration_client), Depends(require_scope('integrations'))],
)


def _event_to_transaction(event: IntegrationEvent) -> Transaction:
    control = event.controlRefs
    integration_type = event.rawPayload.get('integrationType') or ('edi' if event.sourceSystem == 'edi' else 'api')
    channel = event.rawPayload.get('channel') or ('AS2' if integration_type == 'edi' else 'REST_API')
    return Transaction(
        id=f'TRX-{event.docType}-{uuid4().hex[:10]}',
        type=event.docType,
        doc_type=event.docType,
        type_name=f'Document {event.docType}',
        partner=event.partner,
        direction=event.direction,
        status=event.status,
        date=event.occurredAt.strftime('%Y-%m-%d'),
        time=event.occurredAt.strftime('%H:%M:%S'),
        size=f'{max(len(json.dumps(event.rawPayload)) / 1024, 0.1):.1f} KB',
        records=int(event.rawPayload.get('records', 0) or 0),
        control_number=control.isaControlNo or uuid4().hex[:10].upper(),
        sender_id=event.rawPayload.get('senderId', 'external'),
        receiver_id=event.rawPayload.get('receiverId', 'external'),
        integration_type=integration_type,
        channel=channel,
        source_system=event.sourceSystem,
        external_event_id=event.externalEventId,
        idempotency_key=event.idempotencyKey,
        business_refs=event.businessRefs.model_dump(exclude_none=True),
        control_refs=event.controlRefs.model_dump(exclude_none=True),
        occurred_at=event.occurredAt.replace(tzinfo=None),
        raw=json.dumps(event.rawPayload, ensure_ascii=False)[:100000],
        logs=[
            {
                'timestamp': event.occurredAt.isoformat(),
                'level': 'info',
                'message': f'Event ingested from {event.sourceSystem}',
            }
        ],
        errors=[],
        environment=event.environment,
    )


def _process_event(db: Session, event: IntegrationEvent) -> dict:
    existing = db.query(Transaction).filter(Transaction.idempotency_key == event.idempotencyKey).first()
    if existing:
        linked_ids = [
            x.to_transaction_id
            for x in db.query(TransactionLink).filter(TransactionLink.from_transaction_id == existing.id).all()
        ]
        return {
            'success': True,
            'transactionId': existing.id,
            'linking': {'linked': len(linked_ids) > 0, 'relatedTransactionIds': linked_ids},
        }

    if event.externalEventId:
        dupe = (
            db.query(Transaction)
            .filter(
                Transaction.external_event_id == event.externalEventId,
                Transaction.source_system == event.sourceSystem,
            )
            .first()
        )
        if dupe:
            return {
                'success': True,
                'transactionId': dupe.id,
                'linking': {'linked': False, 'relatedTransactionIds': []},
            }

    trx = _event_to_transaction(event)
    db.add(trx)
    db.commit()
    db.refresh(trx)
    linking = build_links_for_transaction(db, trx)
    return {'success': True, 'transactionId': trx.id, 'linking': linking}


def _enforce_actor_environment(actor: dict, env: str) -> None:
    if actor.get('kind') != 'oauth':
        return
    client_env = actor['client'].environment
    if client_env != 'all' and client_env != env:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Client environment is not allowed')


@router.post('/events')
def push_event(payload: IntegrationEvent, db: Session = Depends(get_db), actor=Depends(require_integration_client)):
    _enforce_actor_environment(actor, payload.environment)
    result = _process_event(db, payload)
    return ok(result)


@router.post('/events/batch')
def push_events_batch(payload: list[dict], db: Session = Depends(get_db), actor=Depends(require_integration_client)):
    results = []
    for item in payload:
        try:
            evt = IntegrationEvent.model_validate(item)
            _enforce_actor_environment(actor, evt.environment)
        except ValidationError as e:
            results.append({'success': False, 'error': 'Validation failed', 'code': 'INTEGRATION_VALIDATION', 'details': e.errors()})
            continue
        except HTTPException as e:
            results.append({'success': False, 'error': e.detail, 'code': 'INTEGRATION_FORBIDDEN'})
            continue
        try:
            results.append(_process_event(db, evt))
        except Exception as e:
            results.append({'success': False, 'error': str(e), 'code': 'INTEGRATION_INTERNAL_ERROR'})
    success_count = len([x for x in results if x.get('success')])
    return ok({'total': len(results), 'successCount': success_count, 'results': results})
