from __future__ import annotations

import smtplib
from email.message import EmailMessage

from app.core.config import settings


def send_verification_email(email: str, token: str) -> None:
    subject = 'Verify your EDI Portal account'
    body = f'Use this verification token: {token}'
    if settings.email_mode == 'mock':
        print(f'[MOCK EMAIL] verify token for {email}: {token}')
        return

    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = settings.smtp_from
    msg['To'] = email
    msg.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_username:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(msg)
