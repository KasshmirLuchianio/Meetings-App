     1|#!/usr/bin/env python3
     2|"""Quick send - Template A+C combo with logo + video URL"""
     3|import smtplib, ssl, os, base64
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
    32|    # Attach logo
    33|    with open(LOGO_PATH, 'rb') as f:
    34|        img = MIMEImage(f.read(), _subtype='png')
    35|        img.add_header('Content-ID', '<logo>')
    36|        img.add_header('Content-Disposition', 'inline', filename='logo.png')
    37|        msg.attach(img)
    38|
    39|    # Attach video thumbnail
    40|    with open(THUMB_PATH, 'rb') as f:
    41|        thumb = MIMEImage(f.read(), _subtype='jpeg')
    42|        thumb.add_header('Content-ID', '<video_thumb>')
    43|        thumb.add_header('Content-Disposition', 'inline', filename='thumb.jpg')
    44|        msg.attach(thumb)
    45|
    46|    # HTML body
    47|    body = f"""<html>
    48|<body style="font-family:Georgia,'Times New Roman',serif;color:#333;line-height:1.7;font-size:15px;max-width:600px;margin:0 auto;">
    49|
    50|<p style="text-align:center;margin-bottom:24px;">
    51|  <img src="cid:logo" alt="Meetings.ro" width="180" style="display:inline-block;">
    52|</p>
    53|
    54|<p>Stimate domnule director,</p>
    55|
    56|<p>Vă scriu pentru că am observat că <b>GAL Delta Dunării</b> organizează întâlniri periodice. Conform OUG 54/2019, fiecare întâlnire trebuie documentată cu proces-verbal semnat — iar asta înseamnă ore de transcriere manuală.</p>
    57|
    58|<p>Am vorbit cu zeci de directori de GAL-uri din țară și toți mi-au spus același lucru: <em>transcrierea și redactarea PV-urilor consumă între 12 și 15 ore pe lună.</em></p>
    59|
    60|<p>De aceea am construit <b>Meetings.ro</b> — o aplicație care face totul automat:</p>
    61|
    62|<ul style="line-height:1.8;">
    63|<li>Înregistrează audio direct din telefon sau tabletă</li>
    64|<li>Transcrie automat conversația în limba română</li>
    65|<li>Generează procesul-verbal cu structura corectă (gata de semnare)</li>
    66|<li>Exportă PDF sau Word pentru arhivare</li>
    67|</ul>
    68|
    69|<p>Totul este conform OUG 54/2019.</p>
    70|
    71|<p style="text-align:center;margin:20px 0;">
    72|  <a href="{VIDEO_URL}" style="text-decoration:none;">
    73|    <span style="display:inline-block;border:1px solid #ddd;border-radius:8px;padding:4px;background:#f9f9f9;">
    74|      <img src="cid:video_thumb" alt="Video Meetings.ro" width="400" style="border-radius:6px;display:block;">
    75|      <span style="display:block;padding:8px 0;font-size:13px;color:#1B2A4A;">▶ Click pentru video — 2 minute</span>
    76|    </span>
    77|  </a>
    78|</p>
    79|
    80|<!-- Testimonial -->
    81|<p style="margin:24px 0;padding:16px 20px;background:#f8f9fa;border-left:3px solid #1B2A4A;border-radius:4px;">
    82|<em>"De când folosim Meetings.ro, echipa noastră economisește peste 10 ore lunar. Procesele-verbale sunt gata în 5 minute, nu în 3-4 ore."</em>
    83|<br><br>
    84|<b>Director GAL din Transilvania</b>
    85|</p>
    86|
    87|<p style="margin-top:24px;">Dacă aveți 15 minute săptămâna viitoare, vă arăt cum funcționează în practică pentru <b>GAL Delta Dunării</b>. Aplicația este deja disponibilă pe Google Play.</p>
    88|
    89|<p>Întrebări? Răspund direct la acest email.</p>
    90|
    91|{SIG}
    92|</body>
    93|</html>"""
    94|
    95|    msg.attach(MIMEText(body, 'html', 'utf-8'))
    96|    return msg
    97|
    98|msg = make_msg()
    99|ctx = ssl.create_default_context()
   100|with smtplib.SMTP(SMTP['server'], SMTP['port']) as s:
   101|    s.ehlo(); s.starttls(context=ctx); s.ehlo()
   102|    s.login(SMTP['email'], SMTP['password'])
   103|    s.send_message(msg)
   104|print("✅ Email trimis cu succes!")
   105|print(f"   Către: {DEST}")
   106|print(f"   Subiect: Procesele-verbale de la GAL Delta Dunării - o întrebare")
   107|print(f"   Logo: Meetings.ro.png (încorporat)")
   108|print(f"   Thumbnail video: IMAGE 1 MEETINGS.jpg (încorporat)")
   109|print(f"   Video URL: {VIDEO_URL}")
   110|print()
   111|print("👉 Verifică inbox-ul și spune-mi:")
   112|print("   1. Se vede logo-ul sus?")
   113|print("   2. Se vede thumbnail-ul video cu buton play?")
   114|print("   3. Arată bine combinat A+C?")
   115|print("   4. Vreo ajustare?")