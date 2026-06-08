from __future__ import annotations

import json
import re
import socket
import ssl
import time
from base64 import b64encode
from datetime import datetime
from urllib.parse import urlparse
from uuid import uuid4
from xml.etree import ElementTree

import httpx
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


def _primary_as2_profile(partner: Partner | None):
    if not partner:
        return None
    for sub in partner.subsidiaries:
        if sub.as2_profiles:
            return sub.as2_profiles[0]
    return None


def _as2_authorization_header(target: dict[str, str | int | bool]) -> str:
    configured = str(target.get('authorization') or '').strip()
    if configured:
        return configured if configured.lower().startswith('basic ') else f'Basic {configured}'
    username = str(target.get('username') or '')
    password = str(target.get('password') or '')
    if username or password:
        token = b64encode(f'{username}:{password}'.encode('utf-8')).decode('ascii')
        return f'Basic {token}'
    return ''


def _build_as2_connectivity_request(payload: dict, partner: Partner | None) -> tuple[dict | None, str | None]:
    profile = _primary_as2_profile(partner)
    partner_name = str(payload.get('partnerName') or payload.get('webMethodsPartnerName') or (partner.name if partner else '')).strip()
    as2_partner_id = str(payload.get('partnerAS2Id') or payload.get('as2Id') or (profile.as2_id if profile else '')).strip()
    content_type = str(payload.get('contentType') or 'application/EDI-X12').strip()
    stream = str(payload.get('stream') or payload.get('ediPayload') or payload.get('samplePayload') or '').strip()

    if not partner_name:
        return None, 'Missing required field: partnerName'
    if not as2_partner_id:
        return None, 'Missing required field: partnerAS2Id'
    if not stream:
        return None, 'Missing required field: stream'

    return {
        'Data': {
            'partnerName': partner_name,
            'data': {
                'contentType': content_type,
                'stream': stream,
            },
            'partnerAS2Info': {
                'id': as2_partner_id,
                'idTypeDesc': str(payload.get('idTypeDesc') or 'EDIINT AS2'),
            },
        }
    }, None


def _parse_as2_connectivity_response(response: httpx.Response) -> dict[str, object]:
    raw_body = response.text or ''
    try:
        parsed = response.json()
        if isinstance(parsed, dict):
            for key, value in list(parsed.items()):
                if isinstance(value, str) and value.strip().startswith('%') and value.strip().endswith('%'):
                    parsed[key] = ''
            return parsed
        return {'body': parsed, 'rawBody': raw_body}
    except Exception:
        parsed: dict[str, object] = {'rawBody': raw_body[:2000]}

    for key in ('success', 'message', 'bizDocInternalID', 'UNIS_SendMDN_MessageID', 'PartnerMessageID'):
        match = re.search(rf'"?{re.escape(key)}"?\s*:\s*(.*?)(?:,\s*$|$)', raw_body, flags=re.MULTILINE)
        if not match:
            continue
        value = match.group(1).strip().rstrip(',')
        value = value.strip().strip('"').strip("'")
        if value.lower() == 'true':
            parsed[key] = True
        elif value.lower() == 'false':
            parsed[key] = False
        elif value.startswith('%') and value.endswith('%'):
            parsed[key] = ''
        else:
            parsed[key] = value
    return parsed


