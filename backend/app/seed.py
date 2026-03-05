from __future__ import annotations

import hashlib
from datetime import datetime, timedelta
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models import (
    APIClient,
    APICallLog,
    APIMessage,
    APIMessageMapping,
    APIMessageSample,
    APIMessageSchema,
    APIQuota,
    AS2Profile,
    Certificate,
    ConnectionTestRun,
    ConnectionTestStep,
    DocumentTestReport,
    EmailVerificationToken,
    IntegrationClient,
    Notification,
    OAuthToken,
    Partner,
    Session as UserSession,
    Subsidiary,
    TpSpecification,
    Transaction,
    TransactionLink,
    UnisSpecification,
    User,
    ValidatorReport,
)

UNIS_SPECS = [
    {"code": "850", "name": "Purchase Order", "description": "Request purchase of goods or services", "category": "order", "version": "005010", "last_updated": "2024-01-15"},
    {"code": "855", "name": "Purchase Order Acknowledgment", "description": "Confirms receipt of PO", "category": "order", "version": "005010", "last_updated": "2024-01-15"},
    {"code": "856", "name": "Advance Ship Notice", "description": "Shipment contents and carrier details", "category": "shipping", "version": "005010", "last_updated": "2024-02-05"},
    {"code": "810", "name": "Invoice", "description": "Commercial invoice", "category": "financial", "version": "005010", "last_updated": "2024-01-30"},
    {"code": "204", "name": "Motor Carrier Load Tender", "description": "Request to carrier to transport", "category": "shipping", "version": "005010", "last_updated": "2024-01-25"},
    {"code": "210", "name": "Freight Invoice", "description": "Freight invoice from carrier", "category": "shipping", "version": "005010", "last_updated": "2024-01-25"},
    {"code": "214", "name": "Shipment Status", "description": "Shipment location and delivery status", "category": "shipping", "version": "005010", "last_updated": "2024-01-25"},
    {"code": "940", "name": "Warehouse Shipping Order", "description": "Instruction to warehouse to ship", "category": "warehouse", "version": "005010", "last_updated": "2024-02-01"},
    {"code": "945", "name": "Warehouse Shipping Advice", "description": "Warehouse shipment advice", "category": "warehouse", "version": "005010", "last_updated": "2024-02-01"},
    {"code": "997", "name": "Functional Acknowledgment", "description": "Confirms receipt and syntax of EDI", "category": "acknowledgment", "version": "005010", "last_updated": "2024-01-05"},
]


def _seed_users(db: Session) -> None:
    if db.query(User).count() == 0:
        now = datetime.utcnow()
        demo = User(
            id="user-demo-admin",
            name="Demo Admin",
            email="demo@example.com",
            password_hash=hash_password("DemoPass1"),
            password_algo="bcrypt",
            email_verified=True,
        )
        legacy = User(
            id="user-legacy",
            name="Legacy User",
            email="seed-legacy@example.com",
            password_hash=hash_password("LegacyPass1"),
            password_algo="pbkdf2",
            email_verified=True,
        )
        db.add_all([demo, legacy])
        db.flush()

        db.add(
            UserSession(
                id=f"sess-{uuid4().hex}",
                user_id=demo.id,
                expires_at=now + timedelta(days=7),
            )
        )
        db.add(
            EmailVerificationToken(
                token=f"verify-{uuid4().hex}",
                user_id=legacy.id,
                expires_at=now + timedelta(hours=24),
                used=False,
            )
        )


