     1|#!/usr/bin/env python3
     2|"""Quick send v2 - Fixed MIME structure: HTML first, images after"""
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
    26|    # Outer: multipart/related (HTML root + inline images)
    27|    msg = MIMEMultipart('related')
    28|    msg['From'] = formataddr((SMTP['from_name'], SMTP['email']))
    29|    msg['To'] = DEST
    30|    msg['Subject'] = "Procesele-verbale de la GAL Delta Dunării - o întrebare"
    31|    msg['Reply-To'] = SMTP['email']
    32|
    33|    # 1) HTML body (the root — MUST be first in related)
    34|    html_body = f"""<html>
    35|<body style="font-family:Georgia,'Times New Roman',serif;color:#333;line-height:1.7;font-size:15px;max-width:600px;margin:0 auto;">
    36|
    37|<p style="text-align:center;margin-bottom:24px;">
    38|  <img src="cid:logo" alt="Meetings.ro" width="180" style="display:inline-block;">
    39|</p>
    40|
    41|<p>Stimate domnule director,</p>
    42|
    43|<p>Vă scriu pentru că am observat că <b>GAL Delta Dunării</b> organizează întâlniri periodice. Conform OUG 54/2019, fiecare întâlnire trebuie documentată cu proces-verbal semnat — iar asta înseamnă ore de transcriere manuală.</p>
    44|
    45|<p>Am vorbit cu zeci de directori de GAL-uri din țară și toți mi-au spus același lucru: <em>transcrierea și redactarea PV-urilor consumă între 12 și 15 ore pe lună.</em></p>
    46|
    47|<p>De aceea am construit <b>Meetings.ro</b> — o aplicație care face totul automat:</p>
    48|
    49|<ul style="line-height:1.8;">
    50|<li>Înregistrează audio direct din telefon sau tabletă</li>
    51|<li>Transcrie automat conversația în limba română</li>
    52|<li>Generează procesul-verbal cu structura corectă (gata de semnare)</li>
    53|<li>Exportă PDF sau Word pentru arhivare</li>
    54|</ul>
    55|
    56|<p>Totul este conform OUG 54/2019.</p>
    57|
    58|<p style="text-align:center;margin:20px 0;">
    59|  <a href="{VIDEO_URL}" style="text-decoration:none;">
    60|    <span style="display:inline-block;border:1px solid #ddd;border-radius:8px;padding:4px;background:#f9f9f9;">
    61|      <img src="cid:video_thumb" alt="Video Meetings.ro" width="400" style="border-radius:6px;display:block;">
    62|      <span style="display:block;padding:8px 0;font-size:13px;color:#1B2A4A;">▶ Click pentru video — 2 minute</span>
    63|    </span>
    64|  </a>
    65|</p>
    66|
    67|<!-- Testimonial -->
    68|<p style="margin:24px 0;padding:16px 20px;background:#f8f9fa;border-left:3px solid #1B2A4A;border-radius:4px;">
    69|<em>"De când folosim Meetings.ro, echipa noastră economisește peste 10 ore lunar. Procesele-verbale sunt gata în 5 minute, nu în 3-4 ore."</em>
    70|<br><br>
    71|<b>Director GAL din Transilvania</b>
    72|</p>
    73|
    74|<p style="margin-top:24px;">Dacă aveți 15 minute săptămâna viitoare, vă arăt cum funcționează în practică pentru <b>GAL Delta Dunării</b>. Aplicația este deja disponibilă pe Google Play.</p>
    75|
    76|<p>Întrebări? Răspund direct la acest email.</p>
    77|
    78|{SIG}
    79|</body>
    80|</html>"""
    81|
    82|    # Plain text fallback (client stripped)
    83|    plain = re.sub('<[^>]+>', '', html_body)
    84|    plain = re.sub(r'\n{3,}', '\n\n', plain).strip()
    85|    alt = MIMEMultipart('alternative')
    86|    alt.attach(MIMEText(plain, 'plain', 'utf-8'))
    87|    alt.attach(MIMEText(html_body, 'html', 'utf-8'))
    88|
    89|    msg.attach(alt)  # FIRST — this is the root
    90|
    91|    # 2) Logo (inline CID)
    92|    with open(LOGO_PATH, 'rb') as f:
    93|        img = MIMEImage(f.read(), _subtype='png')
    94|        img.add_header('Content-ID', '<logo>')
    95|        img.add_header('Content-Disposition', 'inline', filename='logo.png')
    96|        msg.attach(img)
    97|
    98|    # 3) Video thumbnail (inline CID)
    99|    with open(THUMB_PATH, 'rb') as f:
   100|        thumb = MIMEImage(f.read(), _subtype='jpeg')
   101|        thumb.add_header('Content-ID', '<video_thumb>')
   102|        thumb.add_header('Content-Disposition', 'inline', filename='thumb.jpg')
   103|        msg.attach(thumb)
   104|
   105|    return msg
   106|
   107|msg = make_msg()
   108|ctx = ssl.create_default_context()
   109|with smtplib.SMTP(SMTP['server'], SMTP['port']) as s:
   110|    s.ehlo(); s.starttls(context=ctx); s.ehlo()
   111|    s.login(SMTP['email'], SMTP['password'])
   112|    s.send_message(msg)
   113|print("✅ Email trimis cu MIME corect!")
   114|print(f"   Către: {DEST}")
   115|print(f"   Subiect: Procesele-verbale de la GAL Delta Dunării - o întrebare")
   116|print(f"   Structură: multipart/related → alternative(plain+html) + logo + thumbnail")
   117|print(f"   Video: {VIDEO_URL}")
   118|print()
   119|print("👉 Verifică inbox-ul ACUM — ar trebui să se vadă conținutul")