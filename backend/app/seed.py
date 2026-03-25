from __future__ import annotations

import hashlib
import json
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
from app.services.storage import save_text_file

UNIS_SPECS = [
    {"code": "850", "name": "Purchase Order", "description": "Request purchase of goods or services", "category": "order", "version": "005010", "last_updated": "2024-01-15"},
    {"code": "855", "name": "Purchase Order Acknowledgment", "description": "Confirms receipt of PO", "category": "order", "version": "005010", "last_updated": "2024-01-15"},
    {"code": "856", "name": "Advance Ship Notice", "description": "Shipment contents and carrier details", "category": "shipping", "version": "005010", "last_updated": "2024-02-05"},
    {"code": "810", "name": "Invoice", "description": "Commercial invoice", "category": "financial", "version": "005010", "last_updated": "2024-01-30"},
    {"code": "832", "name": "Price/Sales Catalog", "description": "Catalog pricing and product data", "category": "catalog", "version": "005010", "last_updated": "2024-01-25"},
    {"code": "204", "name": "Motor Carrier Load Tender", "description": "Request to carrier to transport", "category": "shipping", "version": "005010", "last_updated": "2024-01-25"},
    {"code": "210", "name": "Freight Invoice", "description": "Freight invoice from carrier", "category": "shipping", "version": "005010", "last_updated": "2024-01-25"},
    {"code": "214", "name": "Shipment Status", "description": "Shipment location and delivery status", "category": "shipping", "version": "005010", "last_updated": "2024-01-25"},
    {"code": "846", "name": "Inventory Inquiry/Advice", "description": "Inventory balance snapshot", "category": "inventory", "version": "005010", "last_updated": "2024-02-01"},
    {"code": "860", "name": "Purchase Order Change Request", "description": "Request changes on a purchase order", "category": "order", "version": "005010", "last_updated": "2024-02-02"},
    {"code": "940", "name": "Warehouse Shipping Order", "description": "Instruction to warehouse to ship", "category": "warehouse", "version": "005010", "last_updated": "2024-02-01"},
    {"code": "943", "name": "Warehouse Stock Transfer Shipment Advice", "description": "Advice of stock transfer shipment", "category": "warehouse", "version": "005010", "last_updated": "2024-02-01"},
    {"code": "944", "name": "Warehouse Stock Transfer Receipt Advice", "description": "Receipt confirmation for stock transfer", "category": "warehouse", "version": "005010", "last_updated": "2024-02-01"},
    {"code": "945", "name": "Warehouse Shipping Advice", "description": "Warehouse shipment advice", "category": "warehouse", "version": "005010", "last_updated": "2024-02-01"},
    {"code": "947", "name": "Warehouse Inventory Adjustment Advice", "description": "Inventory adjustments from warehouse", "category": "warehouse", "version": "005010", "last_updated": "2024-02-01"},
    {"code": "997", "name": "Functional Acknowledgment", "description": "Confirms receipt and syntax of EDI", "category": "acknowledgment", "version": "005010", "last_updated": "2024-01-05"},
    {"code": "999", "name": "Implementation Acknowledgment", "description": "Acknowledgment with implementation-level detail", "category": "acknowledgment", "version": "005010", "last_updated": "2024-01-05"},
]


def _seed_users(db: Session) -> None:
    now = datetime.utcnow()

    demo = db.query(User).filter(User.email == "demo@example.com").first()
    if not demo:
        demo = User(
            id="user-demo-admin",
            name="Demo Admin",
            email="demo@example.com",
            password_hash=hash_password("DemoPass1"),
            password_algo="bcrypt",
            email_verified=True,
        )
        db.add(demo)
        db.flush()

    legacy = db.query(User).filter(User.email == "seed-legacy@example.com").first()
    if not legacy:
        legacy = User(
            id="user-legacy",
            name="Legacy User",
            email="seed-legacy@example.com",
            password_hash=hash_password("LegacyPass1"),
            password_algo="pbkdf2",
            email_verified=True,
        )
        db.add(legacy)
        db.flush()

    has_session = (
        db.query(UserSession)
        .filter(UserSession.user_id == demo.id, UserSession.expires_at > now)
        .first()
    )
    if not has_session:
        db.add(
            UserSession(
                id=f"sess-{uuid4().hex}",
                user_id=demo.id,
                expires_at=now + timedelta(days=7),
            )
        )

    has_token = (
        db.query(EmailVerificationToken)
        .filter(EmailVerificationToken.user_id == legacy.id, EmailVerificationToken.used.is_(False))
        .first()
    )
    if not has_token:
        db.add(
            EmailVerificationToken(
                token=f"verify-{uuid4().hex}",
                user_id=legacy.id,
                expires_at=now + timedelta(hours=24),
                used=False,
            )
        )


