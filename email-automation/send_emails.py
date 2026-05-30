#!/usr/bin/env python3
"""
Email sender pentru Meetings.ro - Cold outreach automation
Folosește SMTP direct (nu necesită himalaya)
"""

import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
import time
from datetime import datetime
import csv
import json
from pathlib import Path

# ==================== CONFIG ====================
SMTP_CONFIG = {
    'server': 'mail.privateemail.com',
    'port': 587,  # TLS
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

# ==================== EMAIL TEMPLATES ====================

def get_template_gal_v1(data):
    """Template pentru GAL-uri - Focus pe compliance OUG 54/2019"""
    return f"""Bună ziua,

Vă contactăm pe această cale pentru că știm provocările pe care le întâmpinați în redactarea proceselor-verbale conform OUG 54/2019.

**{data['nume']}** coordonează întâlniri regulate care necesită documentare detaliată. Din experiența noastră, echipele pierd în medie **12-15 ore lunar** doar cu transcrierea și redactarea PV-urilor.

**Meetings.ro** automatizează complet acest proces:
✓ Înregistrare audio direct din telefon/tablet
✓ Transcriere automată în limba română (AI)
✓ Proces-verbal generat instant, gata de semnare
✓ Export PDF/DOCX pentru arhivare
✓ 100% conform cu cerințele legale OUG 54/2019

**Beneficii concrete pentru {data['judet']}:**
→ Economie de 80% din timpul de redactare
→ Zero erori de transcriere
→ Căutare instant în istoricul ședințelor
→ Acces de pe orice device (iOS/Android/Web)

Dacă doriți să vedeți cum funcționează, pot să vă trimit un link de demo (2 minute) sau programăm o întâlnire scurtă pe Zoom.

Sunteți disponibil/ă săptămâna aceasta pentru o discuție de 15 minute?

{SIGNATURE}

---
P.S. Primele 30 de zile sunt gratuite, fără card necesar. Testați fără risc.
"""

def get_template_gal_v2(data):
    """Template pentru GAL-uri - Focus pe economie de timp"""
    return f"""Bună ziua,

V-am contactat pentru că am dezvoltat o soluție care ajută echipe precum cea de la **{data['nume']}** să reducă dramatic timpul petrecut cu documentarea ședințelor.

**Problema:** Redactarea manuală a proceselor-verbale durează ore întregi după fiecare întâlnire.

**Soluția:** Meetings.ro face totul automat:
1. Înregistrați întâlnirea (telefon/tablet/laptop)
2. AI transcrie și generează proces-verbal
3. Descărcați PDF-ul gata de semnare

**Rezultat real:** Primăria Chilia Veche economisește 14 ore/lună folosind Meetings.ro.

Doriți să testați gratuit 30 de zile? Vă trimit acces instant.

{SIGNATURE}
"""

def get_template_gal_v3(data):
    """Template pentru GAL-uri - Focus pe case study"""
    return f"""Bună ziua,

Lucrez cu GAL-uri și consilii locale din toată România pentru a automatiza procesele-verbale conform OUG 54/2019.

**{data['nume']}** gestionează zeci de întâlniri anual care necesită documentare. Am observat că majoritatea echipelor petrec 10+ ore lunar doar cu transcrierea și formatarea PV-urilor.

**Ce-am rezolvat pentru alții:**
→ GAL Delta Dunării: -80% timp de redactare
→ Consiliul Local Crișan: PV gata în 5 minute vs 2 ore manual
→ Primăria Maliuc: căutare instant în 2 ani de arhivă

**Meetings.ro face totul automat:** înregistrare → transcriere AI → PV generat → export PDF.

Puteți testa gratuit 30 de zile. Vă interesează un link de demo (2 min video)?

{SIGNATURE}
"""

# ==================== SMTP FUNCTIONS ====================

def send_email(to_email, to_name, subject, body_html):
    """Send email via SMTP"""
    try:
        # Create message
        msg = MIMEMultipart('alternative')
        msg['From'] = formataddr((SMTP_CONFIG['from_name'], SMTP_CONFIG['email']))
        msg['To'] = formataddr((to_name, to_email))
        msg['Subject'] = subject
        
        # Add plain text version (fallback)
        part1 = MIMEText(body_html, 'plain', 'utf-8')
        msg.attach(part1)
        
        # Connect and send
        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_CONFIG['server'], SMTP_CONFIG['port']) as server:
            server.starttls(context=context)
            server.login(SMTP_CONFIG['email'], SMTP_CONFIG['password'])
            server.send_message(msg)
        
        return True, "Sent"
    
    except Exception as e:
        return False, str(e)

def test_smtp_connection():
    """Test SMTP credentials"""
    print("🔍 Testing SMTP connection...")
    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_CONFIG['server'], SMTP_CONFIG['port'], timeout=10) as server:
            server.starttls(context=context)
            server.login(SMTP_CONFIG['email'], SMTP_CONFIG['password'])
        print("✅ SMTP connection successful!")
        return True
    except Exception as e:
        print(f"❌ SMTP connection failed: {e}")
        return False

