from __future__ import annotations

from app.core.config import settings
from app.schemas.common import ok
from fastapi import APIRouter

router = APIRouter(prefix='/v1/meta', tags=['meta'])


@router.get('/version')
def get_version():
    return ok({'version': settings.platform_version, 'name': settings.app_name})


@router.get('/health')
def get_meta_health():
    return ok({'status': 'ok', 'service': settings.app_name})
