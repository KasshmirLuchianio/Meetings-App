#!/usr/bin/env python3
"""
Quick test - trimite un email de test către contact@meetings-ro.app
"""

import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
from datetime import datetime

SMTP_CONFIG = {
    'server': 'mail.privateemail.com',
    'port': 587,
    'email': 'contact@meetings-ro.app',
    'password': '5243Milanomilano1.',
    'from_name': 'Meetings Stuff',
}

SIGNATURE = """
Cu respect,
Echipa Meetings.ro
📧 contact@meetings-ro.app
🌐 https://meetings.ro
"""

def send_test_email():
    """Send test email"""
    
    test_body = f"""✅ TESTUL A REUȘIT!

Acest email confirmă că sistemul de automation Meetings.ro funcționează perfect:

✅ SMTP connection OK
✅ Credentials valide  
✅ Email delivery functional
✅ Signature corectă

NEXT STEPS:
1. Verifică că emailul a ajuns în INBOX (nu SPAM)
2. Check formatting și signature
3. Dacă totul e OK → începem campania către GAL-uri

{SIGNATURE}

---
Test timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Provider: PrivateEmail (Namecheap)
From: {SMTP_CONFIG['from_name']} <{SMTP_CONFIG['email']}>
"""
    
    try:
        msg = MIMEMultipart('alternative')
        msg['From'] = formataddr((SMTP_CONFIG['from_name'], SMTP_CONFIG['email']))
        msg['To'] = SMTP_CONFIG['email']
        msg['Subject'] = '🧪 Test Email - Meetings.ro Automation System'
        
        part1 = MIMEText(test_body, 'plain', 'utf-8')
        msg.attach(part1)
        
        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_CONFIG['server'], SMTP_CONFIG['port'], timeout=10) as server:
            server.starttls(context=context)
            server.login(SMTP_CONFIG['email'], SMTP_CONFIG['password'])
            server.send_message(msg)
        
        print("✅ TEST EMAIL SENT SUCCESSFULLY!")
        print(f"📧 Check inbox at: {SMTP_CONFIG['email']}")
        print("\n👉 Verifică inbox-ul (și spam folder) ACUM!")
        return True
    
    except Exception as e:
        print(f"❌ Failed to send: {e}")
        return False

if __name__ == '__main__':
    print("=" * 80)
    print("📧 SENDING TEST EMAIL...")
    print("=" * 80)
    send_test_email()
