from __future__ import annotations

import json
import socket
import ssl
import time
from base64 import b64decode
from datetime import datetime
from urllib.parse import urlparse
from uuid import uuid4
from xml.etree import ElementTree

import httpx
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.db.session import get_db
from app.models import ConnectionTestRun, ConnectionTestStep, DocumentTestReport, Partner, Subsidiary, ValidatorReport
from app.schemas.common import fail, ok
from app.services.deps import get_actor, require_csrf, require_scope

router = APIRouter(
    prefix='/v1/connection-testing',
    tags=['connection-testing'],
    dependencies=[Depends(get_actor), Depends(require_scope('integrations'))],
)


def _store_step(db: Session, run_id: str, step_no: int, name: str, status: str, latency_ms: int, detail: str, evidence: dict):
    db.add(
        ConnectionTestStep(
            run_id=run_id,
            step_no=step_no,
            name=name,
            status=status,
            latency_ms=latency_ms,
            detail=detail[:500],
            evidence=evidence,
        )
    )


def _check_partner_for_test(db: Session, partner_id: str | None, expected_type: str) -> tuple[Partner | None, dict | None]:
    if not partner_id:
        return None, None
    partner = (
        db.query(Partner)
        .options(joinedload(Partner.subsidiaries).joinedload(Subsidiary.as2_profiles))
        .filter(Partner.id == partner_id)
        .first()
    )
    if not partner:
        return None, fail('Partner not found', 'PARTNER_NOT_FOUND')
    if (partner.integration_type or 'edi') != expected_type:
        return None, fail(
            f'Partner integrationType is {partner.integration_type}; {expected_type.upper()} test is not allowed',
            'CONN_PARTNER_TYPE_MISMATCH',
        )
    return partner, None


def _as2_steps(host: str, port: int, as2_id: str, payload: dict) -> list[tuple[str, callable]]:
    def dns():
        infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
        return {'resolved': len(infos) > 0, 'addresses': list({x[4][0] for x in infos})[:5]}

    def tls():
        ctx = ssl.create_default_context()
        with socket.create_connection((host, port), timeout=5) as sock:
            with ctx.wrap_socket(sock, server_hostname=host) as ssock:
                cert = ssock.getpeercert()
                cipher = ssock.cipher()
                return {'subject': cert.get('subject'), 'issuer': cert.get('issuer'), 'cipher': cipher[0] if cipher else None}

    def as2_identifier():
        return {'valid': bool(as2_id and len(as2_id) >= 3)}

    def signature_check():
        data = payload.get('signedPayload')
        signature_b64 = payload.get('signatureBase64')
        cert_pem = payload.get('signerCertPem')
        if not data or not signature_b64 or not cert_pem:
            return {'valid': False, 'reason': 'signedPayload/signatureBase64/signerCertPem required'}
        cert = x509.load_pem_x509_certificate(cert_pem.encode('utf-8'))
        public_key = cert.public_key()
        public_key.verify(
            b64decode(signature_b64),
            data.encode('utf-8'),
            padding.PKCS1v15(),
            hashes.SHA256(),
        )
        return {'valid': True, 'algorithm': 'RSA-SHA256'}

    def encryption_check():
        ciphertext_b64 = payload.get('encryptedBase64')
        private_key_pem = payload.get('decryptPrivateKeyPem')
        passphrase = payload.get('decryptPrivateKeyPassphrase')
        if not ciphertext_b64 or not private_key_pem:
            return {'valid': False, 'reason': 'encryptedBase64/decryptPrivateKeyPem required'}
        private_key = serialization.load_pem_private_key(
            private_key_pem.encode('utf-8'),
            password=(passphrase.encode('utf-8') if passphrase else None),
        )
        plaintext = private_key.decrypt(
            b64decode(ciphertext_b64),
            padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA256()), algorithm=hashes.SHA256(), label=None),
        )
        return {'valid': len(plaintext) > 0, 'plaintextLength': len(plaintext)}

    def mdn_roundtrip():
        mdn_url = payload.get('mdnUrl')
        if not mdn_url:
            return {'valid': False, 'reason': 'mdnUrl required'}
        with httpx.Client(timeout=8.0) as client:
            resp = client.post(mdn_url, headers={'content-type': 'message/disposition-notification'}, content='Disposition: automatic-action/MDN-sent-automatically; processed')
        return {'valid': 200 <= resp.status_code < 300, 'statusCode': resp.status_code}

    def functional_ack():
        ack_url = payload.get('ackUrl')
        if not ack_url:
            return {'valid': False, 'reason': 'ackUrl required'}
        with httpx.Client(timeout=8.0) as client:
            resp = client.get(ack_url)
        body = resp.text or ''
        return {'valid': (200 <= resp.status_code < 300) and ('997' in body or 'ACK' in body.upper()), 'statusCode': resp.status_code}

    return [
        ('DNS Reachability', dns),
        ('TLS Handshake', tls),
        ('AS2 Identifier Validation', as2_identifier),
        ('Signature Verification', signature_check),
        ('Encryption/Decryption Check', encryption_check),
        ('MDN Roundtrip', mdn_roundtrip),
        ('Functional ACK Check', functional_ack),
    ]


