from __future__ import annotations

from uuid import uuid4

import httpx

from app.core.config import settings
from app.db.session import SessionLocal
from app.models import AS2Profile, Partner, PartnerSyncLog
from app.routers import certificates as certificates_router
from app.routers import partners as partners_router
from app.services.partner_external_sync import SyncResult, _decode_external_response, build_partner_sync_payload


def _auth(client):
    email = f'sync-{uuid4().hex[:8]}@example.com'
    res = client.post(
        '/v1/auth/register',
        json={
            'name': 'Sync User',
            'email': email,
            'password': 'Password1',
            'confirmPassword': 'Password1',
        },
    )
    assert res.status_code == 200
    csrf = client.cookies.get('edi_csrf')
    assert csrf
    return {'x-csrf-token': csrf}


def _install_sync_stub(monkeypatch, captured: list[dict], mode: str = 'success'):
    state = {'delete_attempts': 0}

    def fake_sync(db, partner, action, environment=None):
        payload, warning = build_partner_sync_payload(
            db,
            partner,
            action,
            request_id=f'req-{len(captured) + 1}',
            environment=environment,
        )
        captured.append({'action': action, 'payload': payload, 'partner_id': partner.id, 'environment': environment})
        if mode == 'delete_retry' and action == 'delete':
            state['delete_attempts'] += 1
            if state['delete_attempts'] == 1:
                return SyncResult(
                    ok=False,
                    request_id=payload['requestId'],
                    payload=payload,
                    response_payload={'success': False, 'message': 'delete failed'},
                    http_status=500,
                    error='delete failed',
                    action=action,
                    environment=environment,
                    warning=warning,
                )
        external_partner_id = partner.external_partner_id or f'ext-{partner.code}'
        return SyncResult(
            ok=True,
            request_id=payload['requestId'],
            payload=payload,
            response_payload={'success': True, 'message': 'ok', 'partnerId': external_partner_id},
            http_status=200,
            error=None,
            action=action,
            environment=environment,
            external_partner_id=external_partner_id,
            warning=warning,
        )

    monkeypatch.setattr(partners_router, 'sync_partner_to_external', fake_sync)
    monkeypatch.setattr(certificates_router, 'sync_partner_to_external', fake_sync)


def test_create_as2_partner_persists_external_partner_id_and_logs(client, monkeypatch):
    headers = _auth(client)
    captured: list[dict] = []
    _install_sync_stub(monkeypatch, captured)

    create = client.post(
        '/v1/partners',
        headers=headers,
        json={
            'name': 'Sync Target',
            'code': 'SYNC1',
            'status': 'active',
            'primaryContact': {'name': 'EDI', 'email': 'edi@sync1.com'},
            'communicationChannel': 'AS2',
            'environment': 'sandbox',
            'subsidiaries': [
                {
                    'name': 'Sync Target US',
                    'code': 'SYNC1-US',
                    'region': 'US',
                    'supportedDocTypes': {'x12': ['850'], 'edifact': []},
                    'as2Profiles': [
                        {
                            'name': 'Primary',
                            'as2Id': 'SYNC-AS2',
                            'as2Url': 'https://as2.partner.example.com/receive',
                            'as2Port': 443,
                            'senderId': 'UNIS',
                            'senderQualifier': 'ZZ',
                            'receiverId': 'SYNC1',
                            'receiverQualifier': '12',
                        }
                    ],
                }
            ],
        },
    )
    assert create.status_code == 200
    body = create.json()
    assert body['success'] is True
    assert body['data']['externalProfile']['partnerId'] is None
    assert body['data']['externalProfile']['syncStatus'] == 'certificate_pending'
    assert body['data']['externalProfile']['partnerSyncStatus'] == 'not_synced'
    assert body['data']['externalProfile']['certificateSyncStatus'] == 'pending'
    assert body['data']['externalProfile']['lastWarning'] == 'Upload a certificate to start external sync'
    assert captured == []

    db = SessionLocal()
    try:
        partner = db.query(Partner).filter(Partner.code == 'SYNC1').first()
        assert partner is not None
        assert partner.external_partner_id is None
        assert partner.external_sync_status == 'certificate_pending'
        assert partner.external_partner_sync_status == 'not_synced'
        assert partner.external_certificate_sync_status == 'pending'
        logs = db.query(PartnerSyncLog).filter(PartnerSyncLog.partner_id == partner.id).all()
        assert len(logs) == 0
    finally:
        db.close()


