#!/usr/bin/env python3
"""
Cron job: verifică inbox-ul pentru răspunsuri și trimite follow-up automat.
Rulează zilnic. Tracking prin sent_state.json.
"""
import smtplib, ssl, imaplib, email, json, os
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr, parsedate_to_datetime

# ── Config ───────────────────────────────────────────────
IMAP_CONFIG = {
    'server': 'mail.privateemail.com',
    'port': 993,
    'email': 'contact@meetings-ro.app',
    'password': '5243Milanomilano1.',
}

SMTP_CONFIG = {
    'server': 'mail.privateemail.com',
    'port': 587,
    'email': 'contact@meetings-ro.app',
    'password': '5243Milanomilano1.',
    'from_name': 'Meetings.ro'
}

STATE_FILE = os.path.join(os.path.dirname(__file__), 'sent_state.json')
FOLLOW_UP_DAYS = 5  # Send follow-up after N days without reply

# ── Follow-up email template ─────────────────────────────
FOLLOW_UP_SUBJECT = "Re: Automatizare proces-verbal conform OUG 54/2019 — {institution}"

FOLLOW_UP_HTML = """<html>
<body style="font-family:Georgia,'Times New Roman',serif;color:#333;line-height:1.7;font-size:15px;max-width:600px;margin:0 auto;">

<p style="text-align:center;margin-bottom:20px;">
  <img src="cid:logo" alt="Meetings.ro" width="140">
</p>

<p>Stimate domnule director,</p>

<p>Vă scriam săptămâna trecută despre <b>Meetings.ro</b> — aplicația care automatizează procesele-verbale conform OUG 54/2019 pentru <b>{institution}</b>.</p>

<p>Știu că sunteți foarte ocupați. Dacă aveți 10 minute, vă arăt cum funcționează. E disponibilă direct pe Google Play:</p>

<p style="text-align:center;margin:20px 0;">
  <a href="https://play.google.com/store/apps/details?id=ro.meetingsapp.meetings" style="display:inline-block;padding:12px 30px;background:#1B2A4A;color:white;text-decoration:none;border-radius:5px;font-size:15px;font-weight:bold;">
    📲 Descarcă pe Google Play
  </a>
</p>

<p>Dacă nu este momentul potrivit, înțeleg perfect. Un simplu „nu acum, poate mai târziu" mă ajută să știu.</p>

<p style="margin-top:24px;">Cu stimă,<br><b>Echipa Meetings.ro</b><br>
📧 contact@meetings-ro.app &nbsp;|&nbsp; 🌐 meetings-ro.app</p>

</body>
</html>"""

LOGO_PATH = "/mnt/c/Users/vladg/Downloads/Meetings.ro.png"


# ── State management ─────────────────────────────────────
def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, 'r') as f:
            return json.load(f)
    return {"sent": {}, "replied": {}, "followed_up": {}}


def save_state(state):
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f, indent=2, default=str)


def mark_sent(state, email_to, institution, judet=""):
    state["sent"][email_to] = {
        "institution": institution,
        "judet": judet,
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "followed_up": False
    }
    save_state(state)


def mark_replied(state, email_to):
    state["replied"][email_to] = datetime.now(timezone.utc).isoformat()
    if email_to in state["sent"]:
        del state["sent"][email_to]
    save_state(state)


def mark_followed_up(state, email_to):
    if email_to in state["sent"]:
        state["sent"][email_to]["followed_up"] = True
    state["followed_up"][email_to] = datetime.now(timezone.utc).isoformat()
    save_state(state)


