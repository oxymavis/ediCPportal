from datetime import datetime, timezone

from app.core.security import create_access_token, hash_password, verify_password


def test_password_hash_and_verify():
    pw = 'Password1'
    h = hash_password(pw)
    assert h != pw
    assert verify_password(pw, h)
    assert not verify_password('WrongPass1', h)


def test_access_token_ttl_respects_remember_me():
    _, exp_default = create_access_token('user-1', remember_me=False)
    _, exp_remember = create_access_token('user-1', remember_me=True)
    now = datetime.now(timezone.utc)

    default_hours = (exp_default - now).total_seconds() / 3600
    remember_hours = (exp_remember - now).total_seconds() / 3600

    assert default_hours <= 24.1
    assert default_hours >= 23.5
    assert remember_hours >= 24 * 29