def test_create_partner_rejects_invalid_as2_url(client):
    headers = _auth(client)

    create = client.post(
        '/v1/partners',
        headers=headers,
        json={
            'name': 'Broken Sync',
            'code': 'BROKEN1',
            'status': 'active',
            'primaryContact': {'name': 'EDI', 'email': 'broken@example.com'},
            'communicationChannel': 'AS2',
            'subsidiaries': [
                {
                    'name': 'Broken Sync US',
                    'code': 'BROKEN1-US',
                    'region': 'US',
                    'supportedDocTypes': {'x12': ['850'], 'edifact': []},
                    'as2Profiles': [
                        {
                            'name': 'Primary',
                            'as2Id': 'BROKEN-AS2',
                            'as2Url': 'broken-as2-endpoint',
                            'as2Port': 443,
                            'senderId': 'UNIS',
                            'senderQualifier': 'ZZ',
                            'receiverId': 'BROKEN1',
                            'receiverQualifier': '12',
                        }
                    ],
                }
            ],
        },
    )

    assert create.status_code == 200
    body = create.json()
    assert body['success'] is False
    assert body['code'] == 'PARTNER_VALIDATION'
    assert body['error'] == 'AS2 endpoint URL must be a valid http(s) URL'


def test_channel_payload_mappings_for_api_sftp_and_van(client, monkeypatch):
    headers = _auth(client)
    captured: list[dict] = []
    _install_sync_stub(monkeypatch, captured)

    api_res = client.post(
        '/v1/partners',
        headers=headers,
        json={
            'name': 'API Sync',
            'code': 'API2',
            'integrationType': 'api',
            'communicationChannel': 'REST_API',
            'primaryContact': {'name': 'API', 'email': 'api@example.com'},
            'environment': 'sandbox',
            'apiConfig': {'baseUrl': 'https://api.partner.example.com/v2/orders', 'webhook': 'https://hooks.example.com/unis'},
        },
    )
    assert api_res.status_code == 200
    assert api_res.json()['data']['channelConfig']['baseUrl'] == 'https://api.partner.example.com/v2/orders'

    sftp_res = client.post(
        '/v1/partners',
        headers=headers,
        json={
            'name': 'SFTP Sync',
            'code': 'SFTP1',
            'communicationChannel': 'SFTP',
            'primaryContact': {'name': 'SFTP', 'email': 'sftp@example.com'},
            'environment': 'sandbox',
            'sftpHost': 'sftp.partner.example.com',
            'sftpPort': '2222',
            'sftpUser': 'sync-user',
            'sftpRemotePath': '/inbound/unis',
        },
    )
    assert sftp_res.status_code == 200
    assert sftp_res.json()['data']['channelConfig']['host'] == 'sftp.partner.example.com'

    van_res = client.post(
        '/v1/partners',
        headers=headers,
        json={
            'name': 'VAN Sync',
            'code': 'VAN1',
            'communicationChannel': 'VAN',
            'primaryContact': {'name': 'VAN', 'email': 'van@example.com'},
            'environment': 'sandbox',
            'vanProvider': 'SPS',
            'vanNetworkId': 'NET-001',
            'vanTargetHost': 'van.partner.example.com',
            'vanTargetPort': '8443',
            'vanUrlPath': '/edi/receive',
        },
    )
    assert van_res.status_code == 200
    assert van_res.json()['data']['channelConfig']['provider'] == 'SPS'

    api_payload = captured[0]['payload']
    sftp_payload = captured[1]['payload']
    van_payload = captured[2]['payload']

    assert api_payload['profile']['deliverySetting']['data'] == {
        'protocol': 'https',
        'targetHost': 'api.partner.example.com',
        'targetPort': '443',
        'urlPath': '/v2/orders',
    }
    assert api_payload['profile']['ediint']['operation'] == 'N'
    assert api_payload['profile']['certificate']['operation'] == 'N'

    assert sftp_payload['profile']['deliverySetting']['data'] == {
        'protocol': 'sftp',
        'targetHost': 'sftp.partner.example.com',
        'targetPort': '2222',
        'urlPath': '/inbound/unis',
    }
    assert van_payload['profile']['deliverySetting']['data'] == {
        'protocol': 'van',
        'targetHost': 'van.partner.example.com',
        'targetPort': '8443',
        'urlPath': '/edi/receive',
    }


