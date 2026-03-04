from __future__ import annotations
from typing import Any

from pydantic import BaseModel


class ApiResponse(BaseModel):
    success: bool
    data: Any | None = None
    error: str | None = None
    code: str | None = None


def ok(data: Any = None) -> dict:
    return {'success': True, 'data': data}


def fail(error: str, code: str | None = None) -> dict:
    return {'success': False, 'error': error, 'code': code}
