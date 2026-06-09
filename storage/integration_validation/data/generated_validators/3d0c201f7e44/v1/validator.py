from __future__ import annotations

import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[6]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.services.integration_validation.generic_validator import validate_generic
from app.services.integration_validation.schemas import ValidationPoint


SPEC_ID = "3d0c201f7e44"
BUILD_VERSION = "v1"
BASE_DIR = Path(__file__).resolve().parent


def load_points() -> list[ValidationPoint]:
    rules_path = BASE_DIR / "rules.json"
    payload = json.loads(rules_path.read_text(encoding="utf-8"))
    return [ValidationPoint(**point) for point in payload.get("points", [])]


def validate(edi_message: str):
    return validate_generic(edi_message, load_points())
