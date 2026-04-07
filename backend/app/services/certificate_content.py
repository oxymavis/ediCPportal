from __future__ import annotations

import base64
import re

_PEM_BLOCK_RE = re.compile(r'-----BEGIN [^-]+-----\s*(.*?)\s*-----END [^-]+-----', re.DOTALL)


def _try_base64_decode(value: str) -> bytes | None:
    try:
        return base64.b64decode(value, validate=False)
    except Exception:
        return None


def normalize_certificate_raw_content(raw_content: str | None) -> tuple[str | None, bytes | None]:
    stripped = (raw_content or '').strip()
    if not stripped:
        return None, None

    pem_match = _PEM_BLOCK_RE.search(stripped)
    if pem_match:
        normalized = ''.join(pem_match.group(1).split())
        return normalized or None, _try_base64_decode(normalized)

    normalized = ''.join(stripped.split())
    return normalized or None, _try_base64_decode(normalized)


def derive_certificate_raw_content(file_bytes: bytes, filename: str | None = None) -> tuple[str | None, bytes | None]:
    del filename
    if not file_bytes:
        return None, None

    try:
        decoded_text = file_bytes.decode('utf-8')
    except UnicodeDecodeError:
        return base64.b64encode(file_bytes).decode('ascii'), file_bytes

    normalized, decoded_bytes = normalize_certificate_raw_content(decoded_text)
    if normalized:
        return normalized, decoded_bytes or file_bytes

    return base64.b64encode(file_bytes).decode('ascii'), file_bytes


def build_external_certificate_chain(raw_content: str | None) -> list[str]:
    normalized, _ = normalize_certificate_raw_content(raw_content)
    return [normalized] if normalized else []
