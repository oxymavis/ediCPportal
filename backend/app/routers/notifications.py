from __future__ import annotations
from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Notification
from app.schemas.common import fail, ok
from app.services.deps import get_actor, require_csrf, require_scope
from app.services.mappers import notification_to_api

router = APIRouter(prefix='/v1/notifications', tags=['notifications'], dependencies=[Depends(get_actor), Depends(require_scope('notifications'))])


@router.get('')
def list_notifications(
    environment: str | None = None,
    type: str | None = None,
    showArchived: bool = False,
    db: Session = Depends(get_db),
):
    q = db.query(Notification)
    if environment:
        q = q.filter(Notification.environment == environment)
    if type and type != 'all':
        q = q.filter(Notification.type == type)
    if not showArchived:
        q = q.filter(Notification.archived.is_(False))
    rows = q.all()
    rows = sorted(rows, key=lambda r: f'{r.date}{r.time}', reverse=True)
    return ok([notification_to_api(r) for r in rows])


@router.put('/mark-all-read')
def mark_all_read(
    payload: dict = Body(default={}),
    _csrf: None = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    env = payload.get('environment')
    q = db.query(Notification).filter(Notification.archived.is_(False))
    if env:
        q = q.filter(Notification.environment == env)
    count = q.count()
    q.update({'read': True})
    db.commit()
    return ok({'updated': count})


@router.get('/{notif_id}')
def get_notification(notif_id: int, db: Session = Depends(get_db)):
    n = db.query(Notification).filter(Notification.id == notif_id).first()
    if not n:
        return fail('Notification not found', 'NOTIF_NOT_FOUND')
    return ok(notification_to_api(n))


@router.put('/{notif_id}')
def update_notification(
    notif_id: int,
    payload: dict,
    _csrf: None = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    n = db.query(Notification).filter(Notification.id == notif_id).first()
    if not n:
        return fail('Notification not found', 'NOTIF_NOT_FOUND')
    if payload.get('read') is not None:
        n.read = bool(payload['read'])
    if payload.get('archived') is not None:
        n.archived = bool(payload['archived'])
    db.commit()
    db.refresh(n)
    return ok(notification_to_api(n))


@router.put('/{notif_id}/read')
def mark_read(notif_id: int, _csrf: None = Depends(require_csrf), db: Session = Depends(get_db)):
    n = db.query(Notification).filter(Notification.id == notif_id).first()
    if not n:
        return fail('Notification not found', 'NOTIF_NOT_FOUND')
    n.read = True
    db.commit()
    return ok(notification_to_api(n))
