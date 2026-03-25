from io import BytesIO
from uuid import uuid4


def _auth(client):
    email = f'domain-{uuid4().hex[:8]}@example.com'
    res = client.post(
        '/v1/auth/register',
        json={
            'name': 'Domain User',
            'email': email,
            'password': 'Password1',
            'confirmPassword': 'Password1',
        },
    )
    assert res.status_code == 200
    assert res.json()['success'] is True
    csrf = client.cookies.get('edi_csrf')
    assert csrf
    return {'x-csrf-token': csrf}


def test_csrf_required_for_mutation(client):
    _auth(client)
    no_csrf = client.post('/v1/partners', json={'name': 'A', 'code': 'A'})
    assert no_csrf.status_code == 403


def test_partners_crud_flow(client):
    headers = _auth(client)
    create = client.post(
        '/v1/partners',
        headers=headers,
        json={
            'name': 'Target',
            'code': 'TGT',
            'status': 'active',
            'industry': 'retail',
            'primaryContact': {'name': 'EDI', 'email': 'edi@target.com'},
            'subsidiaries': [
                {
                    'name': 'Target US',
                    'code': 'TGT-US',
                    'region': 'US',
                    'status': 'active',
                    'supportedDocTypes': {'x12': ['850'], 'edifact': []},
                    'as2Profiles': [
                        {
                            'name': 'Primary',
                            'as2Id': 'TGT-AS2',
                            'as2Url': 'https://example.com/as2',
                            'as2Port': 443,
                            'senderId': 'UNIS-SENDER',
                            'senderQualifier': 'ZZ',
                            'receiverId': 'TGT-RECEIVER',
                            'receiverQualifier': '12',
                            'status': 'active',
                        }
                    ],
                }
            ],
        },
    )
    assert create.status_code == 200
    body = create.json()
    assert body['success'] is True
    pid = body['data']['id']
    profile = body['data']['subsidiaries'][0]['as2Profiles'][0]
    assert profile['as2Port'] == 443
    assert profile['senderId'] == 'UNIS-SENDER'
    assert profile['senderQualifier'] == 'ZZ'
    assert profile['receiverId'] == 'TGT-RECEIVER'
    assert profile['receiverQualifier'] == '12'

    list_res = client.get('/v1/partners?environment=production')
    assert list_res.status_code == 200
    assert list_res.json()['success'] is True
    listed_profile = list_res.json()['data'][0]['subsidiaries'][0]['as2Profiles'][0]
    assert listed_profile['as2Port'] == 443
    assert listed_profile['senderId'] == 'UNIS-SENDER'
    assert listed_profile['senderQualifier'] == 'ZZ'
    assert listed_profile['receiverId'] == 'TGT-RECEIVER'
    assert listed_profile['receiverQualifier'] == '12'

    update = client.put(f'/v1/partners/{pid}', headers=headers, json={'status': 'inactive'})
    assert update.status_code == 200
    assert update.json()['data']['status'] == 'inactive'

    delete = client.delete(f'/v1/partners/{pid}', headers=headers)
    assert delete.status_code == 200
    assert delete.json()['success'] is True


def test_partner_as2_profile_requires_port_and_ids(client):
    headers = _auth(client)
    create = client.post(
        '/v1/partners',
        headers=headers,
        json={
            'name': 'Bad AS2 Partner',
            'code': 'BAP',
            'status': 'active',
            'industry': 'retail',
            'primaryContact': {'name': 'EDI', 'email': 'edi@bad.com'},
            'subsidiaries': [
                {
                    'name': 'Bad AS2 Sub',
                    'code': 'BAP-US',
                    'region': 'US',
                    'status': 'active',
                    'supportedDocTypes': {'x12': ['850'], 'edifact': []},
                    'as2Profiles': [
                        {
                            'name': 'Primary',
                            'as2Id': 'BAD-AS2',
                            'as2Url': 'https://example.com/as2',
                            'senderQualifier': 'ZZ',
                            'receiverQualifier': 'ZZ',
                            'status': 'active',
                        }
                    ],
                }
            ],
        },
    )
    assert create.status_code == 200
    assert create.json()['success'] is False
    assert create.json()['code'] == 'PARTNER_VALIDATION'