def test_update_partner_uses_external_partner_id(client, monkeypatch):
    headers = _auth(client)
    captured: list[dict] = []
    _install_sync_stub(monkeypatch, captured)

    create = client.post(
        '/v1/partners',
        headers=headers,
        json={
            'name': 'Update Me',
            'code': 'UPD1',
            'primaryContact': {'name': 'EDI', 'email': 'upd@example.com'},
            'communicationChannel': 'REST_API',
            'integrationType': 'api',
            'environment': 'sandbox',
            'apiConfig': {'baseUrl': 'https://partner.example.com/api'},
        },
    )
    partner_id = create.json()['data']['id']

    update = client.put(
        f'/v1/partners/{partner_id}',
        headers=headers,
        json={'name': 'Update Me 2', 'primaryContact': {'name': 'EDI', 'email': 'upd2@example.com'}},
    )
    assert update.status_code == 200
    assert captured[1]['action'] == 'update'
    assert captured[1]['payload']['partnerId'] == 'ext-UPD1'


def test_update_partner_persists_code_type_and_tier(client, monkeypatch):
    headers = _auth(client)
    captured: list[dict] = []
    _install_sync_stub(monkeypatch, captured)

    create = client.post(
        '/v1/partners',
        headers=headers,
        json={
            'name': 'Editable Partner',
            'code': 'EDIT1',
            'type': 'retailer',
            'tier': 'standard',
            'primaryContact': {'name': 'EDI', 'email': 'edit@example.com'},
            'communicationChannel': 'REST_API',
            'integrationType': 'api',
            'apiConfig': {'baseUrl': 'https://partner.example.com/api'},
        },
    )
    partner_id = create.json()['data']['id']

    update = client.put(
        f'/v1/partners/{partner_id}',
        headers=headers,
        json={
            'name': 'Editable Partner Updated',
            'code': 'EDIT2',
            'type': 'manufacturer',
            'tier': 'enterprise',
            'primaryContact': {'name': 'EDI', 'email': 'edit2@example.com'},
        },
    )
    assert update.status_code == 200
    body = update.json()['data']
    assert body['code'] == 'EDIT2'
    assert body['type'] == 'manufacturer'
    assert body['tier'] == 'enterprise'