# ── IMAP: check for replies ──────────────────────────────
def check_inbox_for_replies(state):
    """Check inbox for replies from people we emailed."""
    replies_found = []
    try:
        with imaplib.IMAP4_SSL(IMAP_CONFIG['server'], IMAP_CONFIG['port']) as imap:
            imap.login(IMAP_CONFIG['email'], IMAP_CONFIG['password'])
            imap.select('INBOX')

            # Search for emails from the last FOLLOW_UP_DAYS+2 days
            since_date = (datetime.now() - timedelta(days=FOLLOW_UP_DAYS + 2)).strftime("%d-%b-%Y")
            status, messages = imap.search(None, f'(SINCE {since_date})')

            if status != 'OK' or not messages[0]:
                return replies_found

            for num in messages[0].split()[-100:]:  # Last 100 emails
                status, data = imap.fetch(num, '(RFC822)')
                if status != 'OK':
                    continue
                raw = data[0][1]
                msg = email.message_from_bytes(raw)

                sender = msg.get('From', '')
                # Extract email from sender header
                if '<' in sender:
                    sender_email = sender.split('<')[1].split('>')[0].lower()
                else:
                    sender_email = sender.lower().strip()

                # Check if this sender is in our sent list
                if sender_email in state.get("sent", {}):
                    sent_info = state["sent"][sender_email]
                    replies_found.append({
                        "from": sender_email,
                        "institution": sent_info.get("institution", ""),
                        "subject": msg.get('Subject', ''),
                        "date": msg.get('Date', '')
                    })

        print(f"Checked inbox. Sent emails: {len(state.get('sent', {}))}, Replies found: {len(replies_found)}")

    except Exception as e:
        print(f"IMAP error (non-fatal): {e}")

    return replies_found


# ── SMTP: send follow-up ─────────────────────────────────
def send_follow_up(email_to, institution, judet=""):
    """Send follow-up email."""
    msg = MIMEMultipart('related')
    msg['From'] = formataddr((SMTP_CONFIG['from_name'], SMTP_CONFIG['email']))
    msg['To'] = email_to
    msg['Subject'] = FOLLOW_UP_SUBJECT.format(institution=institution)
    msg['Reply-To'] = SMTP_CONFIG['email']

    html = FOLLOW_UP_HTML.format(institution=institution)
    alt = MIMEMultipart('alternative')
    alt.attach(MIMEText(html, 'html', 'utf-8'))
    msg.attach(alt)

    if os.path.exists(LOGO_PATH):
        from email.mime.image import MIMEImage
        with open(LOGO_PATH, 'rb') as f:
            img = MIMEImage(f.read())
            img.add_header('Content-ID', '<logo>')
            img.add_header('Content-Disposition', 'inline')
            msg.attach(img)

    context = ssl.create_default_context()
    with smtplib.SMTP(SMTP_CONFIG['server'], SMTP_CONFIG['port']) as server:
        server.starttls(context=context)
        server.login(SMTP_CONFIG['email'], SMTP_CONFIG['password'])
        server.sendmail(SMTP_CONFIG['email'], email_to, msg.as_string())

    return True


# ── Main logic ───────────────────────────────────────────
def run():
    state = load_state()
    now = datetime.now(timezone.utc)

    # 1. Check for replies
    replies = check_inbox_for_replies(state)
    for r in replies:
        mark_replied(state, r["from"])
        print(f"✓ Reply from {r['institution']} ({r['from']}) — removed from pending")

    # 2. Find emails needing follow-up (>5 days, no reply, not already followed up)
    pending_followups = []
    for email_to, info in state.get("sent", {}).items():
        if info.get("followed_up"):
            continue
        sent_at = datetime.fromisoformat(info["sent_at"])
        days_ago = (now - sent_at).days
        if days_ago >= FOLLOW_UP_DAYS:
            pending_followups.append((email_to, info))

    # 3. Send follow-ups
    for email_to, info in pending_followups:
        try:
            send_follow_up(email_to, info["institution"], info.get("judet", ""))
            mark_followed_up(state, email_to)
            print(f"✓ Follow-up sent to {info['institution']} ({email_to})")
        except Exception as e:
            print(f"✗ Failed follow-up to {info['institution']}: {e}")

    # 4. Report
    total_sent = len(state.get("sent", {}))
    total_replied = len(state.get("replied", {}))
    total_followed = len(state.get("followed_up", {}))
    print(f"\nSummary: {total_sent} pending, {total_replied} replied, {total_followed} followed up")


if __name__ == '__main__':
    run()
