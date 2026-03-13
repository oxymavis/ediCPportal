import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault('DATABASE_URL', 'sqlite:///./test.db')
os.environ.setdefault('AUTH_SECRET', 'test-secret')
os.environ.setdefault('RATE_LIMIT_REQUESTS', '1000')
os.environ.setdefault('RATE_LIMIT_WINDOW_SECONDS', '60')

from app.db.base import Base  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope='session', autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    db_file = Path('test.db')
    if db_file.exists():
        db_file.unlink()


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c