def _seed_partners(db: Session) -> None:
    if db.query(Partner).count() > 0:
        return

    walmart = Partner(
        id="tp-001",
        name="Walmart",
        code="WMT",
        status="active",
        industry="retail",
        website="https://walmart.com",
        contact_name="EDI Team",
        contact_email="edi@walmart.com",
        contact_phone="+1-800-925-6278",
        integration_type="edi",
        communication_channel="AS2",
        current_step_id=5,
        onboarding_start_date="2024-01-01",
        step_completion_dates={"1": "2024-01-01", "2": "2024-01-15", "3": "2024-01-22", "4": "2024-01-28", "5": "2024-02-03"},
        api_config=None,
        environment="production",
    )
    walmart_us = Subsidiary(
        id="sub-wmt-us",
        name="Walmart US",
        code="WMT-US",
        region="United States",
        status="active",
        supported_doc_types_x12=["850", "855", "856", "810", "940", "945", "997"],
        supported_doc_types_edifact=[],
        message_routing={
            "enabledTypes": ["850", "856", "810", "997"],
            "rules": [
                {
                    "id": "route-850-in",
                    "messageType": "850",
                    "direction": "inbound",
                    "enabled": True,
                    "routingType": "return_to_sender",
                },
                {
                    "id": "route-856-out",
                    "messageType": "856",
                    "direction": "outbound",
                    "enabled": True,
                    "routingType": "return_to_sender",
                },
            ],
        },
    )
    walmart_us.as2_profiles.append(
        AS2Profile(
            id="as2-wmt-us",
            name="Walmart US Primary",
            as2_id="WALMART-US-AS2",
            as2_url="https://as2.walmart.com/inbound",
            status="active",
            encryption_cert="Walmart Encryption",
            signing_cert="Walmart Signing",
            mdn_required=True,
            mdn_signed=True,
            encryption_algorithm="AES-256",
            signature_algorithm="SHA-256",
        )
    )
    walmart.subsidiaries.append(walmart_us)

    amazon_api = Partner(
        id="tp-002",
        name="Amazon API",
        code="AMZN",
        status="active",
        industry="ecommerce",
        website="https://amazon.com",
        contact_name="Amazon API Team",
        contact_email="api@amazon.com",
        contact_phone="+1-555-0002",
        integration_type="api",
        communication_channel="REST_API",
        current_step_id=4,
        onboarding_start_date="2024-02-01",
        step_completion_dates={"1": "2024-02-01", "2": "2024-02-08", "3": "2024-02-15", "4": "2024-02-22"},
        api_config={"baseUrl": "https://api.amazon.example.com", "authMethod": "OAuth 2.0", "apiKey": "***MASKED***"},
        environment="sandbox",
    )

    target = Partner(
        id="tp-003",
        name="Target",
        code="TGT",
        status="active",
        industry="retail",
        website="https://target.com",
        contact_name="Target Integration",
        contact_email="edi@target.com",
        contact_phone="+1-555-0003",
        integration_type="edi",
        communication_channel="AS2",
        current_step_id=3,
        onboarding_start_date="2024-03-01",
        step_completion_dates={"1": "2024-03-01", "2": "2024-03-08", "3": "2024-03-19"},
        api_config=None,
        environment="production",
    )
    target_sub = Subsidiary(
        id="sub-tgt-us",
        name="Target Stores",
        code="TGT-US",
        region="United States",
        status="active",
        supported_doc_types_x12=["850", "855", "856", "810", "997"],
        supported_doc_types_edifact=[],
        message_routing={"enabledTypes": ["850", "856"], "rules": []},
    )
    target.subsidiaries.append(target_sub)

    db.add_all([walmart, amazon_api, target])


def _seed_certificates(db: Session) -> None:
    if db.query(Certificate).count() > 0:
        return

    certs = [
        {
            "name": "Walmart US - Encryption",
            "serial_number": "SN:WMT-ENC-001",
            "fingerprint": "AA:BB:CC:DD:EE:11:22:33",
            "issuer": "DigiCert",
            "subject": "CN=walmart-as2",
            "algorithm": "SHA256RSA",
            "key_size": "2048",
            "created": "2024-01-01",
            "expires": "2026-01-01",
            "usage": "Encryption",
            "type": "X.509",
            "status": "active",
            "partner": "Walmart",
            "environment": "production",
        },
        {
            "name": "Target AS2 - Signing",
            "serial_number": "SN:TGT-SIGN-001",
            "fingerprint": "AA:BB:CC:DD:EE:44:55:66",
            "issuer": "Sectigo",
            "subject": "CN=target-as2",
            "algorithm": "SHA256RSA",
            "key_size": "2048",
            "created": "2024-03-01",
            "expires": "2026-03-01",
            "usage": "Signing",
            "type": "X.509",
            "status": "active",
            "partner": "Target",
            "environment": "production",
        },
        {
            "name": "UNIS Sandbox API Gateway",
            "serial_number": "SN:UNIS-SBX-API-001",
            "fingerprint": "AA:BB:CC:DD:EE:77:88:99",
            "issuer": "UNIS Sandbox CA",
            "subject": "CN=sandbox-api.unis.local",
            "algorithm": "SHA256RSA",
            "key_size": "2048",
            "created": "2024-04-01",
            "expires": "2025-10-01",
            "usage": "Server Auth",
            "type": "X.509",
            "status": "expiring",
            "partner": "UNIS (Self)",
            "environment": "sandbox",
        },
        {
            "name": "UNIS Production Root CA",
            "serial_number": "SN:UNIS-PROD-ROOT-001",
            "fingerprint": "AA:BB:CC:DD:EE:AA:BB:CC",
            "issuer": "UNIS Root CA",
            "subject": "CN=unis-root-ca",
            "algorithm": "SHA384RSA",
            "key_size": "4096",
            "created": "2024-01-01",
            "expires": "2030-01-01",
            "usage": "Root CA",
            "type": "X.509",
            "status": "active",
            "partner": "UNIS (Self)",
            "environment": "production",
        },
    ]
    db.add_all([Certificate(**c) for c in certs])


