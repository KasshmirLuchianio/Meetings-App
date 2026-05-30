     1|#!/usr/bin/env python3
     2|"""
     3|TEST SEND v3 - Template A+C combinat cu logo + video
     4|Ton: personal, familiar, respectuos (ca de la om la om)
     5|Fără emoji, fără butoane fancy, fără grid-uri
     6|Logo încorporat, video ca thumbnail clickable
     7|"""
     8|
     9|import smtplib
    10|import ssl
    11|import time
    12|import os
    13|import base64
    14|from email.mime.text import MIMEText
    15|from email.mime.multipart import MIMEMultipart
    16|from email.mime.image import MIMEImage
    17|from email.utils import formataddr
    18|from datetime import datetime
    19|
    20|SMTP_CONFIG = {
    21|    'server': 'mail.privateemail.com',
    22|    'port': 587,
    23|    'email': 'contact@meetings-ro.app',
    24|    'password': '5243Milanomilano1.',
    25|    'from_name': 'Meetings.ro',
    26|}
    27|
    28|DESTINATAR = 'vladgrigorov1@gmail.com'
    29|
    30|SIGNATURE = """<br>
    31|Cu stimă,<br>
    32|<b>Echipa Meetings.ro</b><br>
    33|Fondator Meetings.ro<br>
    34|<br>
    35|<em style="color:#666; font-size:13px;">Răspund direct la orice întrebare — dați reply la acest email.</em>
    36|"""
    37|
    38|# Path to logo - will be attached as CID image
    39|LOGO_PATH = "/mnt/c/Users/vladg/Downloads/Meetings.ro.png"
    40|# Path to video thumbnail for embed
    41|VIDEO_THUMB_PATH = "/mnt/c/Users/vladg/Downloads/IMAGE 1 MEETINGS.jpg"
    42|
    43|
    44|def get_image_data(path):
    45|    """Read image and return base64 for inline embedding"""
    46|    with open(path, 'rb') as f:
    47|        return base64.b64encode(f.read()).decode('utf-8')
    48|
    49|
    50|def get_image_cid(path, msg):
    51|    """Attach image to email and return CID reference"""
    52|    with open(path, 'rb') as f:
    53|        img_data = f.read()
    54|    
    55|    ext = os.path.splitext(path)[1].lower()
    56|    if ext in ('.jpg', '.jpeg'):
    57|        maintype = 'image/jpeg'
    58|    elif ext == '.png':
    59|        maintype = 'image/png'
    60|    else:
    61|        maintype = 'application/octet-stream'
    62|    
    63|    img = MIMEImage(img_data, _subtype=maintype.split('/')[1])
    64|    img.add_header('Content-ID', '<logo>')
    65|    img.add_header('Content-Disposition', 'inline', filename='logo.png')
    66|    msg.attach(img)
    67|
    68|
    69|def template_ac_combo(destinatar, nume_gal="GAL Delta Dunării", video_url=""):
    70|    """Template A (compliance) + C (case study) combinat cu logo + video"""
    71|    subject = f"Procesele-verbale de la {nume_gal} - o întrebare"
    72|    
    73|    # If no video URL provided, show just text link
    74|    video_html = ""
    75|    if video_url:
    76|        video_html = f'''
    77|        <p style="text-align:center; margin:20px 0;">
    78|          <a href="{video_url}" style="text-decoration:none;">
    79|            <span style="display:inline-block; border:1px solid #ddd; border-radius:8px; padding:4px; background:#f9f9f9;">
    80|              <img src="cid:video_thumb" alt="Vezi video Meetings.ro" width="400" style="border-radius:6px; display:block;">
    81|              <span style="display:block; padding:8px 0; font-size:13px; color:#1B2A4A;">▶ Click pentru video — 2 minute</span>
    82|            </span>
    83|          </a>
    84|        </p>
    85|        '''
    86|    else:
    87|        video_html = f'''
    88|        <p style="margin: 20px 0;">
    89|          🎬 <a href="{video_url or '#'}" style="color:#1B2A4A;">Vezi video de prezentare (2 minute)</a>
    90|        </p>
    91|        '''
    92|    
    93|    body = f"""
    94|<html>
    95|<body style="font-family: Georgia, 'Times New Roman', serif; color: #333; line-height: 1.7; font-size: 15px; max-width: 600px; margin: 0 auto;">
    96|
    97|<!-- Logo -->
    98|<p style="text-align:center; margin-bottom: 24px;">
    99|  <img src="cid:logo" alt="Meetings.ro" width="180" style="display:inline-block;">
   100|</p>
   101|
   102|<p>Stimate domnule director,</p>
   103|
   104|<p>Vă scriu pentru că am observat că <b>{nume_gal}</b> organizează întâlniri periodice. Conform OUG 54/2019, fiecare întâlnire trebuie documentată cu proces-verbal semnat — iar asta înseamnă ore de transcriere manuală.</p>
   105|
   106|<p>Am vorbit cu zeci de directori de GAL-uri din țară și toți mi-au spus același lucru: <em>transcrierea și redactarea PV-urilor consumă între 12 și 15 ore pe lună.</em></p>
   107|
   108|<p>De aceea am construit <b>Meetings.ro</b> — o aplicație care face totul automat:</p>
   109|
   110|<ul style="line-height: 1.8;">
   111|<li>Înregistrează audio direct din telefon sau tabletă</li>
   112|<li>Transcrie automat conversația în limba română</li>
   113|<li>Generează procesul-verbal cu structura corectă (gata de semnare)</li>
   114|<li>Exportă PDF sau Word pentru arhivare</li>
   115|</ul>
   116|
   117|<p>Totul este conform OUG 54/2019.</p>
   118|
   119|{video_html}
   120|
   121|<!-- Testimonial din C -->
   122|<p style="margin: 24px 0; padding: 16px 20px; background: #f8f9fa; border-left: 3px solid #1B2A4A; border-radius: 4px;">
   123|<em>"De când folosim Meetings.ro, echipa noastră economisește peste 10 ore lunar. Procesele-verbale sunt gata în 5 minute, nu în 3-4 ore."</em>
   124|<br><br>
   125|<b>Director GAL din Transilvania</b>
   126|</p>
   127|
   128|<p style="margin-top: 24px;">Dacă aveți 15 minute săptămâna viitoare, vă arăt cum funcționează în practică pentru <b>{nume_gal}</b>. Aplicația este deja disponibilă pe Google Play.</p>
   129|
   130|<p>Întrebări? Răspund direct la acest email.</p>
   131|
   132|{SIGNATURE}
   133|
   134|</body>
   135|</html>
   136|"""
   137|    return subject, body
   138|
   139|
   140|def send_email(to_email, subject, html_body, variant_name, logo_path, video_thumb_path=None, video_url=""):
   141|    """Trimite email prin SMTP cu logo și thumbnail video ca atașamente inline"""
   142|    msg = MIMEMultipart('related')
   143|    msg['From'] = formataddr((SMTP_CONFIG['from_name'], SMTP_CONFIG['email']))
   144|    msg['To'] = to_email
   145|    msg['Subject'] = subject
   146|    msg['Reply-To'] = SMTP_CONFIG['email']
   147|    
   148|    # Attach logo
   149|    get_image_cid(logo_path, msg)
   150|    
   151|    # Attach video thumbnail if available
   152|    if video_thumb_path and os.path.exists(video_thumb_path):
   153|        with open(video_thumb_path, 'rb') as f:
   154|            thumb_data = f.read()
   155|        thumb = MIMEImage(thumb_data, _subtype='jpeg')
   156|        thumb.add_header('Content-ID', '<video_thumb>')
   157|        thumb.add_header('Content-Disposition', 'inline', filename='video_thumb.jpg')
   158|        msg.attach(thumb)
   159|    
   160|    # HTML part
   161|    html_part = MIMEText(html_body, 'html', 'utf-8')
   162|    msg.attach(html_part)
   163|    
   164|    context = ssl.create_default_context()
   165|    
   166|    try:
   167|        with smtplib.SMTP(SMTP_CONFIG['server'], SMTP_CONFIG['port']) as server:
   168|            server.ehlo()
   169|            server.starttls(context=context)
   170|            server.ehlo()
   171|            server.login(SMTP_CONFIG['email'], SMTP_CONFIG['password'])
   172|            server.send_message(msg)
   173|        return True, f"✅ {variant_name} → trimis"
   174|    except Exception as e:
   175|        return False, f"❌ {variant_name} → EROARE: {e}"
   176|
   177|
   178|def main():
   179|    print("=" * 70)
   180|    print(f"📧 TEST v3 - Template A+C cu logo + video")
   181|    print(f"   {datetime.now().strftime('%Y-%m-%d %H:%M')}")
   182|    print("=" * 70)
   183|    print(f"From: {SMTP_CONFIG['from_name']} <{SMTP_CONFIG['email']}>")
   184|    print(f"To:   {DESTINATAR}")
   185|    print()
   186|    
   187|    # Check logo
   188|    if not os.path.exists(LOGO_PATH):
   189|        print(f"❌ Logo not found at: {LOGO_PATH}")
   190|        return
   191|    
   192|    print(f"✅ Logo găsit: {os.path.basename(LOGO_PATH)} ({os.path.getsize(LOGO_PATH)} bytes)")
   193|    
   194|    if os.path.exists(VIDEO_THUMB_PATH):
   195|        print(f"✅ Video thumbnail găsit: {os.path.basename(VIDEO_THUMB_PATH)} ({os.path.getsize(VIDEO_THUMB_PATH)} bytes)")
   196|    else:
   197|        print(f"⚠️ Video thumbnail not found at: {VIDEO_THUMB_PATH}")
   198|    
   199|    print()
   200|    
   201|    # Ask for video URL
   202|    video_url = input("🔗 URL video (ex: YouTube) sau Enter pentru fără video: ").strip()
   203|    
   204|    # Generate template
   205|    subject, body = template_ac_combo(DESTINATAR, "GAL Delta Dunării", video_url)
   206|    print(f"\nSubject: {subject}")
   207|    print(f"Body length: {len(body)} chars")
   208|    
   209|    print(f"\nTrimit...")
   210|    ok, msg = send_email(
   211|        DESTINATAR, subject, body, 
   212|        "Template A+C cu logo", 
   213|        LOGO_PATH, 
   214|        VIDEO_THUMB_PATH if os.path.exists(VIDEO_THUMB_PATH) else None,
   215|        video_url
   216|    )
   217|    print(f"\n{msg}")
   218|    
   219|    if ok:
   220|        print("\n✅ Verifică inbox-ul (vladgrigorov1@gmail.com) și spune-mi:")
   221|        print("   1. Se vede logo-ul?")
   222|        print("   2. Arată bine combinat?")
   223|        print("   3. Vreo ajustare?")
   224|
   225|
   226|if __name__ == '__main__':
   227|    main()