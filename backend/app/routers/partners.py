from __future__ import annotations
from uuid import uuid4

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models import AS2Profile, Partner, Subsidiary
from app.schemas.common import fail, ok
from app.services.deps import get_actor, require_csrf, require_scope
from app.services.mappers import partner_to_api
from app.services.validation import validate_message_routing

router = APIRouter(prefix='/v1/partners', tags=['partners'], dependencies=[Depends(get_actor), Depends(require_scope('partners'))])


@router.get('')
def get_partners(environment: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Partner).options(joinedload(Partner.subsidiaries).joinedload(Subsidiary.as2_profiles))
    if environment:
        q = q.filter((Partner.environment == environment) | (Partner.environment.is_(None)))
    return ok([partner_to_api(p) for p in q.all()])


@router.get('/{partner_id}')
def get_partner(partner_id: str, db: Session = Depends(get_db)):
    p = (
        db.query(Partner)
        .options(joinedload(Partner.subsidiaries).joinedload(Subsidiary.as2_profiles))
        .filter(Partner.id == partner_id)
        .first()
    )
    if not p:
        return fail('Partner not found', 'PARTNER_NOT_FOUND')
    return ok(partner_to_api(p))


@router.post('')
def create_partner(payload: dict, _csrf: None = Depends(require_csrf), db: Session = Depends(get_db)):
    name = (payload.get('name') or '').strip()
    code = (payload.get('code') or '').strip().upper()
    if not name or not code:
        return fail('Missing required fields: name, code', 'PARTNER_VALIDATION')

    primary = payload.get('primaryContact') or {}
    if not (primary.get('email') or payload.get('email')):
        return fail('Primary contact email is required', 'PARTNER_VALIDATION')

    partner = Partner(
        id=str(uuid4()),
        name=name,
        code=code,
        status=payload.get('status', 'active'),
        industry=payload.get('industry', 'retail'),
        website=payload.get('website'),
        contact_name=primary.get('name') or payload.get('contactName') or '',
        contact_email=primary.get('email') or payload.get('email') or '',
        contact_phone=primary.get('phone') or payload.get('contactPhone'),
        environment=payload.get('environment', 'production'),
    )

    for s in payload.get('subsidiaries', []):
        sub = Subsidiary(
            id=str(uuid4()),
            name=s.get('name', ''),
            code=s.get('code', ''),
            region=s.get('region', ''),
            status=s.get('status', 'active'),
            supported_doc_types_x12=((s.get('supportedDocTypes') or {}).get('x12') or []),
            supported_doc_types_edifact=((s.get('supportedDocTypes') or {}).get('edifact') or []),
            message_routing=validate_message_routing(s.get('messageRouting')),
        )
        for a in s.get('as2Profiles', []):
            sub.as2_profiles.append(
                AS2Profile(
                    id=str(uuid4()),
                    name=a.get('name', ''),
                    as2_id=a.get('as2Id', ''),
                    as2_url=a.get('as2Url', ''),
                    status=a.get('status', 'active'),
                    encryption_cert=a.get('encryptionCert'),
                    signing_cert=a.get('signingCert'),
                    mdn_required=a.get('mdnRequired', True),
                    mdn_signed=a.get('mdnSigned', True),
                    encryption_algorithm=a.get('encryptionAlgorithm', 'AES-256'),
                    signature_algorithm=a.get('signatureAlgorithm', 'SHA-256'),
                )
            )
        partner.subsidiaries.append(sub)

    db.add(partner)
    db.commit()
    db.refresh(partner)
    return ok(partner_to_api(partner))


@router.put('/{partner_id}')
def update_partner(
    partner_id: str,
    payload: dict,
    _csrf: None = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    p = db.query(Partner).filter(Partner.id == partner_id).first()
    if not p:
        return fail('Partner not found', 'PARTNER_NOT_FOUND')

    for field, attr in [
        ('name', 'name'),
        ('code', 'code'),
        ('status', 'status'),
        ('industry', 'industry'),
        ('website', 'website'),
        ('environment', 'environment'),
    ]:
        if payload.get(field) is not None:
            setattr(p, attr, payload.get(field))

    if payload.get('primaryContact'):
        contact = payload['primaryContact']
        p.contact_name = contact.get('name', p.contact_name)
        p.contact_email = contact.get('email', p.contact_email)
        p.contact_phone = contact.get('phone', p.contact_phone)

    db.commit()
    db.refresh(p)
    return ok(partner_to_api(p))


@router.get('/{partner_id}/subsidiaries/{subsidiary_id}/routing')
def get_subsidiary_routing(partner_id: str, subsidiary_id: str, db: Session = Depends(get_db)):
    sub = (
        db.query(Subsidiary)
        .join(Partner, Partner.id == Subsidiary.partner_id)
        .filter(Partner.id == partner_id, Subsidiary.id == subsidiary_id)
        .first()
    )
    if not sub:
        return fail('Subsidiary not found', 'SUBSIDIARY_NOT_FOUND')
    return ok(sub.message_routing or {'enabledTypes': [], 'rules': []})


@router.put('/{partner_id}/subsidiaries/{subsidiary_id}/routing')
def update_subsidiary_routing(
    partner_id: str,
    subsidiary_id: str,
    payload: dict,
    _csrf: None = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    sub = (
        db.query(Subsidiary)
        .join(Partner, Partner.id == Subsidiary.partner_id)
        .filter(Partner.id == partner_id, Subsidiary.id == subsidiary_id)
        .first()
    )
    if not sub:
        return fail('Subsidiary not found', 'SUBSIDIARY_NOT_FOUND')

    sub.message_routing = validate_message_routing(payload)
    db.commit()
    db.refresh(sub)
    return ok(sub.message_routing)


@router.delete('/{partner_id}')
def delete_partner(
    partner_id: str,
    _csrf: None = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    p = db.query(Partner).filter(Partner.id == partner_id).first()
    if not p:
        return fail('Partner not found', 'PARTNER_NOT_FOUND')
    db.delete(p)
    db.commit()
    return ok({'deleted': True})