def test_upload_certificate_auto_resyncs_partner_to_fully_synced(client, monkeypatch):
    headers = _auth(client)
    captured: list[dict] = []
    _install_sync_stub(monkeypatch, captured)

    create = client.post(
        '/v1/partners',
        headers=headers,
        json={
            'name': 'Cert Later',
            'code': 'CERT1',
            'status': 'active',
            'primaryContact': {'name': 'EDI', 'email': 'cert1@example.com'},
            'communicationChannel': 'AS2',
            'environment': 'sandbox',
            'subsidiaries': [
                {
                    'name': 'Cert Later US',
                    'code': 'CERT1-US',
                    'region': 'US',
                    'supportedDocTypes': {'x12': ['850'], 'edifact': []},
                    'as2Profiles': [
                        {
                            'name': 'Primary',
                            'as2Id': 'CERT1-AS2',
                            'as2Url': 'https://as2.cert.example.com/receive',
                            'as2Port': 9500,
                            'senderId': 'UNIS-CERT1',
                            'senderQualifier': 'ZZ',
                            'receiverId': 'CERT1-RECV',
                            'receiverQualifier': '12',
                            'signingCert': 'Cert Later Signing',
                        }
                    ],
                }
            ],
        },
    )
    assert create.status_code == 200
    partner_id = create.json()['data']['id']
    assert create.json()['data']['externalProfile']['syncStatus'] == 'certificate_pending'

    upload = client.post(
        '/v1/certificates',
        headers=headers,
        data={
            'name': 'Cert Later Signing',
            'partner': 'Cert Later',
            'usage': 'signing',
            'type': 'X.509',
            'environment': 'sandbox',
            'rawContent': '-----BEGIN CERTIFICATE-----\nFAKE-CERT\n-----END CERTIFICATE-----',
        },
    )
    assert upload.status_code == 200
    upload_body = upload.json()['data']
    assert upload_body['externalSync']['triggered'] is True
    assert upload_body['externalSync']['action'] == 'create'
    assert upload_body['externalSync']['syncStatus'] == 'synced'
    assert upload_body['externalSync']['certificateSyncStatus'] == 'synced'
    assert len(captured) == 1
    assert captured[0]['action'] == 'create'
    assert captured[0]['payload']['profile']['deliverySetting']['data'] == {
        'protocol': 'https',
        'targetHost': 'as2.cert.example.com',
        'targetPort': '9500',
        'urlPath': '/receive',
    }
    assert captured[0]['payload']['profile']['ediint']['data'] == {
        'as2Id': 'CERT1-AS2',
        'as2Url': 'https://as2.cert.example.com/receive',
        'senderId': 'UNIS-CERT1',
        'senderQualifier': 'ZZ',
        'receiverId': 'CERT1-RECV',
        'receiverQualifier': '12',
        'mdnMode': 'SYNC',
        'signingRequired': True,
        'encryptionRequired': True,
    }
    assert captured[0]['payload']['profile']['certificate']['operation'] == 'C'
    assert captured[0]['payload']['profile']['certificate']['data']['certificateName'] == 'Cert Later Signing'

    get_partner = client.get(f'/v1/partners/{partner_id}')
    assert get_partner.status_code == 200
    body = get_partner.json()['data']
    assert body['externalProfile']['syncStatus'] == 'synced'
    assert body['externalProfile']['partnerSyncStatus'] == 'synced'
    assert body['externalProfile']['certificateSyncStatus'] == 'synced'
    assert body['externalProfile']['lastWarning'] is None


def test_update_as2_profile_allows_as2_id_changes(client, monkeypatch):
    headers = _auth(client)
    captured: list[dict] = []
    _install_sync_stub(monkeypatch, captured)

    create = client.post(
        '/v1/partners',
        headers=headers,
        json={
            'name': 'AS2 Editable',
            'code': 'AS2E1',
            'status': 'active',
            'primaryContact': {'name': 'EDI', 'email': 'as2e1@example.com'},
            'communicationChannel': 'AS2',
            'subsidiaries': [
                {
                    'name': 'AS2 Editable US',
                    'code': 'AS2E1-US',
                    'region': 'US',
                    'supportedDocTypes': {'x12': ['850'], 'edifact': []},
                    'as2Profiles': [
                        {
                            'name': 'Primary',
                            'as2Id': 'AS2E1-OLD',
                            'as2Url': 'https://as2.editable.example.com/receive',
                            'as2Port': 443,
                            'senderId': 'UNIS',
                            'senderQualifier': 'ZZ',
                            'receiverId': 'AS2E1',
                            'receiverQualifier': '12',
                        }
                    ],
                }
            ],
        },
    )
    assert create.status_code == 200
    body = create.json()['data']
    subsidiary_id = body['subsidiaries'][0]['id']
    profile_id = body['subsidiaries'][0]['as2Profiles'][0]['id']

    update = client.put(
        f'/v1/partners/{body["id"]}/subsidiaries/{subsidiary_id}/as2-profiles/{profile_id}',
        headers=headers,
        json={
            'name': 'Primary Updated',
            'as2Id': 'AS2E1-NEW',
            'as2Url': 'https://as2.editable.example.com/new-receive',
            'as2Port': 8443,
            'senderId': 'UNIS-NEW',
            'senderQualifier': 'ZZ',
            'receiverId': 'AS2E1-NEW',
            'receiverQualifier': '12',
        },
    )
    assert update.status_code == 200
    updated = update.json()['data']
    assert updated['as2Id'] == 'AS2E1-NEW'
    assert updated['as2Url'] == 'https://as2.editable.example.com/new-receive'


