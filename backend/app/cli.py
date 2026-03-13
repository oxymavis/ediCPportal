from __future__ import annotations

import argparse
import sys

from app.db.base import Base
from app.db.session import SessionLocal, engine
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
    Session,
    Subsidiary,
    TpSpecification,
    Transaction,
    TransactionLink,
    UnisSpecification,
    User,
    ValidatorReport,
)
from app.seed import seed_if_empty


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_if_empty(db)
    finally:
        db.close()


def verify_db() -> int:
    db = SessionLocal()
    try:
        checks = [
            ("users", db.query(User).count()),
            ("sessions", db.query(Session).count()),
            ("email_verification_tokens", db.query(EmailVerificationToken).count()),
            ("partners", db.query(Partner).count()),
            ("subsidiaries", db.query(Subsidiary).count()),
            ("as2_profiles", db.query(AS2Profile).count()),
            ("certificates", db.query(Certificate).count()),
            ("transactions", db.query(Transaction).count()),
            ("transaction_links", db.query(TransactionLink).count()),
            ("notifications", db.query(Notification).count()),
            ("unis_specifications", db.query(UnisSpecification).count()),
            ("tp_specifications", db.query(TpSpecification).count()),
            ("integration_clients", db.query(IntegrationClient).count()),
            ("api_clients", db.query(APIClient).count()),
            ("oauth_tokens", db.query(OAuthToken).count()),
            ("api_call_logs", db.query(APICallLog).count()),
            ("api_quotas", db.query(APIQuota).count()),
            ("api_messages", db.query(APIMessage).count()),
            ("api_message_schemas", db.query(APIMessageSchema).count()),
            ("api_message_samples", db.query(APIMessageSample).count()),
            ("api_message_mappings", db.query(APIMessageMapping).count()),
            ("connection_test_runs", db.query(ConnectionTestRun).count()),
            ("connection_test_steps", db.query(ConnectionTestStep).count()),
            ("document_test_reports", db.query(DocumentTestReport).count()),
            ("validator_reports", db.query(ValidatorReport).count()),
        ]
        missing = [name for name, count in checks if count == 0]
        for name, count in checks:
            print(f"{name}: {count}")
        if missing:
            print(f"FAILED: empty tables -> {', '.join(missing)}")
            return 1
        print("OK: all 25 tables contain data")
        return 0
    finally:
        db.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="DB bootstrap utilities")
    parser.add_argument("command", nargs="?", default="init", choices=["init", "seed", "verify", "all"])
    args = parser.parse_args()

    if args.command in {"init", "seed", "all"}:
        init_db()
        print("Database initialized and demo seed applied.")
    if args.command in {"verify", "all"}:
        sys.exit(verify_db())