def _seed_transactions(db: Session) -> None:
    if db.query(Transaction).count() > 0:
        return

    rows: list[Transaction] = []
    now = datetime.utcnow()
    monthly_points = [
        ("2025-09-03", "850", "Walmart", "inbound", "completed", "edi", "AS2"),
        ("2025-10-06", "856", "Walmart", "outbound", "completed", "edi", "AS2"),
        ("2025-11-09", "810", "Target", "outbound", "completed", "edi", "AS2"),
        ("2025-12-10", "997", "Target", "inbound", "completed", "edi", "AS2"),
        ("2026-01-15", "PO", "Amazon API", "inbound", "processing", "api", "REST_API"),
        ("2026-02-18", "ASN", "Amazon API", "outbound", "completed", "api", "REST_API"),
        ("2026-03-01", "INV", "Amazon API", "outbound", "error", "api", "REST_API"),
        ("2026-03-03", "850", "Walmart", "inbound", "pending", "edi", "AS2"),
    ]

    for idx, (date, doc, partner, direction, status, integration_type, channel) in enumerate(monthly_points, start=1):
        trx_id = f"TRX-{doc}-{idx:04d}"
        occurred_at = datetime.strptime(date + " 10:00:00", "%Y-%m-%d %H:%M:%S")
        rows.append(
            Transaction(
                id=trx_id,
                type=doc,
                doc_type=doc,
                type_name=f"Document {doc}",
                partner=partner,
                direction=direction,
                status=status,
                date=date,
                time="10:00:00",
                size="1.2 KB",
                records=1,
                control_number=f"CTRL{idx:05d}",
                sender_id="UNIS-SENDER",
                receiver_id="TP-RECV",
                integration_type=integration_type,
                channel=channel,
                source_system="seed",
                external_event_id=f"evt-{idx:04d}",
                idempotency_key=f"seed-idem-{idx:04d}",
                business_refs={"poNumber": f"PO-{idx:05d}"},
                control_refs={"isaControlNo": f"ISA{idx:05d}"},
                occurred_at=occurred_at,
                raw="ISA*00*...~",
                logs=[{"message": "Seeded transaction"}],
                errors=[] if status != "error" else [{"code": "SIM-ERR", "message": "Simulated failure"}],
                environment="production" if integration_type == "edi" else "sandbox",
                created_at=now,
            )
        )

    db.add_all(rows)
    db.flush()
    if len(rows) >= 2 and db.query(TransactionLink).count() == 0:
        db.add(
            TransactionLink(
                from_transaction_id=rows[0].id,
                to_transaction_id=rows[1].id,
                relation_type="ack",
                match_rule="control_number",
                confidence=95,
                evidence={"controlNumber": rows[0].control_number},
            )
        )


def _seed_notifications(db: Session) -> None:
    if db.query(Notification).count() > 0:
        return
    db.add_all(
        [
            Notification(
                type="warning",
                title="Certificate Expiring Soon",
                message="UNIS Sandbox API Gateway certificate expires in <90 days",
                date="2026-03-01",
                time="08:30:00",
                read=False,
                archived=False,
                environment="sandbox",
                action={"label": "Open Certificates", "link": "/dashboard?tab=certificates"},
                details={"certificateName": "UNIS Sandbox API Gateway", "expiresIn": "211 days"},
            ),
            Notification(
                type="error",
                title="Transaction Processing Error",
                message="Invoice INV failed schema validation",
                date="2026-03-03",
                time="12:00:00",
                read=False,
                archived=False,
                environment="sandbox",
                details={"partnerName": "Amazon API", "errorCode": "API-VAL-003"},
            ),
            Notification(
                type="info",
                title="Partner Activated",
                message="Walmart partner lifecycle moved to Go Live",
                date="2026-02-22",
                time="16:45:00",
                read=True,
                archived=False,
                environment="production",
            ),
        ]
    )


