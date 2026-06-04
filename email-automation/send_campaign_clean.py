     1|#!/usr/bin/env python3
     2|"""
     3|Email template for GAL/primărie outreach — structure follows email anatomy diagram.
     4|SECTIONS: Logo → Featured Image → Headline → Content → Social → Contact → Footer
     5|"""
     6|import smtplib, ssl
     7|from email.mime.text import MIMEText
     8|from email.mime.multipart import MIMEMultipart
     9|from email.mime.image import MIMEImage
    10|from email.utils import formataddr
    11|import os
    12|
    13|SMTP = {
    14|    'server': 'mail.privateemail.com',
    15|    'port': 587,
    16|    'email': 'contact@meetings-ro.app',
    17|    'password': '5243Milanomilano1.',
    18|    'from_name': 'Meetings.ro'
    19|}
    20|
    21|GOOGLE_PLAY = 'https://play.google.com/store/apps/details?id=ro.meetingsapp.meetings'
    22|LOGO_PATH = "/mnt/c/Users/vladg/Downloads/Meetings.ro.png"
    23|FEATURED_IMAGE = "/mnt/c/Users/vladg/Downloads/hero_desk.jpg"  # Lifestyle shot: desk + phone with app open
    24|
    25|# ── STYLES ─────────────────────────────────────────────
    26|CONTAINER_STYLE = 'max-width:600px;margin:0 auto;font-family:Georgia,\'Times New Roman\',serif;color:#2d2d2d;'
    27|SECTION_STYLE = 'padding:20px 24px;'
    28|DIVIDER_STYLE = 'height:1px;background:#e0e0e0;margin:0 24px;'
    29|HEADLINE_STYLE = 'font-family:Georgia,serif;font-size:22px;font-weight:bold;color:#1B2A4A;line-height:1.3;margin:0 0 12px 0;'
    30|BODY_STYLE = 'font-size:15px;line-height:1.7;color:#333;'
    31|BTN_STYLE = 'display:inline-block;padding:14px 36px;background:#1B2A4A;color:white;text-decoration:none;border-radius:5px;font-size:16px;font-weight:bold;'
    32|TESTIMONIAL_STYLE = 'background:#f5f3ef;border-left:3px solid #1B2A4A;padding:14px 18px;margin:16px 0;border-radius:0 6px 6px 0;'
    33|FOOTER_STYLE = 'font-size:12px;color:#999;line-height:1.5;text-align:center;padding:16px 24px;'
    34|
    35|
    36|def build_email(institution_name, email_to, judet=""):
    37|    """Build email following the anatomy: Logo → Image → Headline → Content → Social → Contact → Footer."""
    38|    loc = f"din județul {judet}" if judet else ""
    39|    subject = f"Automatizare proces-verbal conform OUG 54/2019 — {institution_name}"
    40|
    41|    msg = MIMEMultipart('related')
    42|    msg['From'] = formataddr((SMTP['from_name'], SMTP['email']))
    43|    msg['To'] = email_to
    44|    msg['Subject'] = subject
    45|    msg['Reply-To'] = SMTP['email']
    46|
    47|    has_hero = os.path.exists(FEATURED_IMAGE)
    hero_html = f'''  <table width="100%" style="{CONTAINER_STYLE}background:#ffffff;">
  <tr><td style="padding:0;">
    <img src="cid:featured" alt="Meetings.ro — Aplicația" width="600" height="400"
         style="display:block;width:100%;max-width:600px;height:auto;">
  </td></tr>
  </table>''' if has_hero else ''

    html = f"""<!DOCTYPE html>
    48|<html>
    49|<body style="background:#f9f9f9;padding:0;margin:0;">
    50|<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;">
    51|<tr><td align="center" style="padding:20px 12px;">
    52|
    53|  <!-- ═══════ SECTION 1: LOGO ═══════ -->
    54|  <table width="100%" style="{CONTAINER_STYLE}background:#ffffff;border-radius:8px 8px 0 0;">
    55|  <tr><td style="{SECTION_STYLE}text-align:center;padding-top:28px;padding-bottom:20px;">
    56|    <img src="cid:logo" alt="Meetings.ro" width="160" style="display:inline-block;">
    57|  </td></tr>
    58|  </table>
    59|
    60|  <!-- ═══════ SECTION 2: FEATURED IMAGE (600x400) ═══════ -->
    61|  <table width="100%" style="{CONTAINER_STYLE}background:#ffffff;">
    62|  <tr><td style="padding:0;">
    63|    <img src="cid:featured" alt="Meetings.ro — Aplicația" width="600" height="400"
    64|         style="display:block;width:100%;max-width:600px;height:auto;">
    65|  </td></tr>
    66|  </table>
    67|
    68|  <!-- ═══════ SECTION 3: HEADLINE ═══════ -->
    69|  <table width="100%" style="{CONTAINER_STYLE}background:#ffffff;">
    70|  <tr><td style="{SECTION_STYLE}padding-top:24px;padding-bottom:8px;">
    71|    <h1 style="{HEADLINE_STYLE}">
    72|      Procesele-verbale nu se mai scriu de mână
    73|    </h1>
    74|  </td></tr>
    75|  </table>
    76|
    77|  <!-- ═══════ SECTION 4: CONTENT ═══════ -->
    78|  <table width="100%" style="{CONTAINER_STYLE}background:#ffffff;">
    79|  <tr><td style="{SECTION_STYLE}padding-top:8px;padding-bottom:20px;">
    80|
    81|    <p style="{BODY_STYLE}">Stimate domnule director,</p>
    82|
    83|    <p style="{BODY_STYLE}">Vă scriu pentru că <b>{institution_name}</b> {loc} organizează
    84|    întâlniri periodice. Conform <b>OUG 54/2019</b>, fiecare ședință trebuie documentată
    85|    cu proces-verbal semnat — iar asta înseamnă ore de transcriere manuală.</p>
    86|
    87|    <p style="{BODY_STYLE}">Redactarea proceselor-verbale poate consuma între <b>12 și 15 ore
    88|    pe lună</b>. Este o muncă necesară, dar care ține echipa de la lucrurile cu adevărat
    89|    importante.</p>
    90|
    91|    <p style="{BODY_STYLE}">De aceea am construit <b>Meetings.ro</b> — o aplicație care face
    92|    totul automat:</p>
    93|
    94|    <ul style="{BODY_STYLE}padding-left:20px;margin:8px 0 16px 0;">
    95|      <li style="margin-bottom:6px;">Înregistrează audio direct din telefon sau tabletă</li>
    96|      <li style="margin-bottom:6px;">Transcrie automat conversația în limba română</li>
    97|      <li style="margin-bottom:6px;">Generează procesul-verbal cu structura corectă (gata de semnare)</li>
    98|      <li style="margin-bottom:6px;">Exportă PDF sau Word pentru arhivare</li>
    99|    </ul>
   100|
   101|    <p style="{BODY_STYLE}">Totul este <b>conform OUG 54/2019</b>.</p>
   102|
   103|    <!-- Testimonial -->
   104|    <div style="{TESTIMONIAL_STYLE}">
   105|      <p style="margin:0;font-size:14px;font-style:italic;color:#444;">
   106|        „Aplicația este excepțională. Ne-a scutit de ore reale de muncă. Acum avem timp
   107|        să ne concentrăm pe dezvoltarea zonelor rurale pe care le avem în rază de execuție.”
   108|      </p>
   109|      <p style="margin:8px 0 0 0;font-size:13px;font-weight:bold;color:#1B2A4A;">
   110|        — GAL Oamenii Deltei, client Meetings.ro
   111|      </p>
   112|    </div>
   113|
   114|    <!-- CTA Button -->
   115|    <div style="text-align:center;margin:24px 0 8px 0;">
   116|      <a href="{GOOGLE_PLAY}" style="{BTN_STYLE}">
   117|        📲 Descarcă pe Google Play
   118|      </a>
   119|    </div>
   120|
   121|    <p style="{BODY_STYLE}margin-top:16px;">Dacă aveți 15 minute, vă arăt cum funcționează
   122|    pentru {institution_name}. Întrebări? Răspundem personal.</p>
   123|
   124|  </td></tr>
   125|  </table>
   126|
   127|  <!-- ═══════ SECTION 5: CONTACT ═══════ -->
   128|  <table width="100%" style="{CONTAINER_STYLE}background:#ffffff;">
   129|  <tr><td style="{DIVIDER_STYLE}"></td></tr>
   130|  <tr><td style="{SECTION_STYLE}text-align:center;">
   131|    <p style="font-size:13px;color:#666;margin:0;">
   132|      📧 <a href="mailto:contact@meetings-ro.app" style="color:#1B2A4A;">contact@meetings-ro.app</a>
   133|      &nbsp;|&nbsp;
   134|      🌐 <a href="https://meetings.ro" style="color:#1B2A4A;">meetings.ro</a>
   135|    </p>
   136|  </td></tr>
   137|  </table>
   138|
   139|  <!-- ═══════ SECTION 6: FOOTER ═══════ -->
   140|  <table width="100%" style="{CONTAINER_STYLE}background:#ffffff;">
   141|  <tr><td style="{SECTION_STYLE}text-align:center;">
   142|    <p style="font-size:13px;color:#666;margin:0 0 4px 0;">
   143|      <b>Meetings.ro</b> — Automatizare procese-verbale
   144|    </p>
   145|    <p style="font-size:13px;color:#666;margin:0;">
   146|      📧 <a href="mailto:contact@meetings-ro.app" style="color:#1B2A4A;">contact@meetings-ro.app</a>
   147|      &nbsp;|&nbsp;
   148|      🌐 <a href="https://meetings.ro" style="color:#1B2A4A;">meetings.ro</a>
   149|    </p>
   150|  </td></tr>
   151|  </table>
   152|
   153|  <!-- ═══════ SECTION 7: FOOTER ═══════ -->
   154|  <table width="100%" style="{CONTAINER_STYLE}background:#f5f3ef;border-radius:0 0 8px 8px;">
   155|  <tr><td style="{FOOTER_STYLE}">
   156|    <p style="margin:0 0 4px 0;">
   157|      Ai primit acest email pentru că instituția ta organizează întâlniri conform OUG 54/2019.
   158|    </p>
   159|    <p style="margin:0;">
   160|      <a href="mailto:contact@meetings-ro.app?subject=Dezabonare" style="color:#999;text-decoration:underline;">Dezabonare</a>
   161|      &nbsp;|&nbsp;
   162|      <a href="https://meetings.ro/privacy" style="color:#999;text-decoration:underline;">Politica de confidențialitate</a>
   163|    </p>
   164|    <p style="margin:8px 0 0 0;">© {institution_name.split(chr(32))[0] if institution_name else ''} — Toate drepturile rezervate.</p>
   165|  </td></tr>
   166|  </table>
   167|
   168|</td></tr>
   169|</table>
   170|</body>
   171|</html>"""
   172|
   173|    alt_msg = MIMEMultipart('alternative')
   174|    alt_msg.attach(MIMEText(html, 'html', 'utf-8'))
   175|    msg.attach(alt_msg)
   176|
   177|    # Attach logo
   178|    if os.path.exists(LOGO_PATH):
   179|        with open(LOGO_PATH, 'rb') as f:
   180|            img = MIMEImage(f.read())
   181|            img.add_header('Content-ID', '<logo>')
   182|            img.add_header('Content-Disposition', 'inline')
   183|            msg.attach(img)
   184|
   185|    # Attach featured image
   186|    if os.path.exists(FEATURED_IMAGE):
   187|        with open(FEATURED_IMAGE, 'rb') as f:
   188|            img = MIMEImage(f.read())
   189|            img.add_header('Content-ID', '<featured>')
   190|            img.add_header('Content-Disposition', 'inline')
   191|            msg.attach(img)
   192|
   193|    return msg
   194|
   195|
   196|def send_email(institution_name, email_to, judet=""):
   197|    """Send one email."""
   198|    msg = build_email(institution_name, email_to, judet)
   199|    context = ssl.create_default_context()
   200|    with smtplib.SMTP(SMTP['server'], SMTP['port']) as server:
   201|        server.starttls(context=context)
   202|        server.login(SMTP['email'], SMTP['password'])
   203|        server.sendmail(SMTP['email'], email_to, msg.as_string())
   204|    print(f"\u2713 {institution_name} \u2192 {email_to}")
   205|
   206|
   207|if __name__ == '__main__':
   208|    # Test send
   209|    send_email("GAL Oamenii Deltei", "vladgrigorov1@gmail.com", "Tulcea")
   210|