def test_upload_certificate_surfaces_local_as2_validation_error_for_stale_partner_data(client):
    headers = _auth(client)

    create = client.post(
        '/v1/partners',
        headers=headers,
        json={
            'name': 'Needs Fix',
            'code': 'FIX1',
            'status': 'active',
            'primaryContact': {'name': 'EDI', 'email': 'fix1@example.com'},
            'communicationChannel': 'AS2',
            'subsidiaries': [
                {
                    'name': 'Needs Fix US',
                    'code': 'FIX1-US',
                    'region': 'US',
                    'supportedDocTypes': {'x12': ['850'], 'edifact': []},
                    'as2Profiles': [
                        {
                            'name': 'Primary',
                            'as2Id': 'FIX1-AS2',
                            'as2Url': 'https://as2.fix.example.com/receive',
                            'as2Port': 443,
                            'senderId': 'UNIS',
                            'senderQualifier': 'ZZ',
                            'receiverId': 'FIX1',
                            'receiverQualifier': '12',
                        }
                    ],
                }
            ],
        },
    )
    assert create.status_code == 200
    partner_id = create.json()['data']['id']

    db = SessionLocal()
    try:
        profile = db.query(AS2Profile).filter(AS2Profile.as2_id == 'FIX1-AS2').first()
        assert profile is not None
        profile.as2_url = 'broken-as2-endpoint'
        db.commit()
    finally:
        db.close()

    upload = client.post(
        '/v1/certificates',
        headers=headers,
        data={
            'name': 'Needs Fix Signing',
            'partner': 'Needs Fix',
            'usage': 'signing',
            'type': 'X.509',
            'environment': 'sandbox',
            'rawContent': '-----BEGIN CERTIFICATE-----\nFAKE-CERT\n-----END CERTIFICATE-----',
        },
    )
    assert upload.status_code == 200
    body = upload.json()['data']
    assert body['externalSync']['triggered'] is True
    assert body['externalSync']['syncStatus'] == 'failed'
    assert body['externalSync']['lastError'] == 'AS2 endpoint URL must be a valid http(s) URL before external sync'

    get_partner = client.get(f'/v1/partners/{partner_id}')
    assert get_partner.status_code == 200
    assert get_partner.json()['data']['externalProfile']['lastError'] == 'AS2 endpoint URL must be a valid http(s) URL before external sync'


def test_upload_certificate_links_to_partner_by_name_without_environment_split(client, monkeypatch):
    headers = _auth(client)
    captured: list[dict] = []
    _install_sync_stub(monkeypatch, captured)

    create = client.post(
        '/v1/partners',
        headers=headers,
        json={
            'name': 'Shared Partner',
            'code': 'SHARE1',
            'status': 'active',
            'primaryContact': {'name': 'EDI', 'email': 'shared@example.com'},
            'communicationChannel': 'AS2',
            'environment': 'production',
            'subsidiaries': [
                {
                    'name': 'Shared Partner US',
                    'code': 'SHARE1-US',
                    'region': 'US',
                    'supportedDocTypes': {'x12': ['850'], 'edifact': []},
                    'as2Profiles': [
                        {
                            'name': 'Primary',
                            'as2Id': 'SHARE1-AS2',
                            'as2Url': 'https://as2.shared.example.com/receive',
                            'as2Port': 443,
                            'senderId': 'UNIS',
                            'senderQualifier': 'ZZ',
                            'receiverId': 'SHARE1',
                            'receiverQualifier': '12',
                        }
                    ],
                }
            ],
        },
    )
    assert create.status_code == 200

    upload = client.post(
        '/v1/certificates',
        headers=headers,
        data={
            'name': 'Shared Partner Sandbox Cert',
            'partner': 'Shared Partner',
            'usage': 'AS2 Communication',
            'type': 'X.509',
            'environment': 'sandbox',
            'rawContent': '-----BEGIN CERTIFICATE-----\nFAKE-SANDBOX-CERT\n-----END CERTIFICATE-----',
        },
    )
    assert upload.status_code == 200
    body = upload.json()['data']
    assert body['externalSync']['triggered'] is True
    assert body['externalSync']['partnerName'] == 'Shared Partner'
    assert captured[-1]['action'] == 'create'
    assert captured[-1]['environment'] is None
    assert captured[-1]['payload']['profile']['certificate']['operation'] == 'C'