@router.post('/as2/run')
def run_as2_test(payload: dict, _csrf: None = Depends(require_csrf), db: Session = Depends(get_db), actor=Depends(get_actor)):
    env = payload.get('environment', 'default')

    partner, partner_err = _check_partner_for_test(db, payload.get('partnerId'), 'edi')
    if partner_err:
        return partner_err

    host = payload.get('host')
    as2_id = payload.get('as2Id') or ''
    if not host and partner:
        first_profile = None
        for sub in partner.subsidiaries:
            if sub.as2_profiles:
                first_profile = sub.as2_profiles[0]
                break
        if first_profile:
            parsed = urlparse(first_profile.as2_url or '')
            host = parsed.hostname
            as2_id = as2_id or first_profile.as2_id
            if not payload.get('port') and parsed.port:
                payload['port'] = parsed.port
    if not host:
        return fail('Missing required field: host', 'CONN_VALIDATION')
    port = int(payload.get('port') or 443)
    run_id = f'ctr-{uuid4().hex[:20]}'
    started = datetime.utcnow()
    run = ConnectionTestRun(id=run_id, partner_id=payload.get('partnerId'), test_type='as2', environment=env, status='processing', summary={}, started_at=started, trace_id=payload.get('traceId'))
    db.add(run)
    db.commit()

    passed = 0
    failed = 0
    for idx, (name, fn) in enumerate(_as2_steps(host, port, as2_id, payload), start=1):
        t0 = time.perf_counter()
        try:
            evidence = fn()
            latency = int((time.perf_counter() - t0) * 1000)
            status = 'passed' if evidence.get('valid', True) else 'failed'
            detail = 'ok' if status == 'passed' else 'validation failed'
        except Exception as exc:
            latency = int((time.perf_counter() - t0) * 1000)
            status = 'failed'
            evidence = {'error': str(exc)}
            detail = str(exc)
        if status == 'passed':
            passed += 1
        else:
            failed += 1
        _store_step(db, run_id, idx, name, status, latency, detail, evidence)

    run.status = 'passed' if failed == 0 else ('partial' if passed > 0 else 'failed')
    run.summary = {'passedSteps': passed, 'failedSteps': failed, 'totalSteps': 7}
    run.finished_at = datetime.utcnow()
    db.commit()
    return ok({'runId': run_id, 'status': run.status, 'summary': run.summary})


