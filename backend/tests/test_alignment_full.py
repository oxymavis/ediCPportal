from __future__ import annotations

from uuid import uuid4
from sqlalchemy.orm import Session
from passlib.hash import pbkdf2_sha256

from app.db.session import SessionLocal
from app.models import User


def _auth(client):
    email = f"align-{uuid4().hex[:8]}@example.com"
    r = client.post(
        '/v1/auth/register',
        json={
            'name': 'Align User',
            'email': email,
            'password': 'StrongPass1',
            'confirmPassword': 'StrongPass1',
        },
    )
    assert r.status_code == 200
    assert r.json().get('success') is True
    csrf = next((c.value for c in client.cookies.jar if c.name == 'edi_csrf'), None)
    assert csrf
    return {'x-csrf-token': csrf}


def test_partner_lifecycle_and_api_config_validation(client):
    headers = _auth(client)
    create = client.post(
        '/v1/partners',
        headers=headers,
        json={
            'name': 'API Partner',
            'code': 'API1',
            'integrationType': 'api',
            'communicationChannel': 'REST_API',
            'primaryContact': {'name': 'A', 'email': 'a@example.com'},
            'apiConfig': {'baseUrl': 'https://api.example.com', 'authMethod': 'OAuth 2.0', 'apiKey': 'secret'},
        },
    )
    assert create.status_code == 200 and create.json()['success'] is True
    pid = create.json()['data']['id']
    assert create.json()['data']['lifecycle']['currentStepId'] == 1

    advance = client.post(f'/v1/partners/{pid}/lifecycle/advance', headers=headers)
    assert advance.status_code == 200
    assert advance.json()['data']['lifecycle']['currentStepId'] == 2

    validate = client.post(
        f'/v1/partners/{pid}/api-config/validate',
        headers=headers,
        json={'baseUrl': 'https://api.example.com', 'authMethod': 'OAuth 2.0', 'apiKey': 'secret'},
    )
    assert validate.status_code == 200
    assert validate.json()['data']['maskedConfig']['apiKey'] == '***MASKED***'


def test_api_docs_crud_and_queries(client):
    headers = _auth(client)
    create = client.post(
        '/v1/api-docs/messages',
        headers=headers,
        json={'code': 'POX', 'name': 'PurchaseOrderX', 'category': 'Order', 'x12Equivalent': '850', 'version': 'v1'},
    )
    assert create.status_code == 200 and create.json()['success'] is True
    list_res = client.get('/v1/api-docs/messages?search=POX')
    assert list_res.status_code == 200
    assert any(x['code'] == 'POX' for x in list_res.json()['data'])
    detail = client.get('/v1/api-docs/messages/POX')
    assert detail.status_code == 200 and detail.json()['data']['name'] == 'PurchaseOrderX'


def test_connection_testing_and_reports(client):
    headers = _auth(client)
    as2 = client.post(
        '/v1/connection-testing/as2/run',
        headers=headers,
        json={'environment': 'sandbox', 'host': 'localhost', 'port': 443, 'as2Id': 'TEST-AS2'},
    )
    assert as2.status_code == 200 and as2.json()['success'] is True
    run_id = as2.json()['data']['runId']
    run_detail = client.get(f'/v1/connection-testing/runs/{run_id}')
    assert run_detail.status_code == 200
    assert len(run_detail.json()['data']['steps']) == 7

    api_run = client.post(
        '/v1/connection-testing/api/run',
        headers=headers,
        json={'environment': 'sandbox', 'endpoint': 'https://httpbin.org/get', 'auth': 'oauth2', 'samplePayload': {'id': 1}},
    )
    assert api_run.status_code == 200 and api_run.json()['success'] is True

    doc = client.post(
        '/v1/connection-testing/document-tests',
        headers=headers,
        json={'environment': 'sandbox', 'messageType': '850', 'payload': {'orderNo': '1'}, 'errors': []},
    )
    assert doc.status_code == 200
    doc_id = doc.json()['data']['id']
    assert client.get(f'/v1/connection-testing/document-tests/{doc_id}').status_code == 200

    val = client.post('/v1/connection-testing/validator/validate', headers=headers, json={'format': 'json', 'content': '{"a":1}'})
    assert val.status_code == 200
    assert val.json()['data']['valid'] is True


def test_transactions_export_and_filters(client):
    headers = _auth(client)
    created = client.post(
        '/v1/transactions',
        headers=headers,
        files={'file': ('doc.edi', b'ISA*00*...~')},
        data={'type': '850', 'partner': 'WMT', 'environment': 'production', 'integrationType': 'api', 'channel': 'REST_API'},
    )
    assert created.status_code == 200 and created.json()['success'] is True
    listed = client.get('/v1/transactions?integrationType=api&channel=REST_API')
    assert listed.status_code == 200 and listed.json()['success'] is True
    assert len(listed.json()['data']) >= 1
    export = client.get('/v1/transactions/export?format=csv')
    assert export.status_code == 200
    assert 'text/csv' in export.headers.get('content-type', '')


def test_notification_sse_and_bcrypt_progressive_migration(client):
    # seed legacy pbkdf2 user
    db: Session = SessionLocal()
    try:
        legacy = User(
            id='legacy-user',
            name='Legacy',
            email='legacy@example.com',
            password_hash=pbkdf2_sha256.hash('LegacyPass1'),
            password_algo='pbkdf2',
            email_verified=True,
        )
        db.merge(legacy)
        db.commit()
    finally:
        db.close()

    login = client.post('/v1/auth/login', json={'email': 'legacy@example.com', 'password': 'LegacyPass1'})
    assert login.status_code == 200 and login.json()['success'] is True

    db = SessionLocal()
    try:
        u = db.query(User).filter(User.email == 'legacy@example.com').first()
        assert u is not None
        assert u.password_algo == 'bcrypt'
    finally:
        db.close()

    stream = client.get('/v1/notifications/stream?environment=production')
    assert stream.status_code == 200
    assert stream.headers.get('content-type', '').startswith('text/event-stream')
