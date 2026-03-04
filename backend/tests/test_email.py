import smtplib

from app.core.config import settings
from app.services.email import send_verification_email


def test_send_verification_email_mock_mode(capsys):
    prev_mode = settings.email_mode
    settings.email_mode = 'mock'
    send_verification_email('mock@example.com', 'token-123')
    out = capsys.readouterr().out
    assert 'token-123' in out
    settings.email_mode = prev_mode


def test_send_verification_email_smtp_mode(monkeypatch):
    prev_mode = settings.email_mode
    prev_host = settings.smtp_host
    prev_port = settings.smtp_port
    prev_user = settings.smtp_username
    prev_pass = settings.smtp_password
    prev_tls = settings.smtp_use_tls

    sent = {'count': 0}

    class DummySMTP:
        def __init__(self, host, port, timeout):
            assert host == 'smtp.test.local'
            assert port == 2525
            assert timeout == 10

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def starttls(self):
            sent['tls'] = True

        def login(self, username, password):
            sent['login'] = (username, password)

        def send_message(self, msg):
            sent['count'] += 1
            assert msg['To'] == 'real@example.com'

    monkeypatch.setattr(smtplib, 'SMTP', DummySMTP)
    settings.email_mode = 'smtp'
    settings.smtp_host = 'smtp.test.local'
    settings.smtp_port = 2525
    settings.smtp_username = 'user'
    settings.smtp_password = 'pass'
    settings.smtp_use_tls = True

    send_verification_email('real@example.com', 'token-xyz')
    assert sent['count'] == 1
    assert sent.get('tls') is True
    assert sent.get('login') == ('user', 'pass')

    settings.email_mode = prev_mode
    settings.smtp_host = prev_host
    settings.smtp_port = prev_port
    settings.smtp_username = prev_user
    settings.smtp_password = prev_pass
    settings.smtp_use_tls = prev_tls
