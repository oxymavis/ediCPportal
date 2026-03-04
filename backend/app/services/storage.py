from __future__ import annotations

from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.core.config import settings


def _safe_component(text: str) -> str:
    return ''.join(ch if ch.isalnum() or ch in {'-', '_', '.'} else '_' for ch in text)


def get_storage_root() -> Path:
    root = Path(settings.local_storage_path).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


async def save_upload_file(upload: UploadFile, category: str) -> str:
    now = datetime.utcnow().strftime('%Y%m%d')
    original_name = _safe_component(upload.filename or 'upload.bin')
    rel = Path(category) / now / f'{uuid4().hex}_{original_name}'
    abs_path = get_storage_root() / rel
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    data = await upload.read()
    abs_path.write_bytes(data)
    return rel.as_posix()


def save_text_file(content: str, category: str, filename: str) -> str:
    rel = Path(category) / datetime.utcnow().strftime('%Y%m%d') / f'{uuid4().hex}_{_safe_component(filename)}'
    abs_path = get_storage_root() / rel
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    abs_path.write_text(content, encoding='utf-8')
    return rel.as_posix()


def save_binary_file(data: bytes, category: str, filename: str) -> str:
    rel = Path(category) / datetime.utcnow().strftime('%Y%m%d') / f'{uuid4().hex}_{_safe_component(filename)}'
    abs_path = get_storage_root() / rel
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    abs_path.write_bytes(data)
    return rel.as_posix()


def resolve_relative_path(relative_path: str) -> Path:
    return (get_storage_root() / relative_path).resolve()
