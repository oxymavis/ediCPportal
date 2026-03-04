from __future__ import annotations
from fastapi import APIRouter

from app.schemas.common import ok

router = APIRouter(tags=['health'])


@router.get('/health')
def health():
    return ok({'status': 'ok'})