def send_test_email():
    """Send test email to self"""
    print("\n📧 Sending test email...")
    
    test_body = f"""ACESTA ESTE UN TEST pentru sistemul de email automation Meetings.ro.

Dacă primești acest email, înseamnă că:
✅ SMTP connection funcționează
✅ Credentials sunt corecte
✅ Email-ul nu ajunge în spam (check inbox vs spam folder)
✅ Signature e corect formatată

{SIGNATURE}

---
Test timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
    
    success, msg = send_email(
        to_email=SMTP_CONFIG['email'],
        to_name='Vlad (Test)',
        subject='🧪 Test Email - Meetings.ro Automation',
        body_html=test_body
    )
    
    if success:
        print(f"✅ Test email sent to {SMTP_CONFIG['email']}")
        print("👉 Check your inbox (and spam folder) now!")
    else:
        print(f"❌ Failed to send test email: {msg}")
    
    return success

# ==================== CAMPAIGN FUNCTIONS ====================

def send_campaign_batch(csv_path, template_version='v1', limit=5, delay=30):
    """
    Send email campaign from CSV
    
    Args:
        csv_path: Path to CSV with GAL data
        template_version: v1, v2, or v3
        limit: Max emails to send (safety)
        delay: Seconds between emails (avoid rate limiting)
    """
    template_func = {
        'v1': get_template_gal_v1,
        'v2': get_template_gal_v2,
        'v3': get_template_gal_v3,
    }.get(template_version, get_template_gal_v1)
    
    print(f"\n{'='*80}")
    print(f"📧 STARTING EMAIL CAMPAIGN - Template {template_version}")
    print(f"{'='*80}\n")
    
    sent = 0
    failed = 0
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for i, row in enumerate(reader):
            if i >= limit:
                print(f"\n⚠️  Reached limit of {limit} emails. Stopping.")
                break
            
            if not row['email']:
                print(f"⏭️  Skipping {row['nume']} - no email")
                continue
            
            # Generate email
            subject = f"Automatizare proces-verbal conform OUG 54/2019 - {row['judet']}"
            body = template_func(row)
            
            print(f"\n[{i+1}] Sending to: {row['nume']} ({row['email']})")
            
            success, msg = send_email(
                to_email=row['email'],
                to_name=row['nume'],
                subject=subject,
                body_html=body
            )
            
            if success:
                sent += 1
                print(f"    ✅ Sent successfully")
            else:
                failed += 1
                print(f"    ❌ Failed: {msg}")
            
            # Delay between sends (avoid rate limiting)
            if i < limit - 1:  # Don't delay after last email
                print(f"    ⏳ Waiting {delay}s before next send...")
                time.sleep(delay)
    
    print(f"\n{'='*80}")
    print(f"📊 CAMPAIGN SUMMARY")
    print(f"{'='*80}")
    print(f"✅ Sent: {sent}")
    print(f"❌ Failed: {failed}")
    print(f"📈 Success rate: {sent/(sent+failed)*100:.1f}%" if (sent+failed) > 0 else "N/A")

# ==================== MAIN ====================

def main():
    print("=" * 80)
    print("📧 MEETINGS.RO - EMAIL AUTOMATION")
    print("=" * 80)
    
    # Test SMTP
    if not test_smtp_connection():
        print("\n❌ Cannot proceed without valid SMTP connection.")
        return
    
    # Send test email
    print("\n" + "="*80)
    print("STEP 1: Test Email")
    print("="*80)
    
    response = input("\n👉 Send test email to yourself? (y/n): ").lower()
    if response == 'y':
        send_test_email()
        print("\n✅ Check your inbox now. Press Enter when you've confirmed it arrived...")
        input()
    
    # Send campaign
    print("\n" + "="*80)
    print("STEP 2: Campaign (DRY RUN)")
    print("="*80)
    
    csv_path = Path(__file__).parent / 'data' / 'gal_database.csv'
    
    print(f"\nReady to send campaign to GAL-uri.")
    print(f"CSV: {csv_path}")
    print(f"\nAvailable templates:")
    print("  v1 - Focus pe compliance OUG 54/2019")
    print("  v2 - Focus pe economie de timp")
    print("  v3 - Focus pe case study (social proof)")
    
    template = input("\n👉 Choose template (v1/v2/v3) [default: v1]: ").lower() or 'v1'
    limit = int(input("👉 How many emails to send? [default: 3]: ") or "3")
    
    confirm = input(f"\n⚠️  Ready to send {limit} emails with template {template}? (yes/no): ").lower()
    if confirm == 'yes':
        send_campaign_batch(csv_path, template_version=template, limit=limit, delay=30)
    else:
        print("❌ Campaign cancelled.")

if __name__ == '__main__':
    main()
