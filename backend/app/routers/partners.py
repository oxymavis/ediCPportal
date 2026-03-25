from __future__ import annotations
from datetime import datetime
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

ALLOWED_INTEGRATION_TYPES = {'edi', 'api'}
ALLOWED_CHANNELS = {'AS2', 'SFTP', 'VAN', 'REST_API', 'WEBHOOK'}
ALLOWED_AS2_QUALIFIERS = {f'{x:02d}' for x in range(1, 34)} | {'ZZ'}


def _validate_api_config(payload: dict | None) -> tuple[bool, str | None]:
    if not payload:
        return True, None
    base_url = payload.get('baseUrl')
    auth_method = payload.get('authMethod')
    if base_url and not str(base_url).startswith(('http://', 'https://')):
        return False, 'apiConfig.baseUrl must start with http:// or https://'
    if auth_method and auth_method not in {'Bearer Token', 'API Key', 'OAuth 2.0'}:
        return False, 'apiConfig.authMethod must be one of Bearer Token/API Key/OAuth 2.0'
    return True, None


def _validate_as2_profile(profile: dict) -> tuple[bool, str | None]:
    port = profile.get('as2Port')
    sender_id = str(profile.get('senderId') or '').strip()
    receiver_id = str(profile.get('receiverId') or '').strip()
    sender_qualifier = str(profile.get('senderQualifier') or '').strip().upper()
    receiver_qualifier = str(profile.get('receiverQualifier') or '').strip().upper()

    if port in (None, ''):
        return False, 'AS2 port is required'
    try:
        parsed_port = int(port)
    except (TypeError, ValueError):
        return False, 'AS2 port must be an integer'
    if parsed_port <= 0 or parsed_port > 65535:
        return False, 'AS2 port must be between 1 and 65535'
    if not sender_id:
        return False, 'AS2 senderId is required'
    if not receiver_id:
        return False, 'AS2 receiverId is required'
    if sender_qualifier not in ALLOWED_AS2_QUALIFIERS:
        return False, 'AS2 senderQualifier must be one of 01-33 or ZZ'
    if receiver_qualifier not in ALLOWED_AS2_QUALIFIERS:
        return False, 'AS2 receiverQualifier must be one of 01-33 or ZZ'
    return True, None


def _serialize_as2_profile(profile: AS2Profile) -> dict:
    return {
        'id': profile.id,
        'name': profile.name,
        'as2Id': profile.as2_id,
        'as2Url': profile.as2_url,
        'as2Port': profile.as2_port,
        'senderId': profile.sender_id,
        'senderQualifier': profile.sender_qualifier,
        'receiverId': profile.receiver_id,
        'receiverQualifier': profile.receiver_qualifier,
        'status': profile.status,
        'encryptionCert': profile.encryption_cert,
        'signingCert': profile.signing_cert,
        'mdnRequired': profile.mdn_required,
        'mdnSigned': profile.mdn_signed,
        'encryptionAlgorithm': profile.encryption_algorithm,
        'signatureAlgorithm': profile.signature_algorithm,
    }


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

    integration_type = (payload.get('integrationType') or 'edi').lower()
    if integration_type not in ALLOWED_INTEGRATION_TYPES:
        return fail('integrationType must be edi or api', 'PARTNER_VALIDATION')
    communication_channel = payload.get('communicationChannel') or ('AS2' if integration_type == 'edi' else 'REST_API')
    if communication_channel not in ALLOWED_CHANNELS:
        return fail('Invalid communicationChannel', 'PARTNER_VALIDATION')
    valid_cfg, cfg_err = _validate_api_config(payload.get('apiConfig'))
    if not valid_cfg:
        return fail(cfg_err or 'Invalid apiConfig', 'PARTNER_VALIDATION')
    for s in payload.get('subsidiaries', []):
        for a in s.get('as2Profiles', []):
            valid_as2, as2_err = _validate_as2_profile(a)
            if not valid_as2:
                return fail(as2_err or 'Invalid AS2 profile', 'PARTNER_VALIDATION')

    current_step_id = int(payload.get('currentStepId') or 1)
    current_step_id = max(1, min(5, current_step_id))
    onboarding_start_date = payload.get('onboardingStartDate') or datetime.utcnow().strftime('%Y-%m-%d')
    step_completion_dates = payload.get('stepCompletionDates') or {}

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
        integration_type=integration_type,
        communication_channel=communication_channel,
        current_step_id=current_step_id,
        onboarding_start_date=onboarding_start_date,
        step_completion_dates=step_completion_dates,
        api_config=payload.get('apiConfig'),
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
                    as2_port=int(a.get('as2Port') or 443),
                    sender_id=a.get('senderId', ''),
                    sender_qualifier=(a.get('senderQualifier') or 'ZZ').upper(),
                    receiver_id=a.get('receiverId', ''),
                    receiver_qualifier=(a.get('receiverQualifier') or 'ZZ').upper(),
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
        ('integrationType', 'integration_type'),
        ('communicationChannel', 'communication_channel'),
        ('currentStepId', 'current_step_id'),
        ('onboardingStartDate', 'onboarding_start_date'),
        ('stepCompletionDates', 'step_completion_dates'),
        ('apiConfig', 'api_config'),
    ]:
        if payload.get(field) is not None:
            if field == 'integrationType' and payload.get(field) not in ALLOWED_INTEGRATION_TYPES:
                return fail('integrationType must be edi or api', 'PARTNER_VALIDATION')
            if field == 'communicationChannel' and payload.get(field) not in ALLOWED_CHANNELS:
                return fail('Invalid communicationChannel', 'PARTNER_VALIDATION')
            if field == 'apiConfig':
                valid_cfg, cfg_err = _validate_api_config(payload.get('apiConfig'))
                if not valid_cfg:
                    return fail(cfg_err or 'Invalid apiConfig', 'PARTNER_VALIDATION')
            setattr(p, attr, payload.get(field))

    if payload.get('primaryContact'):
        contact = payload['primaryContact']
        p.contact_name = contact.get('name', p.contact_name)
        p.contact_email = contact.get('email', p.contact_email)
        p.contact_phone = contact.get('phone', p.contact_phone)

    db.commit()
    db.refresh(p)
    return ok(partner_to_api(p))


