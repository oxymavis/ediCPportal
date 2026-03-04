from __future__ import annotations

from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Transaction, TransactionLink


DOC_LINK_RULES: dict[str, dict] = {
    '945': {
        'target_type': '940',
        'primary_keys': ['warehouseOrderNo'],
        'secondary_keys': ['shipmentNo'],
        'relation_type': 'response_to',
    },
    '856': {
        'target_type': '850',
        'primary_keys': ['poNo', 'orderNo'],
        'secondary_keys': ['shipmentNo'],
        'relation_type': 'response_to',
    },
    '214': {
        'target_type': '204',
        'primary_keys': ['loadNo', 'bolNo'],
        'secondary_keys': ['shipmentNo'],
        'relation_type': 'status_of',
    },
}


def _extract_refs(trx: Transaction) -> dict:
    refs = {}
    refs.update(trx.business_refs or {})
    refs.update(trx.control_refs or {})
    return refs


def _already_linked(db: Session, from_id: str, to_id: str) -> bool:
    return (
        db.query(TransactionLink)
        .filter(TransactionLink.from_transaction_id == from_id, TransactionLink.to_transaction_id == to_id)
        .first()
        is not None
    )


def build_links_for_transaction(db: Session, trx: Transaction) -> dict:
    doc_type = trx.doc_type or trx.type
    rule = DOC_LINK_RULES.get(doc_type)
    if not rule:
        return {'linked': False, 'relatedTransactionIds': [], 'reason': 'doc_type_not_supported'}

    target_type = rule['target_type']
    refs = _extract_refs(trx)
    candidates = (
        db.query(Transaction)
        .filter(
            Transaction.id != trx.id,
            Transaction.environment == trx.environment,
            Transaction.partner == trx.partner,
            (Transaction.doc_type == target_type) | (Transaction.type == target_type),
            Transaction.occurred_at >= trx.occurred_at - timedelta(days=settings.linking_time_window_days),
            Transaction.occurred_at <= trx.occurred_at + timedelta(days=settings.linking_time_window_days),
        )
        .all()
    )
    if not candidates:
        return {'linked': False, 'relatedTransactionIds': [], 'reason': 'no_candidate'}

    scored: list[tuple[Transaction, int, str, dict]] = []
    for c in candidates:
        candidate_refs = _extract_refs(c)
        for k in rule['primary_keys']:
            if refs.get(k) and refs.get(k) == candidate_refs.get(k):
                scored.append((c, 95, f'{k}+partner+window', {k: refs.get(k)}))
                break
        else:
            for k in rule['secondary_keys']:
                if refs.get(k) and refs.get(k) == candidate_refs.get(k):
                    scored.append((c, 80, f'{k}+partner+window', {k: refs.get(k)}))
                    break

    if not scored:
        return {'linked': False, 'relatedTransactionIds': [], 'reason': 'no_match_key'}

    scored.sort(key=lambda item: (item[1], item[0].occurred_at), reverse=True)
    top_score = scored[0][1]
    top_candidates = [x for x in scored if x[1] == top_score]
    if len(top_candidates) > 1:
        return {'linked': False, 'relatedTransactionIds': [], 'reason': 'ambiguous'}

    chosen, confidence, match_rule, evidence = scored[0]
    if not _already_linked(db, trx.id, chosen.id):
        db.add(
            TransactionLink(
                from_transaction_id=trx.id,
                to_transaction_id=chosen.id,
                relation_type=rule['relation_type'],
                match_rule=match_rule,
                confidence=confidence,
                evidence=evidence,
            )
        )
        db.commit()

    return {'linked': True, 'relatedTransactionIds': [chosen.id], 'reason': 'linked'}