def _seed_specs(db: Session) -> None:
    if db.query(UnisSpecification).count() == 0:
        db.add_all([UnisSpecification(**s) for s in UNIS_SPECS])

    if db.query(TpSpecification).count() == 0:
        db.add_all(
            [
                TpSpecification(
                    id="tp-spec-001",
                    message_type="850",
                    message_name="Purchase Order",
                    partner="Walmart",
                    partner_code="WMT",
                    version="005010",
                    uploaded_date="2026-02-01",
                    uploaded_by="demo@example.com",
                    file_type="PDF",
                    file_name="walmart-850-guide.pdf",
                    size="220.1 KB",
                    status="active",
                ),
                TpSpecification(
                    id="tp-spec-002",
                    message_type="856",
                    message_name="Advance Ship Notice",
                    partner="Amazon API",
                    partner_code="AMZN",
                    version="v2.1",
                    uploaded_date="2026-02-20",
                    uploaded_by="demo@example.com",
                    file_type="JSON",
                    file_name="amazon-api-asn.json",
                    size="18.2 KB",
                    status="active",
                ),
            ]
        )


def _seed_api_and_integration(db: Session) -> None:
    if db.query(IntegrationClient).count() == 0:
        seed_key = (settings.parsed_integration_api_keys[0] if settings.parsed_integration_api_keys else "dev-integration-key")
        db.add(
            IntegrationClient(
                id="integration-client-default",
                name="Default Integration Client",
                api_key_hash=hashlib.sha256(seed_key.encode("utf-8")).hexdigest(),
                status="active",
                allowed_sources=["edi", "oms", "wms", "tms", "api"],
            )
        )

    if db.query(APIClient).count() == 0:
        db.add(
            APIClient(
                client_id="openapi-default-client",
                name="Default OpenAPI Client",
                secret_hash=hash_password("openapi-default-secret"),
                status="active",
                scopes=[
                    "integrations:read",
                    "integrations:write",
                    "transactions:read",
                    "transactions:write",
                    "partners:read",
                    "partners:write",
                    "certificates:read",
                    "certificates:write",
                    "specifications:read",
                    "specifications:write",
                    "notifications:read",
                    "notifications:write",
                ],
                environment="production",
            )
        )
        db.flush()

    if db.query(OAuthToken).count() == 0:
        db.add(
            OAuthToken(
                jti=f"jti-{uuid4().hex[:16]}",
                client_id="openapi-default-client",
                expires_at=datetime.utcnow() + timedelta(hours=1),
                revoked=False,
            )
        )

    if db.query(APICallLog).count() == 0:
        db.add_all(
            [
                APICallLog(trace_id="trace-seed-001", client_id="openapi-default-client", method="GET", path="/v1/transactions", status_code=200, latency_ms=35),
                APICallLog(trace_id="trace-seed-002", client_id="openapi-default-client", method="POST", path="/v1/connection-testing/api/run", status_code=200, latency_ms=140),
            ]
        )

    if db.query(APIQuota).count() == 0:
        db.add_all(
            [
                APIQuota(client_id="openapi-default-client", period="daily", period_key=datetime.utcnow().strftime("%Y-%m-%d"), count=212),
                APIQuota(client_id="openapi-default-client", period="monthly", period_key=datetime.utcnow().strftime("%Y-%m"), count=4931),
            ]
        )