@router.post('/as2/run')
def run_as2_test(payload: dict, _csrf: None = Depends(require_csrf), db: Session = Depends(get_db), actor=Depends(get_actor)):
    env = payload.get('environment', 'default')

    partner, partner_err = _check_partner_for_test(db, payload.get('partnerId'), 'edi')
    if partner_err:
        return partner_err

    webmethods_payload, validation_error = _build_as2_connectivity_request(payload, partner)
    if validation_error:
        return fail(validation_error, 'CONN_VALIDATION')

    target = settings.as2_connectivity_target(env)
    endpoint = str(payload.get('endpointUrl') or target.get('url') or '').strip()
    parsed_endpoint = urlparse(endpoint)
    if parsed_endpoint.scheme not in {'http', 'https'}:
        return fail('AS2 Connectivity API endpoint must be http/https', 'CONN_VALIDATION')

    authorization = _as2_authorization_header(target)
    if not authorization:
        return fail('Missing AS2 Connectivity Basic authorization configuration', 'CONN_AUTH_CONFIG')

    run_id = f'ctr-{uuid4().hex[:20]}'
    started = datetime.utcnow()
    run = ConnectionTestRun(id=run_id, partner_id=payload.get('partnerId'), test_type='as2', environment=env, status='processing', summary={}, started_at=started, trace_id=payload.get('traceId'))
    db.add(run)
    db.commit()

    assert webmethods_payload is not None
    data = webmethods_payload['Data']
    _store_step(
        db,
        run_id,
        1,
        'Prepare webMethods AS2 Request',
        'passed',
        0,
        'request payload ready',
        {
            'endpoint': endpoint,
            'partnerName': data['partnerName'],
            'contentType': data['data']['contentType'],
            'streamLength': len(data['data']['stream']),
            'partnerAS2Info': data['partnerAS2Info'],
        },
    )

    response_data: dict[str, object] = {}
    call_status = 'failed'
    call_detail = 'request failed'
    t0 = time.perf_counter()
    try:
        with httpx.Client(timeout=float(target.get('timeout_seconds') or 30), verify=bool(target.get('verify_tls'))) as client:
            response = client.post(
                endpoint,
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': authorization,
                },
                json=webmethods_payload,
            )
        latency = int((time.perf_counter() - t0) * 1000)
        response_data = _parse_as2_connectivity_response(response)
        call_status = 'passed' if 200 <= response.status_code < 300 else 'failed'
        call_detail = f'HTTP {response.status_code}'
        _store_step(
            db,
            run_id,
            2,
            'Call webMethods AS2 Connectivity API',
            call_status,
            latency,
            call_detail,
            {
                'statusCode': response.status_code,
                'contentType': response.headers.get('content-type'),
                'response': response_data,
            },
        )
    except Exception as exc:
        latency = int((time.perf_counter() - t0) * 1000)
        _store_step(db, run_id, 2, 'Call webMethods AS2 Connectivity API', 'failed', latency, str(exc), {'error': str(exc)})

    success = bool(response_data.get('success')) if response_data else False
    raw_message = str(response_data.get('message') or '').strip()
    message = raw_message
    if not message and response_data.get('success') is False:
        message = 'webMethods returned success=false without an error message'
    mdn_success = success and 'AS2 communication successful' in message and 'MDN sent' in message
    _store_step(
        db,
        run_id,
        3,
        'Verify AS2 Delivery and MDN',
        'passed' if mdn_success else 'failed',
        0,
        message or ('ok' if mdn_success else 'AS2 communication failed or MDN not confirmed'),
        {
            'success': success,
            'message': message,
            'mdnConfirmed': mdn_success,
        },
    )

    tracking = {
        'bizDocInternalID': response_data.get('bizDocInternalID'),
        'UNIS_SendMDN_MessageID': response_data.get('UNIS_SendMDN_MessageID'),
        'PartnerMessageID': response_data.get('PartnerMessageID'),
    }
    tracking_ok = any(bool(v) for v in tracking.values())
    _store_step(
        db,
        run_id,
        4,
        'Capture Message Tracking IDs',
        'passed' if tracking_ok else 'failed',
        0,
        'tracking IDs captured' if tracking_ok else 'tracking IDs not returned',
        tracking,
    )

    passed = (1 if call_status == 'passed' else 0) + (1 if mdn_success else 0) + (1 if tracking_ok else 0) + 1
    failed = 4 - passed

    run.status = 'passed' if failed == 0 else ('partial' if passed > 0 else 'failed')
    run.summary = {
        'passedSteps': passed,
        'failedSteps': failed,
        'totalSteps': 4,
        'webMethodsSuccess': success,
        'message': message,
        **tracking,
    }
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
