     1|#!/usr/bin/env python3
     2|"""Email template for GAL/primărie outreach — Monday launch."""
     3|import smtplib, ssl
     4|from email.mime.text import MIMEText
     5|from email.mime.multipart import MIMEMultipart
     6|from email.mime.image import MIMEImage
     7|from email.utils import formataddr
     8|import os
     9|
    10|SMTP = {
    11|    'server': 'mail.privateemail.com',
    12|    'port': 587,
    13|    'email': 'contact@meetings-ro.app',
    14|    'password': '5243Milanomilano1.',
    15|    'from_name': 'Meetings.ro'
    16|}
    17|
    18|GOOGLE_PLAY = 'https://play.google.com/store/apps/details?id=com.yourcompany.meetingsro'
    19|LOGO_PATH = "/mnt/c/Users/vladg/Downloads/Meetings.ro.png"
    20|
    21|SIGNATURE = """<br>
    22|Cu stimă,<br>
    23|<b>Echipa Meetings.ro</b><br>
    24|Fondator Meetings.ro<br>
    25|<a href="https://meetings.ro">meetings.ro</a><br>
    26|<br>
    27|<em style="color:#666;font-size:13px">Răspund personal la orice întrebare.</em>"""
    28|
    29|
    30|def build_email(institution_name, email_to, judet=""):
    31|    """Build personalized email for a specific institution."""
    32|    loc = f"din județul {judet}" if judet else ""
    33|    subject = f"Automatizare proces-verbal conform OUG 54/2019 — {institution_name}"
    34|
    35|    msg = MIMEMultipart('related')
    36|    msg['From'] = formataddr((SMTP['from_name'], SMTP['email']))
    37|    msg['To'] = email_to
    38|    msg['Subject'] = subject
    39|    msg['Reply-To'] = SMTP['email']
    40|
    41|    html = f"""<html>
    42|<body style="font-family:Georgia,'Times New Roman',serif;color:#333;line-height:1.7;font-size:15px;max-width:600px;margin:0 auto;">
    43|
    44|<p style="text-align:center;margin-bottom:24px;">
    45|  <img src="cid:logo" alt="Meetings.ro" width="180" style="display:inline-block;">
    46|</p>
    47|
    48|<p>Stimate domnule director,</p>
    49|
    50|<p>Vă scriu pentru că am observat că <b>{institution_name}</b> {loc} organizează întâlniri periodice. Conform <b>OUG 54/2019</b>, fiecare întâlnire trebuie documentată cu proces-verbal semnat — iar asta înseamnă ore de transcriere manuală.</p>
    51|
    52|<p>Redactarea proceselor-verbale poate consuma între 12 și 15 ore pe lună. Este o muncă necesară, dar care ține echipa de la lucrurile cu adevărat importante.</p>
    53|
    54|<p>De aceea am construit <b>Meetings.ro</b> — o aplicație care face totul automat:</p>
    55|
    56|<ul style="line-height:1.8;">
    57|<li>Înregistrează audio direct din telefon sau tabletă</li>
    58|<li>Transcrie automat conversația în limba română</li>
    59|<li>Generează procesul-verbal cu structura corectă (gata de semnare)</li>
    60|<li>Exportă PDF sau Word pentru arhivare</li>
    61|</ul>
    62|
    63|<p>Totul este <b>conform OUG 54/2019</b>.</p>
    64|
    65|<p style="margin:24px 0;padding:16px 20px;background:#f8f9fa;border-left:3px solid #1B2A4A;border-radius:4px;">
    66|<em>"Aplicația este excepțională. Ne-a scutit de ore reale de muncă. Acum avem timp să ne concentrăm pe dezvoltarea zonelor rurale pe care le avem în rază de execuție."</em>
    67|<br><br>
    68|<b>— GAL Oamenii Deltei</b>, client Meetings.ro
    69|</p>
    70|
    71|<p><b>Aplicația este deja disponibilă pe Google Play.</b></p>
    72|
    73|<p style="text-align:center;margin:24px 0;">
    74|  <a href="{GOOGLE_PLAY}" style="display:inline-block;padding:14px 32px;background:#1B2A4A;color:white;text-decoration:none;border-radius:6px;font-size:16px;font-weight:bold;">
    75|    📲 Descarcă pe Google Play
    76|  </a>
    77|</p>
    78|
    79|<p>Dacă aveți 15 minute, vă arăt cum funcționează pentru {institution_name}. Întrebări? Răspund personal.</p>
    80|
    81|{SIGNATURE}
    82|</body>
    83|</html>"""
    84|
    85|    alt_msg = MIMEMultipart('alternative')
    86|    alt_msg.attach(MIMEText(html, 'html'))
    87|    msg.attach(alt_msg)
    88|
    89|    if os.path.exists(LOGO_PATH):
    90|        with open(LOGO_PATH, 'rb') as f:
    91|            img = MIMEImage(f.read())
    92|            img.add_header('Content-ID', '<logo>')
    93|            img.add_header('Content-Disposition', 'inline')
    94|            msg.attach(img)
    95|
    96|    return msg
    97|
    98|
    99|def send_email(institution_name, email_to, judet=""):
   100|    """Send one email."""
   101|    msg = build_email(institution_name, email_to, judet)
   102|    context = ssl.create_default_context()
   103|    with smtplib.SMTP(SMTP['server'], SMTP['port']) as server:
   104|        server.starttls(context=context)
   105|        server.login(SMTP['email'], SMTP['password'])
   106|        server.sendmail(SMTP['email'], email_to, msg.as_string())
   107|    print(f"✓ {institution_name} → {email_to}")
   108|
   109|
   110|if __name__ == '__main__':
   111|    send_email("GAL Oamenii Deltei", "vladgrigorov1@gmail.com", "Tulcea")
   112|