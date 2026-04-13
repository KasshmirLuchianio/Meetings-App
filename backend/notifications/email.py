"""
Local SMTP email sender — replaces Resend cloud dependency.
Works with any SMTP server: Mailhog (dev), Postfix (prod), Exchange (enterprise).
Fully air-gapped capable when SMTP_HOST points to an on-premise mail server.
"""
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from config import settings


def send_email(to: str, subject: str, html: str, text: Optional[str] = None) -> None:
    """
    Send an email via SMTP.
    Silently logs errors instead of crashing — email failures should not
    block authentication flows.
    """
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to

    if text:
        msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        if settings.SMTP_TLS:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=context) as server:
                if settings.SMTP_USER:
                    server.login(settings.SMTP_USER, settings.SMTP_PASS)
                server.sendmail(settings.SMTP_FROM, to, msg.as_string())
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.ehlo()
                if settings.SMTP_USER:
                    server.starttls()
                    server.login(settings.SMTP_USER, settings.SMTP_PASS)
                server.sendmail(settings.SMTP_FROM, to, msg.as_string())

        print(f"[EMAIL] Sent '{subject}' to {to}")
    except Exception as e:
        print(f"[EMAIL] Failed to send to {to}: {e}")
        raise


# ── Email templates ────────────────────────────────────────────────────────────

def _base_html(content: str) -> str:
    institution = settings.INSTITUTION_NAME
    return f"""
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;">
        <h2 style="color:#1B2A4A;margin-bottom:4px;">{institution}</h2>
        <hr style="border:none;border-top:2px solid #1B2A4A;margin:0 0 24px 0;">
        {content}
        <hr style="border:none;border-top:1px solid #eee;margin:30px 0 16px 0;">
        <p style="color:#aaa;font-size:11px;">{institution} — Platformă de transcriere și sinteză AI</p>
    </div>
    """


def build_verification_html(verify_token: str) -> str:
    verify_url = f"{settings.APP_BASE_URL}/api/auth/verify?token={verify_token}"
    content = f"""
        <h3 style="color:#1B2A4A;">Confirmare cont</h3>
        <p style="color:#444;font-size:15px;">Bun venit! Apasă butonul de mai jos pentru a-ți activa contul.</p>
        <a href="{verify_url}"
           style="display:inline-block;background:#1B2A4A;color:#FAF8F3;padding:14px 28px;
                  border-radius:8px;text-decoration:none;font-size:15px;margin:20px 0;">
            Confirmă contul
        </a>
        <p style="color:#888;font-size:12px;">Link-ul expiră în 24 de ore.</p>
    """
    return _base_html(content)


def build_reset_html(short_code: str) -> str:
    content = f"""
        <h3 style="color:#1B2A4A;">Resetare parolă</h3>
        <p style="color:#444;font-size:15px;">Ai solicitat resetarea parolei. Folosește codul de mai jos în aplicație:</p>
        <div style="background:#F3F4F6;padding:20px;border-radius:8px;text-align:center;margin:20px 0;">
            <span style="font-size:28px;font-weight:bold;color:#1B2A4A;letter-spacing:4px;">{short_code}</span>
        </div>
        <p style="color:#888;font-size:12px;">Codul expiră în 1 oră. Dacă nu ai solicitat resetarea, ignoră acest email.</p>
    """
    return _base_html(content)
