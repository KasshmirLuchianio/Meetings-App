     1|#!/usr/bin/env python3
     2|"""Cron job: check inbox replies + send follow-ups after 5 days."""
     3|import smtplib, ssl, imaplib, email, json, os
     4|from datetime import datetime, timezone, timedelta
     5|from email.mime.text import MIMEText
     6|from email.utils import formataddr, parsedate_to_datetime
     7|
     8|SMTP = {
     9|    'server': 'mail.privateemail.com', 'port': 587,
    10|    'email': 'contact@meetings-ro.app',
    11|    'password': '*** FROM PARTS ***',
    12|    'from_name': 'Meetings.ro'
    13|}
    14|
    15|IMAP = {'server': 'mail.privateemail.com', 'port': 993}
    16|STATE_FILE = os.path.expanduser('~/Meetings-App/email-automation/sent_state.json')
    17|
    18|GOOGLE_PLAY = 'https://play.google.com/store/apps/details?id=com.yourcompany.meetingsro'
    19|
    20|
    21|def load_state():
    22|    if os.path.exists(STATE_FILE):
    23|        with open(STATE_FILE) as f:
    24|            return json.load(f)
    25|    return {'sent': [], 'replied': []}
    26|
    27|
    28|def save_state(state):
    29|    with open(STATE_FILE, 'w') as f:
    30|        json.dump(state, f, indent=2, default=str)
    31|
    32|
    33|def check_replies():
    34|    """Scan inbox for replies to our sent emails."""
    35|    mail = imaplib.IMAP4_SSL(IMAP['server'], IMAP['port'])
    36|    pw = SMTP['password']
    37|    mail.login(SMTP['email'], pw)
    38|    mail.select('INBOX')
    39|    
    40|    # Search recent emails from last 7 days
    41|    since = (datetime.now() - timedelta(days=7)).strftime('%d-%b-%Y')
    42|    _, data = mail.search(None, f'(SINCE "{since}")')
    43|    
    44|    state = load_state()
    45|    new_replies = []
    46|    
    47|    for num in data[0].split():
    48|        _, msg_data = mail.fetch(num, '(RFC822)')
    49|        msg = email.message_from_bytes(msg_data[0][1])
    50|        sender = email.utils.parseaddr(msg['From'])[1]
    51|        subject = msg.get('Subject', '')
    52|        
    53|        # Skip our own emails
    54|        if 'meetings-ro.app' in sender:
    55|            continue
    56|        
    57|        # Check if this sender was in our sent list
    58|        for s in state['sent']:
    59|            if s['email'].lower() == sender.lower() and sender not in state['replied']:
    60|                state['replied'].append(sender)
    61|                new_replies.append({'from': sender, 'subject': subject})
    62|                print(f"✓ REPLY: {sender} — {subject}")
    63|
    64|    mail.logout()
    65|    
    66|    if new_replies:
    67|        state['last_reply_check'] = datetime.now(timezone.utc).isoformat()
    68|        save_state(state)
    69|    
    70|    return new_replies
    71|
    72|
    73|def send_followups():
    74|    """Send follow-up to institutions that haven't replied in 5+ days."""
    75|    state = load_state()
    76|    now = datetime.now(timezone.utc)
    77|    sent_count = 0
    78|    
    79|    context = ssl.create_default_context()
    80|    with smtplib.SMTP(SMTP['server'], SMTP['port']) as server:
    81|        server.starttls(context=context)
    82|        server.login(SMTP['email'], SMTP['password'])
    83|        
    84|        for s in state['sent']:
    85|            if s['email'] in state.get('replied', []):
    86|                continue
    87|            if s.get('followup_sent'):
    88|                continue
    89|            
    90|            sent_date = datetime.fromisoformat(s['sent_at'])
    91|            days_ago = (now - sent_date).days
    92|            
    93|            if days_ago >= 5:
    94|                subject = f"Re: Automatizare proces-verbal OUG 54/2019 — {s['name']}"
    95|                body = f"""<html><body style="font-family:Georgia,serif;color:#333;line-height:1.7;font-size:15px;max-width:600px;margin:0 auto;">
    96|<p>Bună ziua,</p>
    97|<p>V-am scris acum câteva zile despre <b>Meetings.ro</b> — soluția automată pentru procese-verbale conform OUG 54/2019.</p>
    98|<p>Dacă ați avut timp să vă uitați pe aplicație, aș fi curios să știu ce părere aveți.</p>
    99|<p>Dacă nu, nicio problemă — vă las link-ul din nou:</p>
   100|<p style="text-align:center;margin:24px 0;">
   101|  <a href="{GOOGLE_PLAY}" style="display:inline-block;padding:14px 32px;background:#1B2A4A;color:white;text-decoration:none;border-radius:6px;font-size:16px;font-weight:bold;">📲 Descarcă pe Google Play</a>
   102|</p>
   103|<p>O zi bună!<br><b>Echipa Meetings.ro</b><br>Fondator Meetings.ro</p>
   104|</body></html>"""
   105|                
   106|                msg = MIMEText(body, 'html')
   107|                msg['From'] = formataddr((SMTP['from_name'], SMTP['email']))
   108|                msg['To'] = s['email']
   109|                msg['Subject'] = subject
   110|                server.sendmail(SMTP['email'], s['email'], msg.as_string())
   111|                
   112|                s['followup_sent'] = now.isoformat()
   113|                sent_count += 1
   114|                print(f"✓ Follow-up: {s['name']} → {s['email']}")
   115|    
   116|    if sent_count > 0:
   117|        save_state(state)
   118|    
   119|    return sent_count
   120|
   121|
   122|if __name__ == '__main__':
   123|    replies = check_replies()
   124|    followups = send_followups()
   125|    print(f"\nReplies: {len(replies)} | Follow-ups sent: {followups}")
   126|