from __future__ import annotations

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.seed import seed_if_empty


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_if_empty(db)
    finally:
        db.close()


if __name__ == '__main__':
    init_db()
    print('Database initialized and seed applied (if empty).')