@router.post('/api/run')
def run_api_test(payload: dict, _csrf: None = Depends(require_csrf), db: Session = Depends(get_db), actor=Depends(get_actor)):
    env = payload.get('environment', 'default')

    partner, partner_err = _check_partner_for_test(db, payload.get('partnerId'), 'api')
    if partner_err:
        return partner_err

    endpoint = (
        payload.get('endpoint')
        or ((partner.api_config or {}).get('baseUrl') if partner else None)
        or settings.resolved_api_test_endpoint
    )
    if not endpoint:
        return fail('Missing endpoint for API connection test', 'CONN_VALIDATION')

    parsed_endpoint = urlparse(endpoint)
    if parsed_endpoint.scheme not in {'http', 'https'}:
        return fail('endpoint must be http/https', 'CONN_VALIDATION')

    run_id = f'ctr-{uuid4().hex[:20]}'
    run = ConnectionTestRun(
        id=run_id,
        partner_id=payload.get('partnerId'),
        test_type='api',
        environment=env,
        status='processing',
        summary={},
        started_at=datetime.utcnow(),
        trace_id=payload.get('traceId'),
    )
    db.add(run)
    db.commit()

    steps = []
    auth_mode = str(payload.get('auth') or 'oauth2').lower()
    token_holder: dict[str, str | None] = {'token': None}
    response_snapshot: dict[str, object] = {}

    def do_step(name: str, fn):
        t0 = time.perf_counter()
        try:
            ev = fn()
            latency = int((time.perf_counter() - t0) * 1000)
            st = 'passed' if ev.get('valid', True) else 'failed'
            msg = 'ok' if st == 'passed' else 'validation failed'
        except Exception as exc:
            latency = int((time.perf_counter() - t0) * 1000)
            st = 'failed'
            ev = {'error': str(exc)}
            msg = str(exc)
        steps.append((name, st, latency, msg, ev))

    def endpoint_reachability():
        infos = socket.getaddrinfo(parsed_endpoint.hostname or '', parsed_endpoint.port or 443, proto=socket.IPPROTO_TCP)
        return {'valid': len(infos) > 0, 'host': parsed_endpoint.hostname, 'resolved': list({x[4][0] for x in infos})[:5]}

    do_step('Endpoint Reachability', endpoint_reachability)

    def tls_cert_check():
        if parsed_endpoint.scheme != 'https':
            return {'valid': True, 'skipped': True, 'reason': 'non-https endpoint'}
        port = parsed_endpoint.port or 443
        ctx = ssl.create_default_context()
        with socket.create_connection((parsed_endpoint.hostname or '', port), timeout=6) as sock:
            with ctx.wrap_socket(sock, server_hostname=parsed_endpoint.hostname) as ssock:
                cert = ssock.getpeercert()
                return {'valid': True, 'issuer': cert.get('issuer'), 'subject': cert.get('subject')}

    do_step('TLS Certificate Check', tls_cert_check)

    def auth_prepare():
        if auth_mode == 'none':
            return {'valid': True, 'auth': 'none'}
        if auth_mode == 'oauth2':
            token = payload.get('oauthToken')
            token_url = payload.get('tokenUrl')
            client_id = payload.get('clientId')
            client_secret = payload.get('clientSecret')
            if not token and token_url and client_id and client_secret:
                with httpx.Client(timeout=8.0) as client:
                    resp = client.post(
                        str(token_url),
                        data={
                            'grant_type': 'client_credentials',
                            'client_id': str(client_id),
                            'client_secret': str(client_secret),
                        },
                    )
                    if resp.status_code < 400:
                        token = (resp.json() or {}).get('access_token')
            token_holder['token'] = str(token) if token else None
            return {'valid': True, 'auth': 'oauth2', 'tokenReady': bool(token_holder['token'])}
        if auth_mode == 'api-key':
            return {'valid': True, 'auth': 'api-key', 'apiKeyProvided': bool(payload.get('apiKey') or payload.get('xApiKey'))}
        return {'valid': False, 'reason': 'auth must be oauth2|api-key|none'}

    do_step('Auth Preparation', auth_prepare)

    def call_endpoint():
        request_headers: dict[str, str] = {}
        if auth_mode == 'oauth2' and token_holder['token']:
            request_headers['Authorization'] = f'Bearer {token_holder["token"]}'
        if auth_mode == 'api-key':
            api_key = payload.get('apiKey') or payload.get('xApiKey')
            if api_key:
                request_headers['x-api-key'] = str(api_key)

        sample = payload.get('samplePayload')
        with httpx.Client(timeout=6.0) as client:
            if isinstance(sample, dict):
                resp = client.post(endpoint, json=sample, headers=request_headers)
            else:
                resp = client.get(endpoint, headers=request_headers)
        response_snapshot['status'] = resp.status_code
        response_snapshot['contentType'] = resp.headers.get('content-type', '')
        response_snapshot['bodyPreview'] = (resp.text or '')[:200]
        valid = resp.status_code < 500 and (auth_mode == 'none' or resp.status_code not in {401, 403})
        return {
            'valid': valid,
            'statusCode': resp.status_code,
            'contentType': resp.headers.get('content-type'),
            'bodyPreview': response_snapshot['bodyPreview'],
        }

    do_step('Authenticated Request', call_endpoint)

    def schema_sanity():
        sample = payload.get('samplePayload', {})
        return {'valid': isinstance(sample, dict), 'sampleType': type(sample).__name__}

    do_step('Schema Sanity', schema_sanity)

    def response_contract():
        status_code = int(response_snapshot.get('status', 0) or 0)
        content_type = str(response_snapshot.get('contentType', ''))
        ok_status = 200 <= status_code < 500
        ok_type = ('json' in content_type.lower()) or ('text/' in content_type.lower()) or status_code == 204
        return {'valid': ok_status and ok_type, 'statusCode': status_code, 'contentType': content_type}

    do_step('Response Contract Check', response_contract)

    passed = 0
    failed = 0
    for idx, (name, st, latency, msg, ev) in enumerate(steps, start=1):
        if st == 'passed':
            passed += 1
        else:
            failed += 1
        _store_step(db, run_id, idx, name, st, latency, msg, ev)

    run.status = 'passed' if failed == 0 else ('partial' if passed > 0 else 'failed')
    run.summary = {
        'passedSteps': passed,
        'failedSteps': failed,
        'totalSteps': len(steps),
        'endpoint': endpoint,
        'auth': auth_mode,
    }
    run.finished_at = datetime.utcnow()
    db.commit()
    return ok({'runId': run_id, 'status': run.status, 'summary': run.summary})


