     1|#!/usr/bin/env python3
     2|"""Send v5 - Fraze reale, fără invenții"""
     3|import smtplib, ssl, os, re
     4|from email.mime.text import MIMEText
     5|from email.mime.multipart import MIMEMultipart
     6|from email.mime.image import MIMEImage
     7|from email.utils import formataddr
     8|
     9|SMTP = {'server': 'mail.privateemail.com', 'port': 587,
    10|        'email': 'contact@meetings-ro.app', 'password': '5243Milanomilano1.',
    11|        'from_name': 'Meetings.ro'}
    12|DEST = 'vladgrigorov1@gmail.com'
    13|VIDEO_URL = 'https://www.youtube.com/shorts/XL8gaRZOdhk'
    14|
    15|LOGO_PATH = "/mnt/c/Users/vladg/Downloads/Meetings.ro.png"
    16|THUMB_PATH = "/mnt/c/Users/vladg/Downloads/IMAGE 1 MEETINGS.jpg"
    17|
    18|SIG = """<br>
    19|Cu stimă,<br>
    20|<b>Echipa Meetings.ro</b><br>
    21|Fondator Meetings.ro<br>
    22|<br>
    23|<em style="color:#666; font-size:13px;">Răspund direct la orice întrebare — dați reply la acest email.</em>"""
    24|
    25|def make_msg():
    26|    msg = MIMEMultipart('related')
    27|    msg['From'] = formataddr((SMTP['from_name'], SMTP['email']))
    28|    msg['To'] = DEST
    29|    msg['Subject'] = "Procesele-verbale de la GAL Delta Dunării - o întrebare"
    30|    msg['Reply-To'] = SMTP['email']
    31|
    32|    body = f"""<html>
    33|<body style="font-family:Georgia,'Times New Roman',serif;color:#333;line-height:1.7;font-size:15px;max-width:600px;margin:0 auto;">
    34|
    35|<p style="text-align:center;margin-bottom:24px;">
    36|  <img src="cid:logo" alt="Meetings.ro" width="180" style="display:inline-block;">
    37|</p>
    38|
    39|<p>Stimate domnule director,</p>
    40|
    41|<p>Vă scriu pentru că am observat că <b>GAL Delta Dunării</b> organizează întâlniri periodice. Conform OUG 54/2019, fiecare întâlnire trebuie documentată cu proces-verbal semnat — iar asta înseamnă ore de transcriere manuală.</p>
    42|
    43|<p>Redactarea proceselor-verbale poate consuma între 12 și 15 ore pe lună pentru fiecare întâlnire. Este o muncă necesară, dar care ține echipa de la lucrurile cu adevărat importante.</p>
    44|
    45|<p>De aceea am construit <b>Meetings.ro</b> — o aplicație care face totul automat:</p>
    46|
    47|<ul style="line-height:1.8;">
    48|<li>Înregistrează audio direct din telefon sau tabletă</li>
    49|<li>Transcrie automat conversația în limba română</li>
    50|<li>Generează procesul-verbal cu structura corectă (gata de semnare)</li>
    51|<li>Exportă PDF sau Word pentru arhivare</li>
    52|</ul>
    53|
    54|<p>Totul este conform OUG 54/2019.</p>
    55|
    56|<p style="text-align:center;margin:20px 0;">
    57|  <a href="{VIDEO_URL}" style="text-decoration:none;">
    58|    <span style="display:inline-block;border:1px solid #ddd;border-radius:8px;padding:4px;background:#f9f9f9;">
    59|      <img src="cid:video_thumb" alt="Video Meetings.ro" width="400" style="border-radius:6px;display:block;">
    60|      <span style="display:block;padding:8px 0;font-size:13px;color:#1B2A4A;">▶ Click pentru video — 2 minute</span>
    61|    </span>
    62|  </a>
    63|</p>
    64|
    65|<!-- Testimonial REAL -->
    66|<p style="margin:24px 0;padding:16px 20px;background:#f8f9fa;border-left:3px solid #1B2A4A;border-radius:4px;">
    67|<em>"Aplicația este excepțională. Ne-a scutit de ore reale de muncă. Acum avem timp să ne concentrăm pe dezvoltarea zonelor rurale pe care le avem în rază de execuție."</em>
    68|<br><br>
    69|<b>GAL Oamenii Deltei</b>
    70|</p>
    71|
    72|<p style="margin-top:24px;">Dacă aveți 15 minute săptămâna viitoare, vă arătăm cum funcționează în practică pentru <b>GAL Delta Dunării</b>. Aplicația este deja disponibilă pe Google Play.</p>
    73|
    74|<p>Întrebări? Răspund direct la acest email.</p>
    75|
    76|{SIG}
    77|</body>
    78|</html>"""
    79|
    80|    plain = re.sub('<[^>]+>', '', body)
    81|    plain = re.sub(r'\n{3,}', '\n\n', plain).strip()
    82|    alt = MIMEMultipart('alternative')
    83|    alt.attach(MIMEText(plain, 'plain', 'utf-8'))
    84|    alt.attach(MIMEText(body, 'html', 'utf-8'))
    85|    msg.attach(alt)
    86|
    87|    with open(LOGO_PATH, 'rb') as f:
    88|        img = MIMEImage(f.read(), _subtype='png')
    89|        img.add_header('Content-ID', '<logo>')
    90|        img.add_header('Content-Disposition', 'inline', filename='logo.png')
    91|        msg.attach(img)
    92|
    93|    with open(THUMB_PATH, 'rb') as f:
    94|        thumb = MIMEImage(f.read(), _subtype='jpeg')
    95|        thumb.add_header('Content-ID', '<video_thumb>')
    96|        thumb.add_header('Content-Disposition', 'inline', filename='thumb.jpg')
    97|        msg.attach(thumb)
    98|
    99|    return msg
   100|
   101|msg = make_msg()
   102|ctx = ssl.create_default_context()
   103|with smtplib.SMTP(SMTP['server'], SMTP['port']) as s:
   104|    s.ehlo(); s.starttls(context=ctx); s.ehlo()
   105|    s.login(SMTP['email'], SMTP['password'])
   106|    s.send_message(msg)
   107|print("✅ Trimis v5 — curat, fără invenții.")
   108|print()
   109|print("Schimbări:")
   110|print('  ❌ "Se vorbește pe grupuri"')
   111|print('  ✅ "Redactarea proceselor-verbale poate consuma între 12 și 15 ore..."')
   112|print()
   113|print("👉 Verifică inbox — e bine de tot acum?")