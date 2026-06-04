#!/usr/bin/env python3
"""
Email template for GAL/primărie outreach.
STRUCTURE: Featured Image → Headline → Content → Logo + Contact → Footer
"""
import smtplib, ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from email.utils import formataddr
import os

SMTP = {
    'server': 'mail.privateemail.com',
    'port': 587,
    'email': 'contact@meetings-ro.app',
    'password': '5243Milanomilano1.',
    'from_name': 'Meetings.ro'
}

GOOGLE_PLAY = 'https://play.google.com/store/apps/details?id=ro.meetingsapp.meetings'
LOGO_PATH = "/mnt/c/Users/vladg/Downloads/Meetings.ro.png"
HERO_PATH = "/mnt/c/Users/vladg/Downloads/hero_desk.jpg"

# Styles
CONTAINER_STYLE = 'max-width:600px;margin:0 auto;font-family:Georgia,\'Times New Roman\',serif;color:#2d2d2d;'
SECTION_STYLE = 'padding:20px 24px;'
DIVIDER_STYLE = 'height:1px;background:#e0e0e0;margin:0 24px;'
HEADLINE_STYLE = 'font-family:Georgia,serif;font-size:22px;font-weight:bold;color:#1B2A4A;line-height:1.3;margin:0 0 12px 0;'
BODY_STYLE = 'font-size:15px;line-height:1.7;color:#333;'
BTN_STYLE = 'display:inline-block;padding:14px 36px;background:#1B2A4A;color:white;text-decoration:none;border-radius:5px;font-size:16px;font-weight:bold;'
TESTIMONIAL_STYLE = 'background:#f5f3ef;border-left:3px solid #1B2A4A;padding:14px 18px;margin:16px 0;border-radius:0 6px 6px 0;'
FOOTER_STYLE = 'font-size:12px;color:#999;line-height:1.5;text-align:center;padding:16px 24px;'