def test_update_partner_as2_profile_fields(client):
    headers = _auth(client)
    create = client.post(
        '/v1/partners',
        headers=headers,
        json={
            'name': 'Editable AS2 Partner',
            'code': 'EAP',
            'status': 'active',
            'industry': 'retail',
            'primaryContact': {'name': 'EDI', 'email': 'edi@editable.com'},
            'subsidiaries': [
                {
                    'name': 'Editable AS2 Sub',
                    'code': 'EAP-US',
                    'region': 'US',
                    'status': 'active',
                    'supportedDocTypes': {'x12': ['850'], 'edifact': []},
                    'as2Profiles': [
                        {
                            'name': 'Primary',
                            'as2Id': 'EAP-AS2',
                            'as2Url': 'https://example.com/as2',
                            'as2Port': 443,
                            'senderId': 'UNIS-SENDER',
                            'senderQualifier': 'ZZ',
                            'receiverId': 'EAP-RECEIVER',
                            'receiverQualifier': '12',
                            'status': 'active',
                        }
                    ],
                }
            ],
        },
    )
    assert create.status_code == 200
    pid = create.json()['data']['id']
    sid = create.json()['data']['subsidiaries'][0]['id']
    profile_id = create.json()['data']['subsidiaries'][0]['as2Profiles'][0]['id']

    update = client.put(
        f'/v1/partners/{pid}/subsidiaries/{sid}/as2-profiles/{profile_id}',
        headers=headers,
        json={
            'name': 'Primary Updated',
            'as2Url': 'https://partner.example.com/as2/inbound',
            'as2Port': 8443,
            'senderId': 'UNIS-NEW',
            'senderQualifier': '14',
            'receiverId': 'PARTNER-NEW',
            'receiverQualifier': 'ZZ',
        },
    )
    assert update.status_code == 200
    assert update.json()['success'] is True
    profile = update.json()['data']
    assert profile['name'] == 'Primary Updated'
    assert profile['as2Url'] == 'https://partner.example.com/as2/inbound'
    assert profile['as2Port'] == 8443
    assert profile['senderId'] == 'UNIS-NEW'
    assert profile['senderQualifier'] == '14'
    assert profile['receiverId'] == 'PARTNER-NEW'
    assert profile['receiverQualifier'] == 'ZZ'

    get_partner = client.get(f'/v1/partners/{pid}')
    assert get_partner.status_code == 200
    stored = get_partner.json()['data']['subsidiaries'][0]['as2Profiles'][0]
    assert stored['as2Port'] == 8443
    assert stored['senderId'] == 'UNIS-NEW'
    assert stored['senderQualifier'] == '14'
    assert stored['receiverId'] == 'PARTNER-NEW'
    assert stored['receiverQualifier'] == 'ZZ'


def test_certificates_transactions_notifications_specs(client):
    headers = _auth(client)

    cert_create = client.post(
        '/v1/certificates',
        headers=headers,
        data={
            'name': 'Cert A',
            'partner': 'Walmart',
            'usage': 'Signing',
            'type': 'X.509',
            'environment': 'production',
        },
        files={'file': ('cert.pem', BytesIO(b'test cert content'), 'application/x-pem-file')},
    )
    assert cert_create.status_code == 200
    assert cert_create.json()['success'] is True
    cert_id = cert_create.json()['data']['id']
    cert_dl = client.get(f'/v1/certificates/{cert_id}/download')
    assert cert_dl.status_code == 200
    assert len(cert_dl.content) > 0

    cert_bad = client.post(
        '/v1/certificates',
        headers=headers,
        data={'name': 'Bad', 'partner': 'Walmart', 'usage': 'Signing', 'environment': 'production'},
        files={'file': ('cert.txt', BytesIO(b'bad'), 'text/plain')},
    )
    assert cert_bad.status_code == 200
    assert cert_bad.json()['success'] is False

    trx_create = client.post(
        '/v1/transactions',
        headers=headers,
        data={'type': '850', 'partner': 'Walmart', 'environment': 'production'},
        files={'file': ('trx.edi', BytesIO(b'ISA*00*...~'), 'text/plain')},
    )
    assert trx_create.status_code == 200
    assert trx_create.json()['success'] is True

    trx_list = client.get('/v1/transactions?environment=production')
    assert trx_list.status_code == 200
    assert trx_list.json()['success'] is True

    mark_all = client.put('/v1/notifications/mark-all-read', headers=headers, json={'environment': 'production'})
    assert mark_all.status_code == 200
    assert mark_all.json()['success'] is True

    spec_create = client.post(
        '/v1/specifications',
        headers=headers,
        json={
            'messageType': '850',
            'messageName': 'Purchase Order',
            'partner': 'Walmart',
            'partnerCode': 'WMT',
            'version': '5010-WMT-2026',
            'fileType': 'PDF',
            'fileName': 'wmt_850.pdf',
            'size': '1 MB',
        },
    )
    assert spec_create.status_code == 200
    assert spec_create.json()['success'] is True

    spec_list = client.get('/v1/specifications?section=tp&partner=WMT')
    assert spec_list.status_code == 200
    assert spec_list.json()['success'] is True
    assert len(spec_list.json()['data']) >= 1

    spec_filter = client.get('/v1/specifications?section=tp&partnerCode=WMT&messageType=850')
    assert spec_filter.status_code == 200
    assert spec_filter.json()['success'] is True
    assert all(x['partnerCode'] == 'WMT' and x['messageType'] == '850' for x in spec_filter.json()['data'])

    cert_inactive = client.put(f'/v1/certificates/{cert_id}', headers=headers, json={'status': 'inactive'})
    assert cert_inactive.status_code == 200
    assert cert_inactive.json()['data']['status'] == 'inactive'


