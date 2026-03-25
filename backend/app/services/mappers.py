from __future__ import annotations
from app.models import AS2Profile, Certificate, Notification, Partner, Subsidiary, TpSpecification, Transaction, TransactionLink, UnisSpecification


def partner_to_api(p: Partner) -> dict:
    progress = max(0, min(100, int((p.current_step_id or 1) / 5 * 100)))
    return {
        'id': p.id,
        'name': p.name,
        'code': p.code,
        'status': p.status,
        'industry': p.industry,
        'website': p.website,
        'primaryContact': {
            'name': p.contact_name,
            'email': p.contact_email,
            'phone': p.contact_phone,
        },
        'integrationType': p.integration_type or 'edi',
        'communicationChannel': p.communication_channel,
        'apiConfig': p.api_config,
        'lifecycle': {
            'currentStepId': p.current_step_id or 1,
            'onboardingStartDate': p.onboarding_start_date,
            'stepCompletionDates': p.step_completion_dates or {},
            'progressPercent': progress,
        },
        'subsidiaries': [
            {
                'id': s.id,
                'name': s.name,
                'code': s.code,
                'region': s.region,
                'status': s.status,
                'supportedDocTypes': {
                    'x12': s.supported_doc_types_x12 or [],
                    'edifact': s.supported_doc_types_edifact or [],
                },
                'as2Profiles': [
                    {
                        'id': a.id,
                        'name': a.name,
                        'as2Id': a.as2_id,
                        'as2Url': a.as2_url,
                        'as2Port': a.as2_port,
                        'senderId': a.sender_id,
                        'senderQualifier': a.sender_qualifier,
                        'receiverId': a.receiver_id,
                        'receiverQualifier': a.receiver_qualifier,
                        'status': a.status,
                        'encryptionCert': a.encryption_cert,
                        'signingCert': a.signing_cert,
                        'mdnRequired': a.mdn_required,
                        'mdnSigned': a.mdn_signed,
                        'encryptionAlgorithm': a.encryption_algorithm,
                        'signatureAlgorithm': a.signature_algorithm,
                    }
                    for a in s.as2_profiles
                ],
                'messageRouting': s.message_routing or {'enabledTypes': [], 'rules': []},
            }
            for s in p.subsidiaries
        ],
        'environment': p.environment,
    }


def certificate_to_api(c: Certificate) -> dict:
    return {
        'id': c.id,
        'name': c.name,
        'serialNumber': c.serial_number,
        'fingerprint': c.fingerprint,
        'issuer': c.issuer,
        'subject': c.subject,
        'algorithm': c.algorithm,
        'keySize': c.key_size,
        'created': c.created,
        'expires': c.expires,
        'usage': c.usage,
        'type': c.type,
        'status': c.status,
        'partner': c.partner,
        'environment': c.environment,
        'rawContent': c.raw_content,
        'filePath': c.file_path,
    }


def transaction_to_api(t: Transaction) -> dict:
    return {
        'id': t.id,
        'type': t.type,
        'docType': t.doc_type or t.type,
        'typeName': t.type_name,
        'partner': t.partner,
        'direction': t.direction,
        'status': t.status,
        'date': t.date,
        'time': t.time,
        'size': t.size,
        'records': t.records,
        'controlNumber': t.control_number,
        'senderId': t.sender_id,
        'receiverId': t.receiver_id,
        'integrationType': t.integration_type or ('api' if (t.channel or '').startswith('REST') else 'edi'),
        'channel': t.channel,
        'sourceSystem': t.source_system,
        'externalEventId': t.external_event_id,
        'idempotencyKey': t.idempotency_key,
        'businessRefs': t.business_refs or {},
        'controlRefs': t.control_refs or {},
        'occurredAt': t.occurred_at.isoformat() if t.occurred_at else None,
        'raw': t.raw,
        'logs': t.logs or [],
        'errors': t.errors,
        'environment': t.environment,
    }


def transaction_link_to_api(link: TransactionLink, related: Transaction) -> dict:
    return {
        'transactionId': related.id,
        'docType': related.doc_type or related.type,
        'partner': related.partner,
        'status': related.status,
        'date': related.date,
        'time': related.time,
        'relationType': link.relation_type,
        'matchRule': link.match_rule,
        'confidence': link.confidence,
    }


def notification_to_api(n: Notification) -> dict:
    return {
        'id': n.id,
        'type': n.type,
        'title': n.title,
        'message': n.message,
        'date': n.date,
        'time': n.time,
        'read': n.read,
        'archived': n.archived,
        'environment': n.environment,
        'action': n.action,
        'details': n.details,
    }


def unis_to_api(s: UnisSpecification) -> dict:
    return {
        'code': s.code,
        'name': s.name,
        'description': s.description,
        'category': s.category,
        'version': s.version,
        'lastUpdated': s.last_updated,
    }


def tp_spec_to_api(s: TpSpecification) -> dict:
    return {
        'id': s.id,
        'messageType': s.message_type,
        'messageName': s.message_name,
        'partner': s.partner,
        'partnerCode': s.partner_code,
        'version': s.version,
        'uploadedDate': s.uploaded_date,
        'uploadedBy': s.uploaded_by,
        'fileType': s.file_type,
        'fileName': s.file_name,
        'size': s.size,
        'status': s.status or 'active',
        'filePath': s.file_path,
    }