@router.get('/runs')
def list_runs(environment: str | None = None, testType: str | None = None, partnerId: str | None = None, db: Session = Depends(get_db)):
    q = db.query(ConnectionTestRun)
    if environment:
        q = q.filter(ConnectionTestRun.environment == environment)
    if testType:
        q = q.filter(ConnectionTestRun.test_type == testType)
    if partnerId:
        q = q.filter(ConnectionTestRun.partner_id == partnerId)
    rows = q.order_by(ConnectionTestRun.started_at.desc()).all()
    return ok(
        [
            {
                'id': r.id,
                'partnerId': r.partner_id,
                'testType': r.test_type,
                'environment': r.environment,
                'status': r.status,
                'summary': r.summary,
                'startedAt': r.started_at.isoformat() if r.started_at else None,
                'finishedAt': r.finished_at.isoformat() if r.finished_at else None,
            }
            for r in rows
        ]
    )


@router.get('/runs/{run_id}')
def get_run(run_id: str, db: Session = Depends(get_db)):
    run = db.query(ConnectionTestRun).filter(ConnectionTestRun.id == run_id).first()
    if not run:
        return fail('Run not found', 'CONN_RUN_NOT_FOUND')
    steps = db.query(ConnectionTestStep).filter(ConnectionTestStep.run_id == run_id).order_by(ConnectionTestStep.step_no.asc()).all()
    return ok(
        {
            'run': {
                'id': run.id,
                'partnerId': run.partner_id,
                'testType': run.test_type,
                'environment': run.environment,
                'status': run.status,
                'summary': run.summary,
            },
            'steps': [
                {
                    'stepNo': s.step_no,
                    'name': s.name,
                    'status': s.status,
                    'latencyMs': s.latency_ms,
                    'detail': s.detail,
                    'evidence': s.evidence,
                }
                for s in steps
            ],
        }
    )


@router.post('/document-tests')
def create_document_test(payload: dict, _csrf: None = Depends(require_csrf), db: Session = Depends(get_db)):
    report_id = f'dtr-{uuid4().hex[:20]}'
    errors = payload.get('errors') or []
    status = 'failed' if errors else 'passed'
    row = DocumentTestReport(
        id=report_id,
        partner_id=payload.get('partnerId'),
        environment=payload.get('environment', 'default'),
        message_type=payload.get('messageType', '850'),
        status=status,
        errors=errors,
        payload=payload.get('payload') or {},
    )
    db.add(row)
    db.commit()
    return ok({'id': report_id, 'status': status, 'errors': errors})


@router.get('/document-tests/{report_id}')
def get_document_test(report_id: str, db: Session = Depends(get_db)):
    row = db.query(DocumentTestReport).filter(DocumentTestReport.id == report_id).first()
    if not row:
        return fail('Document test report not found', 'DOC_TEST_NOT_FOUND')
    return ok(
        {
            'id': row.id,
            'partnerId': row.partner_id,
            'environment': row.environment,
            'messageType': row.message_type,
            'status': row.status,
            'errors': row.errors,
            'payload': row.payload,
            'createdAt': row.created_at.isoformat() if row.created_at else None,
        }
    )


@router.post('/validator/validate')
def validate_payload(payload: dict, _csrf: None = Depends(require_csrf), db: Session = Depends(get_db)):
    fmt = (payload.get('format') or 'json').lower()
    content = payload.get('content') or ''
    errors: list[dict] = []
    warnings: list[dict] = []
    valid = True

    if fmt == 'json':
        try:
            if isinstance(content, str):
                json.loads(content)
            elif not isinstance(content, dict):
                raise ValueError('JSON content must be object/string')
        except Exception as exc:
            valid = False
            errors.append({'code': 'API-VAL-003', 'message': str(exc)})
    elif fmt == 'xml':
        try:
            ElementTree.fromstring(content)
        except Exception as exc:
            valid = False
            errors.append({'code': 'API-VAL-003', 'message': str(exc)})
    elif fmt == 'x12':
        if not isinstance(content, str) or 'ISA' not in content:
            valid = False
            errors.append({'code': 'API-VAL-001', 'message': 'Missing ISA segment'})
        if isinstance(content, str) and '~' not in content:
            warnings.append({'code': 'API-VAL-002', 'message': 'Segment terminator "~" not found'})
    else:
        valid = False
        errors.append({'code': 'API-VAL-003', 'message': 'Unsupported format'})

    report_id = f'vr-{uuid4().hex[:20]}'
    row = ValidatorReport(id=report_id, format=fmt, valid=valid, errors=errors, warnings=warnings)
    db.add(row)
    db.commit()
    return ok({'id': report_id, 'valid': valid, 'errors': errors, 'warnings': warnings})
