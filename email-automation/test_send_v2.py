#!/usr/bin/env python3
"""
TEST SEND v2 - Emailuri profesionale, autentice, românești
Ton: personal, familiar, respectuos (ca de la om la om)
Fără emoji, fără butoane fancy, fără grid-uri
HTML minimal - arată ca un email real scris de mine
"""

import smtplib
import ssl
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
from datetime import datetime

SMTP_CONFIG = {
    'server': 'mail.privateemail.com',
    'port': 587,
    'email': 'contact@meetings-ro.app',
    'password': '5243Milanomilano1.',
    'from_name': 'Meetings.ro',
}

DESTINATAR = 'vladgrigorov1@gmail.com'

SIGNATURE = """<br>
Cu stimă,<br>
<b>Echipa Meetings.ro</b><br>
<br>
<em style="color:#666; font-size:13px;">Pentru întrebări, răspundem direct la acest email.</em>
"""

def template_a_compliance_v2(destinatar, nume_gal="GAL Delta Dunării"):
    """Template A - Compliance, dar uman și familiar"""
    subject = f"Procesele-verbale de la {nume_gal} - o întrebare"
    
    body = f"""
<html>
<body style="font-family: Georgia, 'Times New Roman', serif; color: #333; line-height: 1.7; font-size: 15px;">

<p>Stimate domnule director,</p>

<p>Vă scriem pentru că am observat că <b>{nume_gal}</b> organizează întâlniri periodice cu partenerii locali. Conform OUG 54/2019, fiecare întâlnire trebuie documentată cu proces-verbal semnat.</p>

<p>Am discutat cu mai mulți directori de GAL-uri din țară și ne-au spus același lucru: <em>transcrierea manuală și redactarea PV-urilor consumă cel puțin 12-15 ore pe lună.</em></p>

<p>De aceea am construit <b>Meetings.ro</b> - o aplicație care:</p>

<ul style="line-height: 1.8;">
<li>Înregistrează audio direct din telefon sau tabletă</li>
<li>Transcrie automat conversația în limba română</li>
<li>Generează procesul-verbal cu structura corectă (gata de semnare)</li>
<li>Exportă PDF sau Word pentru arhivare</li>
</ul>

<p>Totul este conform cu cerințele OUG 54/2019, iar echipa dvs. economisește timp prețios.</p>

<p style="margin-top: 24px;">Dacă aveți 15 minute săptămâna viitoare, vă arătăm cum funcționează în practică. Aplicația este deja disponibilă pe Google Play.</p>

<p>Întrebări? Răspundem direct la acest email.</p>

</body>
</html>
""" + SIGNATURE
    return subject, body


def send_email(to_email, subject, html_body, variant_name):
    """Trimite email prin SMTP"""
    msg = MIMEMultipart('alternative')
    msg['From'] = formataddr((SMTP_CONFIG['from_name'], SMTP_CONFIG['email']))
    msg['To'] = to_email
    msg['Subject'] = subject
    msg['Reply-To'] = SMTP_CONFIG['email']
    
    # Plain text fallback
    import re
    plain_text = re.sub('<[^<]+?>', '', html_body)
    plain_text = re.sub(r'\n{3,}', '\n\n', plain_text).strip()
    
    msg.attach(MIMEText(plain_text, 'plain', 'utf-8'))
    msg.attach(MIMEText(html_body, 'html', 'utf-8'))
    
    context = ssl.create_default_context()
    
    try:
        with smtplib.SMTP(SMTP_CONFIG['server'], SMTP_CONFIG['port']) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(SMTP_CONFIG['email'], SMTP_CONFIG['password'])
            server.send_message(msg)
        return True, f"✅ {variant_name} → trimis"
    except Exception as e:
        return False, f"❌ {variant_name} → EROARE: {e}"


def main():
    print("=" * 70)
    print(f"📧 TEST EMAIL - Meetings.ro")
    print(f"   {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 70)
    print(f"From: {SMTP_CONFIG['from_name']} <{SMTP_CONFIG['email']}>")
    print(f"To:   {DESTINATAR}")
    print()
    
    name = "Template A - Compliance"
    subject, body = template_a_compliance_v2(DESTINATAR, "GAL Delta Dunării")
    
    print(f"Subject: {subject}")
    ok, msg = send_email(DESTINATAR, subject, body, name)
    print(f"  {msg}")
    
    print()
    print("=" * 70)
    print("✅ Test complet.")


if __name__ == '__main__':
    main()
