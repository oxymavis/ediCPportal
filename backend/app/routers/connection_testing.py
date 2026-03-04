from __future__ import annotations

import json
import socket
import ssl
import time
from datetime import datetime
from uuid import uuid4
from xml.etree import ElementTree

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models import ConnectionTestRun, ConnectionTestStep, DocumentTestReport, ValidatorReport
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


def _as2_steps(host: str, port: int, as2_id: str) -> list[tuple[str, callable]]:
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
        return {'valid': True, 'mode': 'simulated-signature-verify'}

    def encryption_check():
        return {'valid': True, 'mode': 'simulated-encryption-check'}

    def mdn_roundtrip():
        return {'valid': True, 'mode': 'simulated-mdn-roundtrip'}

    def functional_ack():
        return {'valid': True, 'mode': 'simulated-997-ack'}

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
    env = payload.get('environment', 'production')
    if actor.get('kind') == 'oauth':
        client_env = actor['client'].environment
        if client_env != 'all' and client_env != env:
            return fail('Client environment is not allowed', 'CONN_ENV_FORBIDDEN')

    host = payload.get('host')
    if not host:
        return fail('Missing required field: host', 'CONN_VALIDATION')
    port = int(payload.get('port') or 443)
    as2_id = payload.get('as2Id') or ''
    run_id = f'ctr-{uuid4().hex[:20]}'
    started = datetime.utcnow()
    run = ConnectionTestRun(id=run_id, partner_id=payload.get('partnerId'), test_type='as2', environment=env, status='processing', summary={}, started_at=started, trace_id=getattr(payload, 'trace_id', None))
    db.add(run)
    db.commit()

    passed = 0
    failed = 0
    for idx, (name, fn) in enumerate(_as2_steps(host, port, as2_id), start=1):
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
    env = payload.get('environment', 'production')
    if actor.get('kind') == 'oauth':
        client_env = actor['client'].environment
        if client_env != 'all' and client_env != env:
            return fail('Client environment is not allowed', 'CONN_ENV_FORBIDDEN')

    endpoint = payload.get('endpoint') or (settings.production_api_test_endpoint if env == 'production' else settings.sandbox_api_test_endpoint)
    run_id = f'ctr-{uuid4().hex[:20]}'
    run = ConnectionTestRun(id=run_id, partner_id=payload.get('partnerId'), test_type='api', environment=env, status='processing', summary={}, started_at=datetime.utcnow(), trace_id=None)
    db.add(run)
    db.commit()

    steps = []

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

    do_step('Endpoint Reachability', lambda: {'valid': endpoint.startswith('http')})
    do_step(
        'Auth Header Acceptance',
        lambda: {'valid': bool(payload.get('auth') in {'oauth2', 'api-key', 'none'}), 'auth': payload.get('auth', 'none')},
    )

    def call_endpoint():
        with httpx.Client(timeout=6.0) as client:
            resp = client.get(endpoint)
            return {'valid': resp.status_code < 500, 'statusCode': resp.status_code}

    do_step('HTTP Connectivity', call_endpoint)
    do_step('Schema Sanity', lambda: {'valid': isinstance(payload.get('samplePayload', {}), dict)})
    do_step('Response Contract', lambda: {'valid': True, 'contract': 'basic'})

    passed = 0
    failed = 0
    for idx, (name, st, latency, msg, ev) in enumerate(steps, start=1):
        if st == 'passed':
            passed += 1
        else:
            failed += 1
        _store_step(db, run_id, idx, name, st, latency, msg, ev)

    run.status = 'passed' if failed == 0 else ('partial' if passed > 0 else 'failed')
    run.summary = {'passedSteps': passed, 'failedSteps': failed, 'totalSteps': len(steps), 'endpoint': endpoint}
    run.finished_at = datetime.utcnow()
    db.commit()
    return ok({'runId': run_id, 'status': run.status, 'summary': run.summary})


@router.get('/runs')
def list_runs(environment: str | None = None, testType: str | None = None, db: Session = Depends(get_db)):
    q = db.query(ConnectionTestRun)
    if environment:
        q = q.filter(ConnectionTestRun.environment == environment)
    if testType:
        q = q.filter(ConnectionTestRun.test_type == testType)
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
        environment=payload.get('environment', 'production'),
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
