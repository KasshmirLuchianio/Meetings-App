#!/usr/bin/env python3
"""Cron job: check inbox replies + send follow-ups after 5 days."""
import smtplib, ssl, imaplib, email, json, os
from datetime import datetime, timezone, timedelta
from email.mime.text import MIMEText
from email.utils import formataddr, parsedate_to_datetime

SMTP = {
    'server': 'mail.privateemail.com', 'port': 587,
    'email': 'contact@meetings-ro.app',
    'password': '5243Milanomilano1.',
    'from_name': 'Meetings.ro'
}

IMAP = {'server': 'mail.privateemail.com', 'port': 993}
STATE_FILE = os.path.expanduser('~/Meetings-App/email-automation/sent_state.json')

GOOGLE_PLAY = 'https://play.google.com/store/apps/details?id=ro.meetingsapp.meetings'


def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE) as f:
            return json.load(f)
    return {'sent': [], 'replied': []}


def save_state(state):
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f, indent=2, default=str)


def check_replies():
    """Scan inbox for replies to our sent emails."""
    mail = imaplib.IMAP4_SSL(IMAP['server'], IMAP['port'])
    pw = SMTP['password']
    mail.login(SMTP['email'], pw)
    mail.select('INBOX')

    # Search recent emails from last 7 days
    since = (datetime.now() - timedelta(days=7)).strftime('%d-%b-%Y')
    _, data = mail.search(None, f'(SINCE "{since}")')

    state = load_state()
    new_replies = []

    for num in data[0].split():
        _, msg_data = mail.fetch(num, '(RFC822)')
        msg = email.message_from_bytes(msg_data[0][1])
        sender = email.utils.parseaddr(msg['From'])[1]
        subject = msg.get('Subject', '')

        # Skip our own emails
        if 'meetings-ro.app' in sender:
            continue

        # Check if this sender was in our sent list
        for s in state['sent']:
            if s['email'].lower() == sender.lower() and sender not in state['replied']:
                state['replied'].append(sender)
                new_replies.append({'from': sender, 'subject': subject})
                print(f"✓ REPLY: {sender} — {subject}")

    mail.logout()

    if new_replies:
        state['last_reply_check'] = datetime.now(timezone.utc).isoformat()
        save_state(state)

    return new_replies


def send_followups():
    """Send follow-up to institutions that haven't replied in 5+ days."""
    state = load_state()
    now = datetime.now(timezone.utc)
    sent_count = 0

    context = ssl.create_default_context()
    with smtplib.SMTP(SMTP['server'], SMTP['port']) as server:
        server.starttls(context=context)
        server.login(SMTP['email'], SMTP['password'])

        for s in state['sent']:
            if s['email'] in state.get('replied', []):
                continue
            if s.get('followup_sent'):
                continue

            sent_date = datetime.fromisoformat(s['sent_at'])
            days_ago = (now - sent_date).days

            if days_ago >= 5:
                subject = f"Re: Automatizare proces-verbal OUG 54/2019 — {s['name']}"
                body = f"""<html><body style="font-family:Georgia,serif;color:#333;line-height:1.7;font-size:15px;max-width:600px;margin:0 auto;">
<p>Bună ziua,</p>
<p>V-am scris acum câteva zile despre <b>Meetings.ro</b> — soluția automată pentru procese-verbale conform OUG 54/2019.</p>
<p>Dacă ați avut timp să vă uitați pe aplicație, aș fi curios să știu ce părere aveți.</p>
<p>Dacă nu, nicio problemă — vă las link-ul din nou:</p>
<p style="text-align:center;margin:24px 0;">
  <a href="{GOOGLE_PLAY}" style="display:inline-block;padding:14px 32px;background:#1B2A4A;color:white;text-decoration:none;border-radius:6px;font-size:16px;font-weight:bold;">📲 Descarcă pe Google Play</a>
</p>
<p>O zi bună!<br><b>Echipa Meetings.ro</b><br>Fondator Meetings.ro</p>
</body></html>"""

                msg = MIMEText(body, 'html')
                msg['From'] = formataddr((SMTP['from_name'], SMTP['email']))
                msg['To'] = s['email']
                msg['Subject'] = subject
                server.sendmail(SMTP['email'], s['email'], msg.as_string())

                s['followup_sent'] = now.isoformat()
                sent_count += 1
                print(f"✓ Follow-up: {s['name']} → {s['email']}")

    if sent_count > 0:
        save_state(state)

    return sent_count


if __name__ == '__main__':
    replies = check_replies()
    followups = send_followups()
    print(f"\nReplies: {len(replies)} | Follow-ups sent: {followups}")