@router.put('/{partner_id}/lifecycle')
def update_partner_lifecycle(
    partner_id: str,
    payload: dict,
    _csrf: None = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    p = db.query(Partner).filter(Partner.id == partner_id).first()
    if not p:
        return fail('Partner not found', 'PARTNER_NOT_FOUND')

    if payload.get('currentStepId') is not None:
        p.current_step_id = max(1, min(5, int(payload.get('currentStepId'))))
    if payload.get('onboardingStartDate') is not None:
        p.onboarding_start_date = payload.get('onboardingStartDate')
    if payload.get('stepCompletionDates') is not None:
        p.step_completion_dates = payload.get('stepCompletionDates') or {}

    db.commit()
    db.refresh(p)
    return ok(partner_to_api(p))


@router.post('/{partner_id}/lifecycle/advance')
def advance_partner_lifecycle(
    partner_id: str,
    _csrf: None = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    p = db.query(Partner).filter(Partner.id == partner_id).first()
    if not p:
        return fail('Partner not found', 'PARTNER_NOT_FOUND')
    current = p.current_step_id or 1
    if current < 5:
        p.current_step_id = current + 1
    dates = p.step_completion_dates or {}
    dates[str(p.current_step_id)] = datetime.utcnow().strftime('%Y-%m-%d')
    p.step_completion_dates = dates
    db.commit()
    db.refresh(p)
    return ok(partner_to_api(p))


@router.post('/{partner_id}/api-config/validate')
def validate_partner_api_config(
    partner_id: str,
    payload: dict,
    _csrf: None = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    p = db.query(Partner).filter(Partner.id == partner_id).first()
    if not p:
        return fail('Partner not found', 'PARTNER_NOT_FOUND')
    valid_cfg, cfg_err = _validate_api_config(payload)
    if not valid_cfg:
        return fail(cfg_err or 'Invalid apiConfig', 'PARTNER_API_CONFIG_INVALID')
    masked = dict(payload)
    if masked.get('apiKey'):
        masked['apiKey'] = '***MASKED***'
    return ok({'valid': True, 'maskedConfig': masked})


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


@router.put('/{partner_id}/subsidiaries/{subsidiary_id}/as2-profiles/{profile_id}')
def update_as2_profile(
    partner_id: str,
    subsidiary_id: str,
    profile_id: str,
    payload: dict,
    _csrf: None = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    profile = (
        db.query(AS2Profile)
        .join(Subsidiary, Subsidiary.id == AS2Profile.subsidiary_id)
        .join(Partner, Partner.id == Subsidiary.partner_id)
        .filter(Partner.id == partner_id, Subsidiary.id == subsidiary_id, AS2Profile.id == profile_id)
        .first()
    )
    if not profile:
        return fail('AS2 profile not found', 'AS2_PROFILE_NOT_FOUND')

    merged = {
        'as2Port': payload.get('as2Port', profile.as2_port),
        'senderId': payload.get('senderId', profile.sender_id),
        'senderQualifier': payload.get('senderQualifier', profile.sender_qualifier),
        'receiverId': payload.get('receiverId', profile.receiver_id),
        'receiverQualifier': payload.get('receiverQualifier', profile.receiver_qualifier),
    }
    valid_as2, as2_err = _validate_as2_profile(merged)
    if not valid_as2:
        return fail(as2_err or 'Invalid AS2 profile', 'PARTNER_VALIDATION')

    if payload.get('name') is not None:
        profile.name = str(payload.get('name') or '').strip() or profile.name
    if payload.get('as2Url') is not None:
        profile.as2_url = str(payload.get('as2Url') or '').strip()
    profile.as2_port = int(merged['as2Port'])
    profile.sender_id = str(merged['senderId']).strip()
    profile.sender_qualifier = str(merged['senderQualifier']).strip().upper()
    profile.receiver_id = str(merged['receiverId']).strip()
    profile.receiver_qualifier = str(merged['receiverQualifier']).strip().upper()

    db.commit()
    db.refresh(profile)
    return ok(_serialize_as2_profile(profile))


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