def test_failed_create_persists_external_partner_id_and_retry_uses_update(client, monkeypatch):
    headers = _auth(client)
    captured: list[dict] = []

    def fake_sync(db, partner, action, environment=None):
        payload, warning = build_partner_sync_payload(
            db,
            partner,
            action,
            request_id=f'req-{len(captured) + 1}',
            environment=environment,
        )
        captured.append({'action': action, 'payload': payload, 'partner_id': partner.id})
        if action == 'create':
            return SyncResult(
                ok=False,
                request_id=payload['requestId'],
                payload=payload,
                response_payload={'success': False, 'message': 'missing string', 'partnerId': 'ext-FIXED1'},
                http_status=200,
                error='missing string',
                action=action,
                environment=environment,
                external_partner_id='ext-FIXED1',
                warning=warning,
            )
        return SyncResult(
            ok=True,
            request_id=payload['requestId'],
            payload=payload,
            response_payload={'success': True, 'message': 'ok', 'partnerId': 'ext-FIXED1'},
            http_status=200,
            error=None,
            action=action,
            environment=environment,
            external_partner_id='ext-FIXED1',
            warning=warning,
        )

    monkeypatch.setattr(partners_router, 'sync_partner_to_external', fake_sync)
    monkeypatch.setattr(certificates_router, 'sync_partner_to_external', fake_sync)

    create = client.post(
        '/v1/partners',
        headers=headers,
        json={
            'name': 'Retry Me',
            'code': 'RETRY1',
            'primaryContact': {'name': 'EDI', 'email': 'retry@example.com'},
            'communicationChannel': 'REST_API',
            'integrationType': 'api',
            'apiConfig': {'baseUrl': 'https://partner.example.com/api'},
        },
    )
    assert create.status_code == 200
    partner_id = create.json()['data']['id']

    db = SessionLocal()
    try:
        partner = db.query(Partner).filter(Partner.id == partner_id).first()
        assert partner is not None
        assert partner.external_partner_id == 'ext-FIXED1'
        assert partner.external_pending_action == 'update'
    finally:
        db.close()

    retry = client.post(f'/v1/partners/{partner_id}/external-sync/retry', headers=headers)
    assert retry.status_code == 200
    assert captured[0]['action'] == 'create'
    assert captured[1]['action'] == 'update'
    assert captured[1]['payload']['partnerId'] == 'ext-FIXED1'


def test_decode_external_response_extracts_msgstr_and_nested_partner_id():
    response = httpx.Response(
        200,
        json={
            'newUserStatus': 'ERROR',
            'msgStr': '[ISS.0086.9063] Missing required value: string',
            'output': {
                'deliveryInfo': [
                    {
                        'PartnerID': 'm1e0j200jljddf9f0003h986',
                    }
                ]
            },
            'updateCount': 1,
        },
    )

    payload, warning = _decode_external_response(response)

    assert warning is None
    assert payload is not None
    assert payload['message'] == '[ISS.0086.9063] Missing required value: string'
    assert payload['partnerId'] == 'm1e0j200jljddf9f0003h986'
    assert payload['success'] is False


def test_partner_sync_target_uses_single_fallback_target(monkeypatch):
    monkeypatch.setattr(settings, 'partner_sync_url', '')
    monkeypatch.setattr(settings, 'partner_sync_username', '')
    monkeypatch.setattr(settings, 'partner_sync_password', '')
    monkeypatch.setattr(settings, 'partner_sync_sandbox_url', 'https://sandbox.example.com/manage')
    monkeypatch.setattr(settings, 'partner_sync_sandbox_username', 'sandbox-user')
    monkeypatch.setattr(settings, 'partner_sync_sandbox_password', 'sandbox-pass')
    monkeypatch.setattr(settings, 'partner_sync_production_url', 'https://production.example.com/manage')
    monkeypatch.setattr(settings, 'partner_sync_production_username', 'prod-user')
    monkeypatch.setattr(settings, 'partner_sync_production_password', 'prod-pass')

    sandbox_target = settings.partner_sync_target('sandbox')
    production_target = settings.partner_sync_target('production')

    assert sandbox_target['url'] == 'https://production.example.com/manage'
    assert sandbox_target['username'] == 'prod-user'
    assert production_target['url'] == 'https://production.example.com/manage'
    assert production_target['username'] == 'prod-user'