def test_certificate_can_be_created_with_raw_content_only(client):
    headers = _auth(client)
    pem_text = """-----BEGIN CERTIFICATE-----
MIIBszCCAVmgAwIBAgIUQ2VydGlmaWNhdGVUZXN0RGF0YTAKBggqhkjOPQQDAjASMRAw
DgYDVQQDDAdUZXN0Q0EwHhcNMjYwMzI1MDAwMDAwWhcNMjcwMzI1MDAwMDAwWjASMRAw
DgYDVQQDDAdUZXN0Q0EwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAARWlP7qVsm3M8IB
0J6D1eJ5kY0PZ3f2bR8oK5mG8s4Ht2v5jC8c3yM2wN6Kx0lQJgV2y9m4J8p7B3nD1d2F
q7o3o1MwUTAdBgNVHQ4EFgQUY2VydC10ZXN0LWZpbmdlcnByaW50MB8GA1UdIwQYMBaA
FGNlcnQtdGVzdC1maW5nZXJwcmludDATBgNVHSUEDDAKBggrBgEFBQcDATAKBggqhkjO
PQQDAgNHADBEAiAqQm1vY2stY2VydC1jb250ZW50LXRlc3QxAiBtb2NrLXNpZ25hdHVy
ZS1jb250ZW50LXRlc3Q=
-----END CERTIFICATE-----"""
    cert_create = client.post(
        '/v1/certificates',
        headers=headers,
        data={
            'name': 'Raw PEM Cert',
            'partner': 'Walmart',
            'usage': 'Signing',
            'type': 'PEM',
            'environment': 'production',
            'rawContent': pem_text,
        },
    )
    assert cert_create.status_code == 200
    assert cert_create.json()['success'] is True
    cert_id = cert_create.json()['data']['id']
    assert cert_create.json()['data']['rawContent'] == pem_text

    cert_get = client.get(f'/v1/certificates/{cert_id}')
    assert cert_get.status_code == 200
    assert cert_get.json()['data']['rawContent'] == pem_text


def test_routing_rule_validation_and_update(client):
    headers = _auth(client)
    create = client.post(
        '/v1/partners',
        headers=headers,
        json={
            'name': 'Route Partner',
            'code': 'RTP',
            'status': 'active',
            'industry': 'retail',
            'primaryContact': {'name': 'EDI', 'email': 'edi@route.com'},
            'subsidiaries': [
                {
                    'name': 'Route Sub',
                    'code': 'RTP-US',
                    'region': 'US',
                    'status': 'active',
                    'supportedDocTypes': {'x12': ['856'], 'edifact': []},
                    'as2Profiles': [],
                }
            ],
        },
    )
    assert create.status_code == 200
    pid = create.json()['data']['id']
    sid = create.json()['data']['subsidiaries'][0]['id']

    bad = client.put(
        f'/v1/partners/{pid}/subsidiaries/{sid}/routing',
        headers=headers,
        json={
            'enabledTypes': [{'messageType': '856', 'enabled': True}],
            'rules': [
                {
                    'id': 'r1',
                    'messageType': '856',
                    'messageName': 'ASN',
                    'routingType': 'specific_partner',
                    'enabled': True,
                }
            ],
        },
    )
    assert bad.status_code == 400

    good = client.put(
        f'/v1/partners/{pid}/subsidiaries/{sid}/routing',
        headers=headers,
        json={
            'enabledTypes': [{'messageType': '856', 'messageName': 'ASN', 'direction': 'outbound', 'enabled': True}],
            'rules': [
                {
                    'id': 'r1',
                    'messageType': '856',
                    'messageName': 'ASN',
                    'routingType': 'specific_partner',
                    'targetPartner': 'Walmart',
                    'targetSubsidiary': 'WMT-US',
                    'enabled': True,
                }
            ],
        },
    )
    assert good.status_code == 200
    assert good.json()['success'] is True

    get_rule = client.get(f'/v1/partners/{pid}/subsidiaries/{sid}/routing')
    assert get_rule.status_code == 200
    assert get_rule.json()['success'] is True
    assert get_rule.json()['data']['rules'][0]['routingType'] == 'specific_partner'


def test_specification_file_type_validation(client):
    headers = _auth(client)
    bad = client.post(
        '/v1/specifications',
        headers=headers,
        json={
            'messageType': '850',
            'messageName': 'Purchase Order',
            'partner': 'Walmart',
            'partnerCode': 'WMT',
            'version': 'bad-type',
            'fileType': 'DOCX',
            'fileName': 'wmt_850.docx',
            'size': '5 KB',
        },
    )
    assert bad.status_code == 200
    assert bad.json()['success'] is False
    assert bad.json()['code'] == 'SPEC_INVALID_FILE_TYPE'


def test_specification_upload_and_download(client):
    headers = _auth(client)
    upload = client.post(
        '/v1/specifications/upload',
        headers=headers,
        data={
            'messageType': '856',
            'messageName': 'Advance Ship Notice',
            'partner': 'Target',
            'partnerCode': 'TGT',
            'version': '5010-TGT-2026',
        },
        files={'file': ('tgt_856.pdf', BytesIO(b'%PDF-test%'), 'application/pdf')},
    )
    assert upload.status_code == 200
    assert upload.json()['success'] is True
    spec_id = upload.json()['data']['id']

    dl = client.get(f'/v1/specifications/{spec_id}/download')
    assert dl.status_code == 200
    assert len(dl.content) > 0