def build_email(institution_name, email_to, judet=""):
    """Build email: Hero Image → Headline → Content → Logo+Contact → Footer."""
    loc = f"din județul {judet}" if judet else ""
    subject = f"Automatizare proces-verbal conform OUG 54/2019 — {institution_name}"

    msg = MIMEMultipart('related')
    msg['From'] = formataddr((SMTP['from_name'], SMTP['email']))
    msg['To'] = email_to
    msg['Subject'] = subject
    msg['Reply-To'] = SMTP['email']

    # Hero image — only if exists
    has_hero = os.path.exists(HERO_PATH)
    hero_html = ''
    if has_hero:
        hero_html = f'''  <table width="100%" style="{CONTAINER_STYLE}background:#ffffff;border-radius:8px 8px 0 0;">
  <tr><td style="padding:0;">
    <img src="cid:hero" alt="Meetings.ro" style="display:block;width:100%;max-width:600px;height:auto;border-radius:8px 8px 0 0;">
  </td></tr>
  </table>'''

    html = f"""<!DOCTYPE html>
<html>
<body style="background:#f9f9f9;padding:0;margin:0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;">
<tr><td align="center" style="padding:20px 12px;">

  <!-- SECTION 1: HERO IMAGE -->
{hero_html}
  <!-- SECTION 2: HEADLINE -->
  <table width="100%" style="{CONTAINER_STYLE}background:#ffffff;">
  <tr><td style="{SECTION_STYLE}padding-top:24px;padding-bottom:8px;">
    <h1 style="{HEADLINE_STYLE}">
      Procesele-verbale nu se mai scriu de mână
    </h1>
  </td></tr>
  </table>

  <!-- SECTION 3: CONTENT -->
  <table width="100%" style="{CONTAINER_STYLE}background:#ffffff;">
  <tr><td style="{SECTION_STYLE}padding-top:8px;padding-bottom:20px;">

    <p style="{BODY_STYLE}">Stimate domnule director,</p>

    <p style="{BODY_STYLE}">Vă scriem pentru că <b>{institution_name}</b> {loc} organizează
    întâlniri periodice. Conform <b>OUG 54/2019</b>, fiecare ședință trebuie documentată
    cu proces-verbal semnat — iar asta înseamnă ore de transcriere manuală.</p>

    <p style="{BODY_STYLE}">Redactarea proceselor-verbale poate consuma între <b>12 și 15 ore
    pe lună</b>. Este o muncă necesară, dar care ține echipa de la lucrurile cu adevărat
    importante.</p>

    <p style="{BODY_STYLE}">De aceea am construit <b>Meetings.ro</b> — o aplicație care face
    totul automat:</p>

    <ul style="{BODY_STYLE}padding-left:20px;margin:8px 0 16px 0;">
      <li style="margin-bottom:6px;">Înregistrează audio direct din telefon sau tabletă</li>
      <li style="margin-bottom:6px;">Transcrie automat conversația în limba română</li>
      <li style="margin-bottom:6px;">Generează procesul-verbal cu structura corectă (gata de semnare)</li>
      <li style="margin-bottom:6px;">Exportă PDF sau Word pentru arhivare</li>
    </ul>

    <p style="{BODY_STYLE}">Totul este <b>conform OUG 54/2019</b>.</p>

    <!-- Testimonial -->
    <div style="{TESTIMONIAL_STYLE}">
      <p style="margin:0;font-size:14px;font-style:italic;color:#444;">
        „Aplicația este excepțională. Ne-a scutit de ore reale de muncă. Acum avem timp
        să ne concentrăm pe dezvoltarea zonelor rurale pe care le avem în rază de execuție.”
      </p>
      <p style="margin:8px 0 0 0;font-size:13px;font-weight:bold;color:#1B2A4A;">
        — GAL Oamenii Deltei, client Meetings.ro
      </p>
    </div>

    <!-- CTA Button -->
    <div style="text-align:center;margin:24px 0 8px 0;">
      <a href="{GOOGLE_PLAY}" style="{BTN_STYLE}">
        📲 Descarcă pe Google Play
      </a>
    </div>

    <p style="{BODY_STYLE}margin-top:16px;">Dacă aveți 15 minute, vă arătăm cum funcționează
    pentru {institution_name}. Întrebări? Răspundem personal.</p>

  </td></tr>
  </table>

  <!-- SECTION 4: LOGO + CONTACT -->
  <table width="100%" style="{CONTAINER_STYLE}background:#ffffff;">
  <tr><td style="{DIVIDER_STYLE}"></td></tr>
  <tr><td style="{SECTION_STYLE}text-align:center;">
    <img src="cid:logo" alt="Meetings.ro" width="140" style="display:inline-block;margin-bottom:10px;">
    <p style="font-size:13px;color:#666;margin:0;">
      📧 <a href="mailto:contact@meetings-ro.app" style="color:#1B2A4A;">contact@meetings-ro.app</a>
      &nbsp;|&nbsp;
      🌐 <a href="https://meetings-ro.app" style="color:#1B2A4A;">meetings-ro.app</a>
    </p>
  </td></tr>
  </table>

  <!-- SECTION 5: FOOTER -->
  <table width="100%" style="{CONTAINER_STYLE}background:#f5f3ef;border-radius:0 0 8px 8px;">
  <tr><td style="{FOOTER_STYLE}">
    <p style="margin:0 0 4px 0;">
      Ai primit acest email pentru că instituția ta organizează întâlniri conform OUG 54/2019.
    </p>
    <p style="margin:0;">
      <a href="mailto:contact@meetings-ro.app?subject=Dezabonare" style="color:#999;text-decoration:underline;">Dezabonare</a>
      &nbsp;|&nbsp;
      <a href="https://meetings-ro.app/privacy" style="color:#999;text-decoration:underline;">Politica de confidențialitate</a>
    </p>
  </td></tr>
  </table>

</td></tr>
</table>
</body>
</html>"""

    import re

    # Plain text fallback
    plain = re.sub('<[^>]+>', '', html)
    plain = re.sub(r'\n{3,}', '\n\n', plain).strip()

    alt_msg = MIMEMultipart('alternative')
    alt_msg.attach(MIMEText(plain, 'plain', 'utf-8'))
    alt_msg.attach(MIMEText(html, 'html', 'utf-8'))
    msg.attach(alt_msg)

    # Attach logo (bottom of email)
    if os.path.exists(LOGO_PATH):
        with open(LOGO_PATH, 'rb') as f:
            img = MIMEImage(f.read())
            img.add_header('Content-ID', '<logo>')
            img.add_header('Content-Disposition', 'inline')
            msg.attach(img)

    # Attach hero image (top of email)
    if has_hero:
        with open(HERO_PATH, 'rb') as f:
            img = MIMEImage(f.read())
            img.add_header('Content-ID', '<hero>')
            img.add_header('Content-Disposition', 'inline')
            msg.attach(img)

    return msg


def send_email(institution_name, email_to, judet=""):
    """Send one email."""
    msg = build_email(institution_name, email_to, judet)
    context = ssl.create_default_context()
    with smtplib.SMTP(SMTP['server'], SMTP['port']) as server:
        server.starttls(context=context)
        server.login(SMTP['email'], SMTP['password'])
        server.sendmail(SMTP['email'], email_to, msg.as_string())
    print(f"\u2713 {institution_name} \u2192 {email_to}")


if __name__ == '__main__':
    # Test send
    send_email("GAL Oamenii Deltei", "vladgrigorov1@gmail.com", "Tulcea")
