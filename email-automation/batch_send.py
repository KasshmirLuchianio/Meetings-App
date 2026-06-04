#!/usr/bin/env python3
"""
Batch send: trimite email-uri către toate contactele verificate.
Folosește template-ul din send_campaign.py.
Tracking în sent_state.json.
"""
import sys, os, csv, json, time, smtplib, ssl
from datetime import datetime, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from email.utils import formataddr

# ── Import template from send_campaign ──────────────────
sys.path.insert(0, os.path.dirname(__file__))
from send_campaign import build_email

SMTP_CONFIG = {
    'server': 'mail.privateemail.com',
    'port': 587,
    'email': 'contact@meetings-ro.app',
    'password': '5243Milanomilano1.',
    'from_name': 'Meetings.ro'
}

CONTACTS_FILE = os.path.join(os.path.dirname(__file__), 'BAZA_COMPLETA.csv')
STATE_FILE = os.path.join(os.path.dirname(__file__), 'sent_state.json')
BATCH_SIZE = 10     # Emails per batch
BATCH_DELAY = 10    # Seconds between batches
TEST_MODE = True     # Set False for real send
TEST_EMAIL = "vladgrigorov1@gmail.com"


def load_contacts(filepath):
    """Load verified contacts from CSV."""
    contacts = []
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            contacts.append({
                'nume': row.get('Nume', '').strip('"').strip(),
                'email': row.get('Email', '').strip(),
                'judet': row.get('Judet', '').strip(),
                'tip': row.get('Tip', '').strip()
            })
    return contacts


def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, 'r') as f:
            return json.load(f)
    return {"sent": {}, "replied": {}, "followed_up": {}}


def save_state(state):
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f, indent=2, default=str)


def send_one_contact(contact, dry_run=True):
    """Send email to one contact. If dry_run, send to test email instead."""
    nume = contact['nume']
    email_to = TEST_EMAIL if dry_run else contact['email']
    judet = contact['judet']

    try:
        msg = build_email(nume, email_to, judet)
        
        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_CONFIG['server'], SMTP_CONFIG['port']) as server:
            server.starttls(context=context)
            server.login(SMTP_CONFIG['email'], SMTP_CONFIG['password'])
            server.sendmail(SMTP_CONFIG['email'], email_to, msg.as_string())
        
        # Save to Sent folder via IMAP
        if not dry_run:
            try:
                import imaplib
                with imaplib.IMAP4_SSL('mail.privateemail.com', 993) as imap:
                    imap.login(SMTP_CONFIG['email'], SMTP_CONFIG['password'])
                    imap.append('Sent', None, None, msg.as_string().encode())
            except:
                pass  # Silently skip if IMAP fails
        
        target = f"TEST→{email_to}" if dry_run else email_to
        print(f"  ✓ {nume} → {target} ({judet})")
        return True
    except Exception as e:
        print(f"  ✗ {nume}: {str(e)[:60]}")
        return False


def run_batch(dry_run=True):
    """Main batch send logic."""
    contacts = load_contacts(CONTACTS_FILE)
    state = load_state()

    # Filter already sent
    pending = [c for c in contacts if c['email'] not in state.get('sent', {})]
    
    print(f"Total contacts: {len(contacts)}")
    print(f"Already sent: {len(contacts) - len(pending)}")
    print(f"Pending: {len(pending)}")
    print(f"Mode: {'TEST (to vladgrigorov1@gmail.com)' if dry_run else 'LIVE'}")
    print(f"Batch size: {BATCH_SIZE}, Delay: {BATCH_DELAY}s")
    print("=" * 60)

    sent_count = 0
    fail_count = 0

    for i, contact in enumerate(pending):
        success = send_one_contact(contact, dry_run=dry_run)
        
        if success:
            if not dry_run:
                state['sent'][contact['email']] = {
                    'institution': contact['nume'],
                    'judet': contact['judet'],
                    'tip': contact['tip'],
                    'sent_at': datetime.now(timezone.utc).isoformat(),
                    'followed_up': False
                }
            sent_count += 1
        else:
            fail_count += 1

        # Batch delay every N emails
        if (i + 1) % BATCH_SIZE == 0 and i + 1 < len(pending):
            if not dry_run:
                save_state(state)
            print(f"  --- Batch {i+1}/{len(pending)} — waiting {BATCH_DELAY}s ---")
            time.sleep(BATCH_DELAY)

    if not dry_run:
        save_state(state)

    print("=" * 60)
    print(f"Done. Sent: {sent_count}, Failed: {fail_count}")
    return sent_count, fail_count


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--live', action='store_true', help='Send to real contacts (not test)')
    args = parser.parse_args()
    
    dry_run = not args.live
    
    if not dry_run:
        print("⚠️  LIVE MODE — sending to REAL contacts! Starting in 3 seconds...")
        time.sleep(3)
    
    run_batch(dry_run=dry_run)