def _seed_partners(db: Session) -> None:
    existing_partner_ids = set(db.query(Partner.id).all())
    existing_partner_ids = {x[0] for x in existing_partner_ids}

    if "tp-001" not in existing_partner_ids:
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
        db.add(walmart)
        db.flush()

    walmart_sub = db.query(Subsidiary).filter(Subsidiary.id == "sub-wmt-us").first()
    if not walmart_sub:
        walmart_sub = Subsidiary(
            id="sub-wmt-us",
            partner_id="tp-001",
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
        db.add(walmart_sub)
        db.flush()

    walmart_as2 = db.query(AS2Profile).filter(AS2Profile.id == "as2-wmt-us").first()
    if not walmart_as2:
        db.add(
            AS2Profile(
                id="as2-wmt-us",
                subsidiary_id="sub-wmt-us",
                name="Walmart US Primary",
                as2_id="WALMART-US-AS2",
                as2_url="https://as2.walmart.com/inbound",
                as2_port=443,
                sender_id="UNIS-AS2",
                sender_qualifier="ZZ",
                receiver_id="WALMART-US-AS2",
                receiver_qualifier="ZZ",
                status="active",
                encryption_cert="Walmart Encryption",
                signing_cert="Walmart Signing",
                mdn_required=True,
                mdn_signed=True,
                encryption_algorithm="AES-256",
                signature_algorithm="SHA-256",
            )
        )

    if "tp-002" not in existing_partner_ids:
        db.add(
            Partner(
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
        )

    if "tp-003" not in existing_partner_ids:
        db.add(
            Partner(
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
        )
        db.flush()

    target_sub = db.query(Subsidiary).filter(Subsidiary.id == "sub-tgt-us").first()
    if not target_sub:
        db.add(
            Subsidiary(
                id="sub-tgt-us",
                partner_id="tp-003",
                name="Target Stores",
                code="TGT-US",
                region="United States",
                status="active",
                supported_doc_types_x12=["850", "855", "856", "810", "997"],
                supported_doc_types_edifact=[],
                message_routing={"enabledTypes": ["850", "856"], "rules": []},
            )
        )


def _seed_certificates(db: Session) -> None:
    def cert_blob(name: str, subject: str, issuer: str, serial: str) -> str:
        return (
            "-----BEGIN CERTIFICATE-----\n"
            f"Seeded certificate placeholder for {name}\n"
            f"Subject: {subject}\n"
            f"Issuer: {issuer}\n"
            f"Serial: {serial}\n"
            "-----END CERTIFICATE-----\n"
        )

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
            "file_name": "walmart-us-encryption.pem",
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
            "file_name": "target-as2-signing.pem",
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
            "expires": "2026-04-20",
            "usage": "Server Auth",
            "type": "X.509",
            "status": "expiring",
            "partner": "UNIS (Self)",
            "environment": "sandbox",
            "file_name": "unis-sandbox-api-gateway.pem",
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
            "file_name": "unis-production-root-ca.pem",
        },
    ]
    existing_serials = {x.serial_number: x for x in db.query(Certificate).all()}
    for cert in certs:
        row = existing_serials.get(cert["serial_number"])
        if row:
            row.name = cert["name"]
            row.issuer = cert["issuer"]
            row.subject = cert["subject"]
            row.algorithm = cert["algorithm"]
            row.key_size = cert["key_size"]
            row.created = cert["created"]
            row.expires = cert["expires"]
            row.usage = cert["usage"]
            row.type = cert["type"]
            row.status = cert["status"]
            row.partner = cert["partner"]
            row.environment = cert["environment"]
            if not row.file_path:
                row.file_path = save_text_file(
                    cert_blob(cert["name"], cert["subject"], cert["issuer"], cert["serial_number"]),
                    "certificates",
                    cert["file_name"],
                )
            continue
        row_data = {k: v for k, v in cert.items() if k != "file_name"}
        row_data["file_path"] = save_text_file(
            cert_blob(cert["name"], cert["subject"], cert["issuer"], cert["serial_number"]),
            "certificates",
            cert["file_name"],
        )
        db.add(Certificate(**row_data))


def _seed_transactions(db: Session) -> None:
    existing = {x.id: x for x in db.query(Transaction).all()}
    now = datetime.utcnow()

    type_names = {
        "204": "Motor Carrier Load Tender",
        "210": "Motor Carrier Freight Invoice",
        "214": "Transportation Carrier Shipment Status",
        "810": "Invoice",
        "832": "Price/Sales Catalog",
        "846": "Inventory Inquiry/Advice",
        "850": "Purchase Order",
        "855": "Purchase Order Acknowledgment",
        "856": "Advance Ship Notice",
        "940": "Warehouse Shipping Order",
        "943": "Warehouse Stock Transfer Shipment Advice",
        "944": "Warehouse Stock Transfer Receipt Advice",
        "945": "Warehouse Shipping Advice",
        "947": "Warehouse Inventory Adjustment Advice",
        "997": "Functional Acknowledgment",
        "999": "Implementation Acknowledgment",
        "PO": "API Purchase Order",
        "ASN": "API Advance Ship Notice",
        "INV": "API Invoice",
    }

    def _x12_envelope(
        doc: str, partner_code: str, idx: int, date_str: str, body_segments: list[str], gs_code: str | None = None
    ) -> str:
        """Build X12 interchange envelope (ISA/GS/GE/IEA) with given transaction body."""
        dt = datetime.strptime(date_str + " 10:00:00", "%Y-%m-%d %H:%M:%S")
        isa_date = dt.strftime("%y%m%d")
        isa_time = dt.strftime("%H%M")
        gs_date = dt.strftime("%Y%m%d")
        gs_time = dt.strftime("%H%M")
        isa_ctl = 100000 + idx
        gs_ctl = 200000 + idx
        st_ctl = 300000 + idx
        seg_count = len(body_segments) + 2  # +ST +SE
        gs_id = gs_code or (doc if doc in ("850", "855", "856", "810", "997", "999", "204", "210", "214") else "PO")
        isa = (
            f"ISA*00*          *00*          *ZZ*UNIS-SENDER    *ZZ*{partner_code:<15}*"
            f"{isa_date}*{isa_time}*U*00501*{isa_ctl}*0*T*:~\n"
        )
        gs = f"GS*{gs_id}*UNIS-SENDER*{partner_code[:10].strip()}*{gs_date}*{gs_time}*{gs_ctl}*X*005010~\n"
        st = f"ST*{doc}*{st_ctl}~\n"
        body = "\n".join(body_segments) + "\n"
        se = f"SE*{seg_count}*{st_ctl}~\n"
        ge = f"GE*1*{gs_ctl}~\n"
        iea = f"IEA*1*{isa_ctl}~"
        return isa + gs + st + body + se + ge + iea

    def _build_x12_raw(doc: str, direction: str, partner: str, idx: int, date_str: str) -> str:
        """Generate real X12 005010 message body per document type."""
        partner_code = (partner[:15].upper() if len(partner) <= 15 else partner[:8].upper() + "       ").ljust(15)
        dt = datetime.strptime(date_str + " 10:00:00", "%Y-%m-%d %H:%M:%S")
        ymd = dt.strftime("%Y%m%d")
        if doc == "850":
            body = [
                f"BEG*00*SA*PO-{idx:06d}**{ymd}~",
                f"REF*IA*UNIS-{idx:06d}~",
                f"N1*ST*{partner}*92*{partner[:8].upper()}~",
                "N1*BT*UNIS Corp*92*UNIS~",
                f"PO1*1*{12 + (idx % 5)}*EA*25.99*PE*VP*SKU-{idx:04d}~",
                f"PO1*2*{24 + (idx % 3)}*EA*18.50*PE*VP*SKU-{idx:04d}-2~",
                "CTT*2~",
            ]
            return _x12_envelope(doc, partner_code, idx, date_str, body)
        if doc == "855":
            body = [
                f"BAK*00*AT*PO-{idx:06d}**{ymd}~",
                f"PO1*1*{12 + (idx % 5)}*EA*IA*SKU-{idx:04d}~",
                f"PO1*2*{24 + (idx % 3)}*EA*IA*SKU-{idx:04d}-2~",
                "CTT*2~",
            ]
            return _x12_envelope(doc, partner_code, idx, date_str, body)
        if doc == "856":
            body = [
                f"BSN*00*SHP-{idx:06d}*{ymd}*1000~",
                "HL*1**S~",
                "TD1*PLT*1~",
                "TD5*B*2*FEDX*GND~",
                f"REF*BM*BOL-{idx:06d}~",
                f"DTM*011*{ymd}~",
                f"N1*ST*{partner}*92*{partner[:8].upper()}~",
                "HL*2*1*O~",
                f"LIN**VP*SKU-{idx:04d}~",
                f"SN1**{12 + (idx % 5)}*EA~",
            ]
            return _x12_envelope(doc, partner_code, idx, date_str, body)
        if doc == "810":
            body = [
                f"BIG*{ymd}*INV-{idx:06d}**PO-{idx:06d}~",
                f"N1*ST*{partner}*92*{partner[:8].upper()}~",
                f"IT1*1*{12 + (idx % 5)}*EA*25.99*PE*VP*SKU-{idx:04d}~",
                f"IT1*2*{24 + (idx % 3)}*EA*18.50*PE*VP*SKU-{idx:04d}-2~",
                "TDS*123456*0~",
            ]
            return _x12_envelope(doc, partner_code, idx, date_str, body)
        if doc == "846":
            body = [
                f"BIA*00*INV-846-{idx:06d}*{ymd}~",
                f"LIN**VP*SKU-{idx:04d}~",
                f"QTY*OH*{100 + idx * 10}~",
            ]
            return _x12_envelope(doc, partner_code, idx, date_str, body)
        if doc == "832":
            body = [
                f"BCT*NE*CAT-832-{idx:06d}~",
                f"LIN**VP*SKU-{idx:04d}~",
                "PCT*1*PE*25.99~",
            ]
            return _x12_envelope(doc, partner_code, idx, date_str, body)
        if doc == "940":
            body = [
                f"W05*N*{12 + (idx % 5)}*EA***G*92*{partner[:8].upper()}~",
                f"N1*WH*{partner} DC*92*{partner[:8].upper()}~",
                f"N9*CN*PO-{idx:06d}~",
                f"W01*1*{12 + (idx % 5)}*EA*SKU-{idx:04d}~",
            ]
            return _x12_envelope(doc, partner_code, idx, date_str, body)
        if doc == "945":
            body = [
                f"W06*{12 + (idx % 5)}*EA~",
                f"N1*WH*{partner} DC*92*{partner[:8].upper()}~",
                f"W01*1*{12 + (idx % 5)}*EA*SKU-{idx:04d}~",
            ]
            return _x12_envelope(doc, partner_code, idx, date_str, body)
        if doc == "943":
            body = [
                f"W05*N*{12 + (idx % 5)}*EA~",
                f"N1*WH*{partner} DC*92*{partner[:8].upper()}~",
                f"W01*1*{12 + (idx % 5)}*EA*SKU-{idx:04d}~",
            ]
            return _x12_envelope(doc, partner_code, idx, date_str, body)
        if doc == "944":
            body = [
                f"W05*N*{12 + (idx % 5)}*EA~",
                f"N1*WH*{partner} DC*92*{partner[:8].upper()}~",
                f"W01*1*{12 + (idx % 5)}*EA*SKU-{idx:04d}~",
            ]
            return _x12_envelope(doc, partner_code, idx, date_str, body)
        if doc == "997":
            body = [
                "AK1*PO*1~",
                "AK9*A*1*1*1~",
            ]
            return _x12_envelope(doc, partner_code, idx, date_str, body, gs_code="FA")
        if doc == "999":
            body = [
                "AK1*PO*1~",
                "IK5*A~",
            ]
            return _x12_envelope(doc, partner_code, idx, date_str, body, gs_code="FA")
        if doc == "204":
            body = [
                f"B2A*00*LT*LT-{idx:06d}~",
                "MS3*FEDX*DALLAS*TX~",
                "N1*SH*UNIS*92*UNIS~",
                f"N1*ST*{partner}*92*{partner[:8].upper()}~",
            ]
            return _x12_envelope(doc, partner_code, idx, date_str, body)
        if doc == "210":
            body = [
                f"B3*LT-{idx:06d}*{ymd}~",
                "N1*SH*Carrier*92*FEDX~",
                "L1*1*1234.56*G~",
            ]
            return _x12_envelope(doc, partner_code, idx, date_str, body)
        if doc == "214":
            body = [
                f"BSN*00*214-{idx:06d}*{ymd}*1000~",
                "HL*1**S~",
                f"ST*OK*{ymd}*1000*Dallas*TX~",
            ]
            return _x12_envelope(doc, partner_code, idx, date_str, body)
        # fallback generic PO-style
        body = [
            f"BEG*00*SA*PO-{idx:06d}**{ymd}~",
            f"REF*IA*UNIS-{idx:06d}~",
            f"N1*ST*{partner}*92*{partner[:8].upper()}~",
        ]
        return _x12_envelope(doc, partner_code, idx, date_str, body)

    def build_raw(doc: str, direction: str, partner: str, idx: int, integration_type: str, date_str: str = "") -> str:
        if integration_type == "api":
            if doc == "PO":
                payload = {
                    "transactionId": f"api-po-{idx:06d}",
                    "poNumber": f"PO-{idx:06d}",
                    "partnerCode": "AMZN",
                    "orderDate": date_str or datetime.utcnow().strftime("%Y-%m-%d"),
                    "lineItems": [
                        {"sku": f"SKU-{idx:04d}", "qty": idx % 9 + 1, "unitPrice": 25.99, "uom": "EA"},
                        {"sku": f"SKU-{idx:04d}-2", "qty": (idx % 5) + 2, "unitPrice": 18.50, "uom": "EA"},
                    ],
                }
            elif doc == "ASN":
                payload = {
                    "transactionId": f"api-asn-{idx:06d}",
                    "shipmentId": f"SHP-{idx:06d}",
                    "partnerCode": "AMZN",
                    "shipDate": date_str or datetime.utcnow().strftime("%Y-%m-%d"),
                    "carrier": "FEDX",
                    "trackingNumber": f"1Z999AA1012345678{idx:04d}",
                    "lines": [{"sku": f"SKU-{idx:04d}", "quantityShipped": 12, "uom": "EA"}],
                }
            elif doc == "INV":
                payload = {
                    "transactionId": f"api-inv-{idx:06d}",
                    "invoiceNumber": f"INV-{idx:06d}",
                    "partnerCode": "AMZN",
                    "invoiceDate": date_str or datetime.utcnow().strftime("%Y-%m-%d"),
                    "poNumber": f"PO-{idx:06d}",
                    "lineItems": [{"sku": f"SKU-{idx:04d}", "qty": idx % 9 + 1, "unitPrice": 25.99, "extendedAmount": 311.88}],
                }
            else:
                payload = {
                    "transactionId": f"api-{idx:06d}",
                    "reference": f"REF-{idx:06d}",
                    "lineItems": [{"sku": f"SKU-{idx:04d}", "qty": idx % 9 + 1}],
                }
            return json.dumps(
                {
                    "header": {
                        "messageType": doc,
                        "direction": direction,
                        "partner": partner,
                        "timestamp": (date_str or datetime.utcnow().strftime("%Y-%m-%d")) + "T10:00:00Z",
                    },
                    "payload": payload,
                },
                indent=2,
            )
        use_date = date_str or datetime.utcnow().strftime("%Y-%m-%d")
        return _build_x12_raw(doc, direction, partner, idx, use_date)

    def build_logs(date: str, time_str: str, status: str, integration_type: str, channel: str, idx: int) -> list[dict]:
        base = f"{date}T{time_str}"
        logs = [
            {"timestamp": base, "level": "info", "message": f"Ingested via {integration_type.upper()} channel {channel}"},
            {"timestamp": base, "level": "info", "message": "Envelope parsed and control numbers validated"},
            {"timestamp": base, "level": "info", "message": "Business routing completed"},
        ]
        if status == "processing":
            logs.append({"timestamp": base, "level": "warning", "message": "Pending downstream acknowledgment"})
        elif status == "pending":
            logs.append({"timestamp": base, "level": "warning", "message": "Queued in outbound dispatcher"})
        elif status == "error":
            logs.append({"timestamp": base, "level": "error", "message": f"Schema validation failed at line item {idx % 5 + 1}"})
        else:
            logs.append({"timestamp": base, "level": "success", "message": "Completed and archived"})
        return logs

    monthly_points = [
        ("2025-09-03", "850", "Walmart", "inbound", "completed", "edi", "AS2"),
        ("2025-09-11", "855", "Walmart", "outbound", "completed", "edi", "AS2"),
        ("2025-09-20", "856", "Walmart", "outbound", "completed", "edi", "AS2"),
        ("2025-10-06", "810", "Walmart", "outbound", "completed", "edi", "AS2"),
        ("2025-10-09", "846", "Target", "inbound", "completed", "edi", "AS2"),
        ("2025-10-17", "832", "Target", "outbound", "processing", "edi", "AS2"),
        ("2025-11-09", "940", "Target", "outbound", "completed", "edi", "AS2"),
        ("2025-11-12", "945", "Target", "inbound", "completed", "edi", "AS2"),
        ("2025-11-18", "943", "Walmart", "outbound", "completed", "edi", "AS2"),
        ("2025-11-26", "944", "Walmart", "inbound", "completed", "edi", "AS2"),
        ("2025-12-10", "997", "Target", "inbound", "completed", "edi", "AS2"),
        ("2025-12-18", "999", "Walmart", "inbound", "completed", "edi", "AS2"),
        ("2026-01-08", "204", "Target", "outbound", "completed", "edi", "AS2"),
        ("2026-01-15", "210", "Target", "inbound", "completed", "edi", "AS2"),
        ("2026-01-24", "214", "Target", "inbound", "processing", "edi", "AS2"),
        ("2026-02-02", "PO", "Amazon API", "inbound", "completed", "api", "REST_API"),
        ("2026-02-10", "ASN", "Amazon API", "outbound", "completed", "api", "REST_API"),
        ("2026-02-18", "INV", "Amazon API", "outbound", "error", "api", "REST_API"),
        ("2026-02-24", "PO", "Amazon API", "inbound", "pending", "api", "REST_API"),
        ("2026-03-03", "850", "Walmart", "inbound", "pending", "edi", "AS2"),
    ]

    for idx, (date, doc, partner, direction, status, integration_type, channel) in enumerate(monthly_points, start=1):
        trx_id = f"TRX-{doc}-{idx:04d}"
        occurred_at = datetime.strptime(date + " 10:00:00", "%Y-%m-%d %H:%M:%S")
        control_no = f"CTRL{idx:05d}"
        payload_raw = build_raw(doc, direction, partner, idx, integration_type, date_str=date)
        payload_logs = build_logs(date, "10:00:00", status, integration_type, channel, idx)
        payload_errors = [] if status != "error" else [
            {
                "code": "API-VAL-003" if integration_type == "api" else "X12-VAL-017",
                "severity": "error",
                "segment": "IT1",
                "position": str(idx % 9 + 1),
                "message": "Quantity field failed validation",
                "details": "Expected numeric value with max 3 decimals",
            }
        ]

        row = existing.get(trx_id)
        if row:
            row.raw = payload_raw
            if not row.logs or len(row.logs) < 2:
                row.logs = payload_logs
            if row.status == "error" and not row.errors:
                row.errors = payload_errors
            if not row.type_name or row.type_name.startswith("Document "):
                row.type_name = type_names.get(doc, f"Document {doc}")
            continue

        db.add(
            Transaction(
                id=trx_id,
                type=doc,
                doc_type=doc,
                type_name=type_names.get(doc, f"Document {doc}"),
                partner=partner,
                direction=direction,
                status=status,
                date=date,
                time="10:00:00",
                size=f"{1.1 + (idx % 5) * 0.3:.1f} KB",
                records=(idx % 4) + 1,
                control_number=control_no,
                sender_id="UNIS-SENDER",
                receiver_id=f"{partner[:8].upper()}-RCV",
                integration_type=integration_type,
                channel=channel,
                source_system="seed",
                external_event_id=f"evt-{idx:04d}",
                idempotency_key=f"seed-idem-{idx:04d}",
                business_refs={"poNumber": f"PO-{idx:05d}", "shipmentId": f"SHP-{idx:05d}"},
                control_refs={"isaControlNo": f"ISA{idx:05d}", "gsControlNo": f"GS{idx:05d}"},
                occurred_at=occurred_at,
                raw=payload_raw,
                logs=payload_logs,
                errors=payload_errors,
                environment="production" if integration_type == "edi" else "sandbox",
                created_at=now,
            )
        )

    db.flush()
    link_exists = (
        db.query(TransactionLink)
        .filter(
            TransactionLink.from_transaction_id == "TRX-850-0001",
            TransactionLink.to_transaction_id == "TRX-856-0002",
            TransactionLink.relation_type == "ack",
        )
        .first()
    )
    has_from = db.query(Transaction).filter(Transaction.id == "TRX-850-0001").first()
    has_to = db.query(Transaction).filter(Transaction.id == "TRX-856-0002").first()
    if not link_exists and has_from and has_to:
        db.add(
            TransactionLink(
                from_transaction_id="TRX-850-0001",
                to_transaction_id="TRX-856-0002",
                relation_type="ack",
                match_rule="control_number",
                confidence=95,
                evidence={"controlNumber": "CTRL00001"},
            )
        )


def _seed_notifications(db: Session) -> None:
    seed_rows = [
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
    existing = {
        (x[0], x[1], x[2], x[3])
        for x in db.query(Notification.title, Notification.date, Notification.time, Notification.environment).all()
    }
    for row in seed_rows:
        key = (row.title, row.date, row.time, row.environment)
        if key in existing:
            continue
        db.add(row)


def _seed_specs(db: Session) -> None:
    existing_unis = {x.code: x for x in db.query(UnisSpecification).all()}
    for spec in UNIS_SPECS:
        row = existing_unis.get(spec["code"])
        if row:
            row.name = spec["name"]
            row.description = spec["description"]
            row.category = spec["category"]
            row.version = spec["version"]
            row.last_updated = spec["last_updated"]
        else:
            db.add(UnisSpecification(**spec))

    tp_rows = [
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
    existing_tp_ids = {x[0] for x in db.query(TpSpecification.id).all()}
    for row in tp_rows:
        if row.id in existing_tp_ids:
            existing = db.query(TpSpecification).filter(TpSpecification.id == row.id).first()
            if existing and not existing.file_path:
                existing.file_path = save_text_file(
                    f"TP Specification {existing.message_type} for {existing.partner}\nVersion: {existing.version}\n",
                    "specifications",
                    existing.file_name or f"{existing.id}.txt",
                )
            continue
        row.file_path = save_text_file(
            f"TP Specification {row.message_type} for {row.partner}\nVersion: {row.version}\n",
            "specifications",
            row.file_name,
        )
        db.add(row)


def _seed_api_and_integration(db: Session) -> None:
    if not db.query(IntegrationClient).filter(IntegrationClient.id == "integration-client-default").first():
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

    if not db.query(APIClient).filter(APIClient.client_id == "openapi-default-client").first():
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

    if not db.query(OAuthToken).filter(OAuthToken.client_id == "openapi-default-client", OAuthToken.revoked.is_(False)).first():
        db.add(
            OAuthToken(
                jti=f"jti-{uuid4().hex[:16]}",
                client_id="openapi-default-client",
                expires_at=datetime.utcnow() + timedelta(hours=1),
                revoked=False,
            )
        )

    existing_traces = {x[0] for x in db.query(APICallLog.trace_id).all()}
    for log in [
        APICallLog(trace_id="trace-seed-001", client_id="openapi-default-client", method="GET", path="/v1/transactions", status_code=200, latency_ms=35),
        APICallLog(trace_id="trace-seed-002", client_id="openapi-default-client", method="POST", path="/v1/connection-testing/api/run", status_code=200, latency_ms=140),
    ]:
        if log.trace_id in existing_traces:
            continue
        db.add(log)

    daily_key = datetime.utcnow().strftime("%Y-%m-%d")
    monthly_key = datetime.utcnow().strftime("%Y-%m")
    has_daily = (
        db.query(APIQuota)
        .filter(APIQuota.client_id == "openapi-default-client", APIQuota.period == "daily", APIQuota.period_key == daily_key)
        .first()
    )
    if not has_daily:
        db.add(APIQuota(client_id="openapi-default-client", period="daily", period_key=daily_key, count=212))
    has_monthly = (
        db.query(APIQuota)
        .filter(APIQuota.client_id == "openapi-default-client", APIQuota.period == "monthly", APIQuota.period_key == monthly_key)
        .first()
    )
    if not has_monthly:
        db.add(APIQuota(client_id="openapi-default-client", period="monthly", period_key=monthly_key, count=4931))


def _api_doc_detail(code: str, name: str, x12: str) -> tuple[dict, dict, dict, list[tuple[str, str, str | None, str]]]:
    """Return (schema, request_sample, response_sample, mappings) with full documentation content."""
    base_header_schema = {
        "type": "object",
        "description": "Envelope header present on all API messages.",
        "required": ["messageType", "transactionId"],
        "properties": {
            "messageType": {"type": "string", "description": "Message type code (e.g. 850, PO, 856)."},
            "transactionId": {"type": "string", "description": "Unique transaction identifier for idempotency and tracing."},
            "timestamp": {"type": "string", "format": "date-time", "description": "ISO 8601 timestamp when the message was created."},
            "direction": {"type": "string", "enum": ["inbound", "outbound"], "description": "Message flow direction."},
            "partnerCode": {"type": "string", "description": "Trading partner code (e.g. WMT, TGT)."},
        },
    }
    base_mappings = [
        ("header.messageType", "ST", "01", "X12 transaction set identifier code (ST01)."),
        ("header.transactionId", "ST", "02", "Transaction set control number (ST02)."),
        ("header.timestamp", "DTM", "02", "Date/time in BEG/BSN/BIG segment."),
        ("header.partnerCode", "N1", "04", "Receiver/sender ID qualifier (N104)."),
    ]

    if code == "850":
        schema = {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "description": "Purchase Order (X12 850). Request to buy goods or services. Contains buyer/seller IDs, PO number, requested date, and one or more line items with product ID, quantity, unit of measure, and price.",
            "type": "object",
            "required": ["header", "payload"],
            "properties": {
                "header": base_header_schema,
                "payload": {
                    "type": "object",
                    "description": "Purchase order business content.",
                    "required": ["poNumber", "orderDate", "buyer", "lineItems"],
                    "properties": {
                        "poNumber": {"type": "string", "description": "Purchase order number (BEG02)."},
                        "orderDate": {"type": "string", "format": "date", "description": "PO date (BEG05)."},
                        "buyer": {"type": "object", "properties": {"id": {"type": "string"}, "name": {"type": "string"}},
                            "description": "Buying party (N1 ST)."},
                        "seller": {"type": "object", "properties": {"id": {"type": "string"}, "name": {"type": "string"}}},
                        "lineItems": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "required": ["lineNumber", "sku", "quantity", "uom"],
                                "properties": {
                                    "lineNumber": {"type": "integer"},
                                    "sku": {"type": "string", "description": "Vendor part number (VP)."},
                                    "quantity": {"type": "number"},
                                    "uom": {"type": "string", "enum": ["EA", "BX", "PLT"], "description": "Unit of measure."},
                                    "unitPrice": {"type": "number"},
                                    "description": {"type": "string"},
                                },
                            },
                        },
                    },
                },
            },
        }
        req = {
            "header": {"messageType": "850", "transactionId": "850-REQ-1001", "timestamp": "2026-03-01T10:00:00Z", "direction": "inbound", "partnerCode": "WMT"},
            "payload": {
                "poNumber": "PO-20260301-001",
                "orderDate": "2026-03-01",
                "buyer": {"id": "WMT", "name": "Walmart"},
                "seller": {"id": "UNIS", "name": "UNIS Corp"},
                "lineItems": [
                    {"lineNumber": 1, "sku": "SKU-1001", "quantity": 120, "uom": "EA", "unitPrice": 25.99, "description": "Widget A"},
                    {"lineNumber": 2, "sku": "SKU-1002", "quantity": 48, "uom": "BX", "unitPrice": 18.50},
                ],
            },
        }
        rsp = {"accepted": True, "messageType": "850", "documentId": "850-DOC-1001", "status": "RECEIVED", "controlNumber": "300001"}
        mappings = base_mappings + [
            ("payload.poNumber", "BEG", "03", "Purchase order number (BEG03)."),
            ("payload.orderDate", "BEG", "05", "Date (BEG05)."),
            ("payload.buyer.id", "N1", "04", "Buyer ID (N104) when N101=ST."),
            ("payload.lineItems[].sku", "PO1", "07", "Vendor part number (VP)."),
            ("payload.lineItems[].quantity", "PO1", "02", "Quantity ordered (PO102)."),
            ("payload.lineItems[].uom", "PO1", "03", "Unit of measure (PO103)."),
            ("payload.lineItems[].unitPrice", "PO1", "04", "Unit price (PO104)."),
        ]
        return (schema, req, rsp, mappings)

    if code == "855":
        schema = {
            "description": "Purchase Order Acknowledgment (X12 855). Confirms receipt and acceptance/rejection of a purchase order. Maps to BAK and PO1 with acknowledgment code (IA=accepted, IR=rejected).",
            "type": "object",
            "required": ["header", "payload"],
            "properties": {
                "header": base_header_schema,
                "payload": {
                    "type": "object",
                    "required": ["poNumber", "ackDate", "ackCode", "lines"],
                    "properties": {
                        "poNumber": {"type": "string"},
                        "ackDate": {"type": "string", "format": "date"},
                        "ackCode": {"type": "string", "enum": ["IA", "IR"], "description": "IA=Accepted, IR=Rejected."},
                        "lines": {"type": "array", "items": {"type": "object", "properties": {"lineNumber": {}, "sku": {}, "quantity": {}, "ackCode": {}}}},
                    },
                },
            },
        }
        req = {
            "header": {"messageType": "855", "transactionId": "855-REQ-1001", "timestamp": "2026-03-02T09:00:00Z", "partnerCode": "WMT"},
            "payload": {
                "poNumber": "PO-20260301-001",
                "ackDate": "2026-03-02",
                "ackCode": "IA",
                "lines": [{"lineNumber": 1, "sku": "SKU-1001", "quantity": 120, "ackCode": "IA"}, {"lineNumber": 2, "sku": "SKU-1002", "quantity": 48, "ackCode": "IA"}],
            },
        }
        rsp = {"accepted": True, "documentId": "855-DOC-1001", "status": "RECEIVED"}
        mappings = base_mappings + [
            ("payload.poNumber", "BAK", "03", "PO number being acknowledged (BAK03)."),
            ("payload.ackDate", "BAK", "05", "Acknowledgment date (BAK05)."),
            ("payload.ackCode", "BAK", "02", "Transaction set purpose (AT=ack)."),
            ("payload.lines[].sku", "PO1", "07", "VP; PO1 with quantity and ACK code."),
        ]
        return (schema, req, rsp, mappings)

    if code == "856":
        schema = {
            "description": "Advance Ship Notice / ASN (X12 856). Notifies the recipient of shipment contents, carrier, tracking, and expected delivery. Uses BSN, HL hierarchy, TD1/TD5, REF (BOL), DTM, N1, LIN/SN1.",
            "type": "object",
            "required": ["header", "payload"],
            "properties": {
                "header": base_header_schema,
                "payload": {
                    "type": "object",
                    "required": ["shipmentId", "shipDate", "carrier", "lineItems"],
                    "properties": {
                        "shipmentId": {"type": "string"},
                        "shipDate": {"type": "string", "format": "date"},
                        "carrier": {"type": "object", "properties": {"scac": {"type": "string"}, "name": {"type": "string"}}},
                        "trackingNumber": {"type": "string"},
                        "billOfLading": {"type": "string"},
                        "shipTo": {"type": "object", "properties": {"id": {}, "name": {}}},
                        "lineItems": {"type": "array", "items": {"type": "object", "properties": {"sku": {}, "quantityShipped": {}, "uom": {}}}},
                    },
                },
            },
        }
        req = {
            "header": {"messageType": "856", "transactionId": "856-REQ-1001", "timestamp": "2026-03-05T14:00:00Z", "partnerCode": "WMT"},
            "payload": {
                "shipmentId": "SHP-20260305-001",
                "shipDate": "2026-03-05",
                "carrier": {"scac": "FEDX", "name": "FedEx Ground"},
                "trackingNumber": "1Z999AA10123456784",
                "billOfLading": "BOL-001",
                "shipTo": {"id": "WMT", "name": "Walmart DC 1234"},
                "lineItems": [{"sku": "SKU-1001", "quantityShipped": 120, "uom": "EA"}, {"sku": "SKU-1002", "quantityShipped": 48, "uom": "BX"}],
            },
        }
        rsp = {"accepted": True, "documentId": "856-DOC-1001", "status": "RECEIVED"}
        mappings = base_mappings + [
            ("payload.shipmentId", "BSN", "02", "Shipment identification (BSN02)."),
            ("payload.shipDate", "BSN", "03", "Ship date (BSN03)."),
            ("payload.carrier.scac", "TD5", "03", "Standard carrier alpha code (TD503)."),
            ("payload.trackingNumber", "REF", "02", "REF qualifier BM or CN (REF02)."),
            ("payload.lineItems[].sku", "LIN", "03", "VP (LIN03)."),
            ("payload.lineItems[].quantityShipped", "SN1", "02", "Quantity shipped (SN102)."),
        ]
        return (schema, req, rsp, mappings)

    if code == "810":
        schema = {
            "description": "Invoice (X12 810). Commercial invoice with header (invoice number, date, PO reference), ship-to, and line items (IT1) with quantity, price, extended amount; TDS for total.",
            "type": "object",
            "required": ["header", "payload"],
            "properties": {
                "header": base_header_schema,
                "payload": {
                    "type": "object",
                    "required": ["invoiceNumber", "invoiceDate", "poNumber", "lineItems"],
                    "properties": {
                        "invoiceNumber": {"type": "string"},
                        "invoiceDate": {"type": "string", "format": "date"},
                        "poNumber": {"type": "string"},
                        "shipTo": {"type": "object"},
                        "lineItems": {"type": "array", "items": {"type": "object", "properties": {"lineNumber": {}, "sku": {}, "quantity": {}, "unitPrice": {}, "extendedAmount": {}}}},
                        "totalAmount": {"type": "number"},
                    },
                },
            },
        }
        req = {
            "header": {"messageType": "810", "transactionId": "810-REQ-1001", "timestamp": "2026-03-10T10:00:00Z", "partnerCode": "WMT"},
            "payload": {
                "invoiceNumber": "INV-20260310-001",
                "invoiceDate": "2026-03-10",
                "poNumber": "PO-20260301-001",
                "shipTo": {"id": "WMT", "name": "Walmart DC"},
                "lineItems": [
                    {"lineNumber": 1, "sku": "SKU-1001", "quantity": 120, "unitPrice": 25.99, "extendedAmount": 3118.80},
                    {"lineNumber": 2, "sku": "SKU-1002", "quantity": 48, "unitPrice": 18.50, "extendedAmount": 888.00},
                ],
                "totalAmount": 4006.80,
            },
        }
        rsp = {"accepted": True, "documentId": "810-DOC-1001", "status": "RECEIVED"}
        mappings = base_mappings + [
            ("payload.invoiceNumber", "BIG", "02", "Invoice number (BIG02)."),
            ("payload.invoiceDate", "BIG", "01", "Invoice date (BIG01)."),
            ("payload.poNumber", "BIG", "04", "PO number (BIG04)."),
            ("payload.lineItems[].sku", "IT1", "07", "VP (IT107)."),
            ("payload.lineItems[].quantity", "IT1", "02", "Quantity (IT102)."),
            ("payload.lineItems[].unitPrice", "IT1", "04", "Unit price (IT104)."),
            ("payload.totalAmount", "TDS", "01", "Total amount (TDS01)."),
        ]
        return (schema, req, rsp, mappings)

    if code == "997":
        schema = {
            "description": "Functional Acknowledgment (X12 997). Confirms receipt and syntax validation of an EDI interchange. AK1 identifies the functional group; AK9 reports accept/reject and segment counts.",
            "type": "object",
            "required": ["header", "payload"],
            "properties": {
                "header": base_header_schema,
                "payload": {
                    "type": "object",
                    "properties": {"functionalGroupId": {}, "ackCode": {"enum": ["A", "E", "R"]}, "tsCount": {}, "receivedCount": {}},
                },
            },
        }
        req = {
            "header": {"messageType": "997", "transactionId": "997-REQ-1001", "timestamp": "2026-03-01T10:05:00Z"},
            "payload": {"functionalGroupId": "PO", "ackCode": "A", "tsCount": 1, "receivedCount": 1},
        }
        rsp = {"accepted": True, "documentId": "997-DOC-1001"}
        mappings = base_mappings + [
            ("payload.functionalGroupId", "AK1", "01", "Functional ID (AK101)."),
            ("payload.ackCode", "AK9", "01", "A=Accepted, E=Accepted with errors, R=Rejected (AK901)."),
            ("payload.tsCount", "AK9", "02", "Number of transaction sets (AK902)."),
        ]
        return (schema, req, rsp, mappings)

    if code == "PO":
        schema = {
            "description": "API Purchase Order. REST representation of a purchase order; equivalent to X12 850. Submit to create a PO; response returns documentId and status.",
            "type": "object",
            "required": ["header", "payload"],
            "properties": {
                "header": base_header_schema,
                "payload": {
                    "type": "object",
                    "required": ["poNumber", "orderDate", "partnerCode", "lineItems"],
                    "properties": {
                        "poNumber": {"type": "string"},
                        "orderDate": {"type": "string", "format": "date"},
                        "partnerCode": {"type": "string"},
                        "lineItems": {"type": "array", "items": {"type": "object", "required": ["sku", "qty"], "properties": {"sku": {}, "qty": {}, "unitPrice": {}, "uom": {}}}},
                    },
                },
            },
        }
        req = {
            "header": {"messageType": "PO", "transactionId": "api-po-1001", "timestamp": "2026-03-01T10:00:00Z", "direction": "inbound", "partnerCode": "AMZN"},
            "payload": {
                "poNumber": "PO-API-1001",
                "orderDate": "2026-03-01",
                "partnerCode": "AMZN",
                "lineItems": [{"sku": "SKU-1001", "qty": 120, "unitPrice": 25.99, "uom": "EA"}, {"sku": "SKU-1002", "qty": 48, "unitPrice": 18.50, "uom": "BX"}],
            },
        }
        rsp = {"accepted": True, "messageType": "PO", "documentId": "PO-DOC-1001", "status": "RECEIVED"}
        mappings = base_mappings + [("payload.poNumber", "BEG", "03", "Maps to X12 850 BEG03."), ("payload.lineItems[].sku", "PO1", "07", "VP."), ("payload.lineItems[].qty", "PO1", "02", "Quantity.")]
        return (schema, req, rsp, mappings)

    if code == "ASN":
        schema = {
            "description": "API Advance Ship Notice. REST representation of an ASN; equivalent to X12 856. Includes shipment id, carrier, tracking, and line-level quantity shipped.",
            "type": "object",
            "required": ["header", "payload"],
            "properties": {
                "header": base_header_schema,
                "payload": {
                    "type": "object",
                    "required": ["shipmentId", "shipDate", "carrier", "lines"],
                    "properties": {
                        "shipmentId": {"type": "string"},
                        "shipDate": {"type": "string", "format": "date"},
                        "carrier": {"type": "string"},
                        "trackingNumber": {"type": "string"},
                        "lines": {"type": "array", "items": {"type": "object", "properties": {"sku": {}, "quantityShipped": {}, "uom": {}}}},
                    },
                },
            },
        }
        req = {
            "header": {"messageType": "ASN", "transactionId": "api-asn-1001", "timestamp": "2026-03-05T14:00:00Z", "partnerCode": "AMZN"},
            "payload": {
                "shipmentId": "SHP-API-1001",
                "shipDate": "2026-03-05",
                "carrier": "FEDX",
                "trackingNumber": "1Z999AA10123456784",
                "lines": [{"sku": "SKU-1001", "quantityShipped": 120, "uom": "EA"}, {"sku": "SKU-1002", "quantityShipped": 48, "uom": "BX"}],
            },
        }
        rsp = {"accepted": True, "documentId": "ASN-DOC-1001", "status": "RECEIVED"}
        mappings = base_mappings + [("payload.shipmentId", "BSN", "02", "Maps to 856 BSN02."), ("payload.lines[].sku", "LIN", "03", "VP."), ("payload.lines[].quantityShipped", "SN1", "02", "Quantity shipped.")]
        return (schema, req, rsp, mappings)

    if code == "INV":
        schema = {
            "description": "API Invoice. REST representation of an invoice; equivalent to X12 810. Submit invoice number, date, PO reference, and line items with amounts.",
            "type": "object",
            "required": ["header", "payload"],
            "properties": {
                "header": base_header_schema,
                "payload": {
                    "type": "object",
                    "required": ["invoiceNumber", "invoiceDate", "poNumber", "lineItems"],
                    "properties": {
                        "invoiceNumber": {"type": "string"},
                        "invoiceDate": {"type": "string", "format": "date"},
                        "poNumber": {"type": "string"},
                        "lineItems": {"type": "array", "items": {"type": "object", "properties": {"sku": {}, "qty": {}, "unitPrice": {}, "extendedAmount": {}}}},
                    },
                },
            },
        }
        req = {
            "header": {"messageType": "INV", "transactionId": "api-inv-1001", "timestamp": "2026-03-10T10:00:00Z", "partnerCode": "AMZN"},
            "payload": {
                "invoiceNumber": "INV-API-1001",
                "invoiceDate": "2026-03-10",
                "poNumber": "PO-API-1001",
                "lineItems": [{"sku": "SKU-1001", "qty": 120, "unitPrice": 25.99, "extendedAmount": 3118.80}],
            },
        }
        rsp = {"accepted": True, "documentId": "INV-DOC-1001", "status": "RECEIVED"}
        mappings = base_mappings + [("payload.invoiceNumber", "BIG", "02", "Maps to 810 BIG02."), ("payload.lineItems[].sku", "IT1", "07", "VP."), ("payload.lineItems[].extendedAmount", "IT1", "05", "Extended amount.")]
        return (schema, req, rsp, mappings)

    # Generic detailed template for other message types (832, 846, 940, 943, 944, 945, 947, 999, 204, 210, 214)
    schema = {
        "description": f"{name} (X12 {x12}). See X12 {x12} implementation guide for segment layout and usage. This API message carries the same business data in JSON form.",
        "type": "object",
        "required": ["header", "payload"],
        "properties": {
            "header": base_header_schema,
            "payload": {
                "type": "object",
                "description": f"Business payload for {name}.",
                "properties": {
                    "reference": {"type": "string", "description": "Business or control reference."},
                    "partnerCode": {"type": "string"},
                    "date": {"type": "string", "format": "date"},
                    "lines": {"type": "array", "items": {"type": "object", "properties": {"id": {}, "quantity": {}, "uom": {}}}},
                },
            },
        },
    }
    req = {
        "header": {"messageType": code, "transactionId": f"{code}-REQ-1001", "timestamp": "2026-03-01T10:00:00Z", "partnerCode": "WMT"},
        "payload": {"reference": f"REF-{code}-1001", "partnerCode": "WMT", "date": "2026-03-01", "lines": [{"id": "SKU-1001", "quantity": 100, "uom": "EA"}]},
    }
    rsp = {"accepted": True, "messageType": code, "documentId": f"{code}-DOC-1001", "status": "RECEIVED"}
    mappings = base_mappings + [
        ("payload.reference", "REF", "02", f"Business reference; X12 {x12} REF02 or equivalent."),
        ("payload.partnerCode", "N1", "04", "Trading partner ID (N104)."),
        ("payload.date", "DTM", "02", "Date in applicable segment (BEG/BSN/BIG/DTM)."),
    ]
    return (schema, req, rsp, mappings)

def _seed_api_docs(db: Session) -> None:
    catalog = [
        ("204", "LoadTender", "shipping", "204"),
        ("210", "FreightInvoice", "shipping", "210"),
        ("214", "ShipmentStatus", "shipping", "214"),
        ("810", "Invoice", "financial", "810"),
        ("832", "PriceCatalog", "catalog", "832"),
        ("846", "InventoryAdvice", "inventory", "846"),
        ("850", "PurchaseOrder", "order", "850"),
        ("855", "PurchaseOrderAcknowledgment", "order", "855"),
        ("856", "AdvanceShipNotice", "shipping", "856"),
        ("940", "WarehouseShippingOrder", "warehouse", "940"),
        ("943", "WarehouseStockTransferShipmentAdvice", "warehouse", "943"),
        ("944", "WarehouseStockTransferReceiptAdvice", "warehouse", "944"),
        ("945", "WarehouseShippingAdvice", "warehouse", "945"),
        ("947", "WarehouseInventoryAdjustmentAdvice", "warehouse", "947"),
        ("997", "FunctionalAcknowledgment", "acknowledgment", "997"),
        ("999", "ImplementationAcknowledgment", "acknowledgment", "999"),
        ("PO", "ApiPurchaseOrder", "api-order", "850"),
        ("ASN", "ApiAdvanceShipNotice", "api-shipping", "856"),
        ("INV", "ApiInvoice", "api-financial", "810"),
    ]

    existing_messages = {x.code: x for x in db.query(APIMessage).all()}
    for code, name, category, x12 in catalog:
        row = existing_messages.get(code)
        if row:
            row.name = name
            row.category = category
            row.x12_equivalent = x12
            row.version = "v2.1"
        else:
            db.add(APIMessage(code=code, name=name, category=category, x12_equivalent=x12, version="v2.1"))
    db.flush()

    existing_schemas = {
        (x[0], x[1]): x[2] for x in db.query(APIMessageSchema.message_code, APIMessageSchema.version, APIMessageSchema).all()
    }
    existing_samples = {
        (x[0], x[1]): x[2] for x in db.query(APIMessageSample.message_code, APIMessageSample.sample_type, APIMessageSample).all()
    }
    existing_mappings = {
        (x[0], x[1]): x[2] for x in db.query(APIMessageMapping.message_code, APIMessageMapping.json_field, APIMessageMapping).all()
    }

    for code, name, category, x12 in catalog:
        schema, req_sample, rsp_sample, mapping_rows = _api_doc_detail(code, name, x12)

        key_s = (code, "v2.1")
        if key_s in existing_schemas:
            existing_schemas[key_s].schema = schema
        else:
            db.add(APIMessageSchema(message_code=code, version="v2.1", schema=schema))

        for sample_type, content in [("request", req_sample), ("response", rsp_sample)]:
            key_p = (code, sample_type)
            if key_p in existing_samples:
                existing_samples[key_p].content = content
            else:
                db.add(APIMessageSample(message_code=code, sample_type=sample_type, content=content))

        for json_field, seg, elem, notes in mapping_rows:
            key_m = (code, json_field)
            if key_m in existing_mappings:
                existing = existing_mappings[key_m]
                existing.x12_segment = seg
                existing.x12_element = elem
                existing.notes = notes
            else:
                db.add(
                    APIMessageMapping(
                        message_code=code,
                        json_field=json_field,
                        x12_segment=seg,
                        x12_element=elem,
                        notes=notes,
                    )
                )


def _seed_connection_testing(db: Session) -> None:
    run_id = "ctr-seed-0001"
    run = db.query(ConnectionTestRun).filter(ConnectionTestRun.id == run_id).first()
    if not run:
        run = ConnectionTestRun(
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
        db.add(run)
        db.flush()
    existing_steps = {x[0] for x in db.query(ConnectionTestStep.step_no).filter(ConnectionTestStep.run_id == run_id).all()}
    step_names = [
        "DNS Reachability",
        "TLS Handshake",
        "AS2 Identifier Validation",
        "Signature Verification",
        "Encryption/Decryption Check",
        "MDN Roundtrip",
        "Functional ACK Check",
    ]
    for i, name in enumerate(step_names, start=1):
        if i in existing_steps:
            continue
        db.add(
            ConnectionTestStep(
                run_id=run_id,
                step_no=i,
                name=name,
                status="passed",
                latency_ms=20 + i,
                detail="diagnostic passed",
                evidence={"seed": True, "step": name, "latencyMs": 20 + i},
            )
        )

    api_run_id = "ctr-seed-0002"
    api_run = db.query(ConnectionTestRun).filter(ConnectionTestRun.id == api_run_id).first()
    if not api_run:
        api_run = ConnectionTestRun(
            id=api_run_id,
            partner_id="tp-002",
            test_type="api",
            environment="sandbox",
            status="partial",
            summary={"passedSteps": 5, "failedSteps": 1, "totalSteps": 6, "endpoint": "https://httpbin.org/get"},
            started_at=datetime.utcnow() - timedelta(days=1, minutes=3),
            finished_at=datetime.utcnow() - timedelta(days=1),
            trace_id="trace-conn-0002",
        )
        db.add(api_run)
        db.flush()
    existing_api_steps = {
        x[0] for x in db.query(ConnectionTestStep.step_no).filter(ConnectionTestStep.run_id == api_run_id).all()
    }
    api_steps = [
        ("Endpoint Reachability", "passed", 23, "dns resolved", {"host": "httpbin.org"}),
        ("TLS Certificate Check", "passed", 31, "certificate chain verified", {"issuer": "Amazon"}),
        ("Auth Preparation", "passed", 5, "oauth2 selected", {"tokenReady": False}),
        ("Authenticated Request", "passed", 121, "HTTP 200", {"statusCode": 200}),
        ("Schema Sanity", "passed", 2, "sample payload is object", {"sampleType": "dict"}),
        ("Response Contract Check", "failed", 1, "response did not contain expected document id", {"contentType": "application/json"}),
    ]
    for step_no, (name, status, latency, detail, evidence) in enumerate(api_steps, start=1):
        if step_no in existing_api_steps:
            continue
        db.add(
            ConnectionTestStep(
                run_id=api_run_id,
                step_no=step_no,
                name=name,
                status=status,
                latency_ms=latency,
                detail=detail,
                evidence=evidence,
            )
        )

    if not db.query(DocumentTestReport).filter(DocumentTestReport.id == "dtr-seed-0001").first():
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

    if not db.query(ValidatorReport).filter(ValidatorReport.id == "vr-seed-0001").first():
        db.add(ValidatorReport(id="vr-seed-0001", format="json", valid=True, errors=[], warnings=[]))
    if not db.query(ValidatorReport).filter(ValidatorReport.id == "vr-seed-0002").first():
        db.add(
            ValidatorReport(
                id="vr-seed-0002",
                format="x12",
                valid=False,
                errors=[{"code": "API-VAL-001", "message": "Missing ISA segment"}],
                warnings=[],
            )
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
                    as2_port=443,
                    sender_id="UNIS-AS2",
                    sender_qualifier="ZZ",
                    receiver_id=f"{sub.code}-AS2-AUTO",
                    receiver_qualifier="ZZ",
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