def test_delete_payload_uses_minimal_profile_sections(client, monkeypatch):
    headers = _auth(client)
    captured: list[dict] = []
    _install_sync_stub(monkeypatch, captured)

    create = client.post(
        '/v1/partners',
        headers=headers,
        json={
            'name': 'Delete Payload',
            'code': 'DELPAY',
            'primaryContact': {'name': 'EDI', 'email': 'delete-payload@example.com'},
            'communicationChannel': 'REST_API',
            'integrationType': 'api',
            'apiConfig': {'baseUrl': 'https://partner.example.com/api'},
        },
    )
    partner_id = create.json()['data']['id']

    delete = client.delete(f'/v1/partners/{partner_id}', headers=headers)

    assert delete.status_code == 200
    assert captured[-1]['action'] == 'delete'
    payload = captured[-1]['payload']
    assert payload['partnerId'] == 'ext-DELPAY'
    assert payload['lifecycle'] == 'DELETE'
    assert payload['profile']['externalIds'] == {'operation': 'N', 'data': []}
    assert payload['profile']['deliverySetting'] == {'operation': 'N', 'data': {}}
    assert payload['profile']['ediint'] == {'operation': 'N', 'data': {}}
    assert payload['profile']['certificate'] == {'operation': 'N', 'data': {}}


def test_delete_without_external_partner_id_after_sync_attempt_keeps_partner(client):
    headers = _auth(client)

    create = client.post(
        '/v1/partners',
        headers=headers,
        json={
            'name': 'Orphan Remote',
            'code': 'ORPHAN1',
            'primaryContact': {'name': 'EDI', 'email': 'orphan@example.com'},
            'communicationChannel': 'REST_API',
            'integrationType': 'api',
            'apiConfig': {'baseUrl': 'https://partner.example.com/api'},
        },
    )
    assert create.status_code == 200
    partner_id = create.json()['data']['id']

    db = SessionLocal()
    try:
        partner = db.query(Partner).filter(Partner.id == partner_id).first()
        assert partner is not None
        partner.external_partner_id = None
        partner.external_sync_status = 'failed'
        partner.external_partner_sync_status = 'failed'
        partner.external_certificate_sync_status = 'not_required'
        partner.external_last_attempt_at = partner.created_at
        partner.external_last_error = 'missing string'
        db.commit()
    finally:
        db.close()

    delete = client.delete(f'/v1/partners/{partner_id}', headers=headers)

    assert delete.status_code == 200
    body = delete.json()
    assert body['success'] is True
    assert body['data']['deleted'] is False
    assert body['data']['partner']['externalProfile']['lastError'] == 'External partner id is missing; partner was retained so remote deletion can be checked manually'

    still_exists = client.get(f'/v1/partners/{partner_id}')
    assert still_exists.status_code == 200
    assert still_exists.json()['success'] is True


def test_delete_failure_retains_partner_and_retry_removes_it(client, monkeypatch):
    headers = _auth(client)
    captured: list[dict] = []
    _install_sync_stub(monkeypatch, captured, mode='delete_retry')

    create = client.post(
        '/v1/partners',
        headers=headers,
        json={
            'name': 'Delete Me',
            'code': 'DEL1',
            'primaryContact': {'name': 'EDI', 'email': 'del@example.com'},
            'communicationChannel': 'REST_API',
            'integrationType': 'api',
            'environment': 'sandbox',
            'apiConfig': {'baseUrl': 'https://partner.example.com/api'},
        },
    )
    partner_id = create.json()['data']['id']

    delete = client.delete(f'/v1/partners/{partner_id}', headers=headers)
    assert delete.status_code == 200
    assert delete.json()['data']['deleted'] is False
    assert delete.json()['data']['partner']['externalProfile']['pendingAction'] == 'delete'
    assert delete.json()['data']['partner']['externalProfile']['syncStatus'] == 'failed'

    get_after_failed_delete = client.get(f'/v1/partners/{partner_id}')
    assert get_after_failed_delete.status_code == 200
    assert get_after_failed_delete.json()['success'] is True

    retry = client.post(f'/v1/partners/{partner_id}/external-sync/retry', headers=headers)
    assert retry.status_code == 200
    assert retry.json()['data']['deleted'] is True

    missing = client.get(f'/v1/partners/{partner_id}')
    assert missing.status_code == 200
    assert missing.json()['success'] is False