def _seed_api_docs(db: Session) -> None:
    if db.query(APIMessage).count() > 0:
        return

    db.add_all(
        [
            APIMessage(code="850", name="PurchaseOrder", category="order", x12_equivalent="850", version="v2.1"),
            APIMessage(code="856", name="AdvanceShipNotice", category="shipping", x12_equivalent="856", version="v2.1"),
            APIMessage(code="810", name="Invoice", category="financial", x12_equivalent="810", version="v2.1"),
        ]
    )
    db.flush()

    db.add_all(
        [
            APIMessageSchema(message_code="850", version="v2.1", schema={"type": "object", "required": ["header", "purchaseOrder"]}),
            APIMessageSchema(message_code="856", version="v2.1", schema={"type": "object", "required": ["header", "shipNotice"]}),
            APIMessageSchema(message_code="810", version="v2.1", schema={"type": "object", "required": ["header", "invoice"]}),
        ]
    )

    db.add_all(
        [
            APIMessageSample(message_code="850", sample_type="request", content={"header": {"messageType": "PurchaseOrder"}, "purchaseOrder": {"poNumber": "PO-1001"}}),
            APIMessageSample(message_code="850", sample_type="response", content={"accepted": True, "id": "PO-1001"}),
            APIMessageSample(message_code="856", sample_type="request", content={"header": {"messageType": "AdvanceShipNotice"}, "shipNotice": {"shipmentId": "SHP-9"}}),
            APIMessageSample(message_code="810", sample_type="request", content={"header": {"messageType": "Invoice"}, "invoice": {"invoiceNumber": "INV-9"}}),
        ]
    )

    db.add_all(
        [
            APIMessageMapping(message_code="850", json_field="purchaseOrder.poNumber", x12_segment="BEG", x12_element="03", notes="PO Number"),
            APIMessageMapping(message_code="856", json_field="shipNotice.shipmentId", x12_segment="BSN", x12_element="02", notes="Shipment ID"),
            APIMessageMapping(message_code="810", json_field="invoice.invoiceNumber", x12_segment="BIG", x12_element="02", notes="Invoice Number"),
        ]
    )


def _seed_connection_testing(db: Session) -> None:
    if db.query(ConnectionTestRun).count() == 0:
        run_id = "ctr-seed-0001"
        db.add(
            ConnectionTestRun(
                id=run_id,
                partner_id="tp-001",
                test_type="as2",
                environment="production",
                status="passed",
                summary={"passedSteps": 7, "failedSteps": 0, "totalSteps": 7},
                started_at=datetime.utcnow() - timedelta(days=2, minutes=5),
                finished_at=datetime.utcnow() - timedelta(days=2),
                trace_id="trace-conn-0001",
            )
        )
        db.flush()
        for i, name in enumerate(
            [
                "DNS Reachability",
                "TLS Handshake",
                "AS2 Identifier Validation",
                "Signature Verification",
                "Encryption/Decryption Check",
                "MDN Roundtrip",
                "Functional ACK Check",
            ],
            start=1,
        ):
            db.add(
                ConnectionTestStep(
                    run_id=run_id,
                    step_no=i,
                    name=name,
                    status="passed",
                    latency_ms=20 + i,
                    detail="ok",
                    evidence={"seed": True},
                )
            )

    if db.query(DocumentTestReport).count() == 0:
        db.add(
            DocumentTestReport(
                id="dtr-seed-0001",
                partner_id="tp-001",
                environment="production",
                message_type="850",
                status="passed",
                errors=[],
                payload={"poNumber": "PO-1001"},
            )
        )

    if db.query(ValidatorReport).count() == 0:
        db.add_all(
            [
                ValidatorReport(id="vr-seed-0001", format="json", valid=True, errors=[], warnings=[]),
                ValidatorReport(
                    id="vr-seed-0002",
                    format="x12",
                    valid=False,
                    errors=[{"code": "API-VAL-001", "message": "Missing ISA segment"}],
                    warnings=[],
                ),
            ]
        )


def _ensure_non_empty_tables(db: Session) -> None:
    if db.query(AS2Profile).count() == 0:
        sub = db.query(Subsidiary).first()
        if sub:
            db.add(
                AS2Profile(
                    id=f"as2-autofix-{uuid4().hex[:12]}",
                    subsidiary_id=sub.id,
                    name=f"{sub.code} Auto Profile",
                    as2_id=f"{sub.code}-AS2-AUTO",
                    as2_url="https://example.com/as2",
                    status="active",
                    encryption_cert="Auto Encryption",
                    signing_cert="Auto Signing",
                    mdn_required=True,
                    mdn_signed=True,
                    encryption_algorithm="AES-256",
                    signature_algorithm="SHA-256",
                )
            )


def seed_if_empty(db: Session) -> None:
    _seed_users(db)
    _seed_partners(db)
    _seed_certificates(db)
    _seed_transactions(db)
    _seed_notifications(db)
    _seed_specs(db)
    _seed_api_and_integration(db)
    _seed_api_docs(db)
    _seed_connection_testing(db)
    _ensure_non_empty_tables(db)
    db.commit()
