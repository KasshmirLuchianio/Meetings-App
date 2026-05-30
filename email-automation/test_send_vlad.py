     1|#!/usr/bin/env python3
     2|"""
     3|TEST SEND: 3 emailuri către Vlad pentru verificare
     4|- Template A (Compliance OUG 54)
     5|- Template B (Time saving)  
     6|- Template C (Social proof)
     7|Trimite DOAR către Vlad, nu către GAL-uri.
     8|"""
     9|
    10|import smtplib
    11|import ssl
    12|import time
    13|from email.mime.text import MIMEText
    14|from email.mime.multipart import MIMEMultipart
    15|from email.utils import formataddr
    16|from datetime import datetime
    17|
    18|SMTP_CONFIG = {
    19|    'server': 'mail.privateemail.com',
    20|    'port': 587,
    21|    'email': 'contact@meetings-ro.app',
    22|    'password': '5243Milanomilano1.',
    23|    'from_name': 'Meetings Stuff',
    24|}
    25|
    26|# DESTINATAR: Vlad (verificare formatare + inbox)
    27|DESTINATAR = 'vladgrigorov1@gmail.com'
    28|
    29|SIGNATURE = """<br><br>
    30|Cu respect,<br>
    31|<b>Echipa Meetings.ro</b><br>
    32|Fondator, Meetings.ro<br>
    33|📧 contact@meetings-ro.app<br>
    34|🌐 <a href="https://meetings.ro">https://meetings.ro</a>
    35|"""
    36|
    37|def template_a_compliance(destinatar, nume_gal="GAL Delta Dunării"):
    38|    """Template A - Focus pe compliance OUG 54/2019"""
    39|    subject = f"[{nume_gal}] Procesele-verbale conform OUG 54/2019 - soluție automată"
    40|    
    41|    body = f"""
    42|<html>
    43|<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1B2A4A; line-height: 1.6; max-width: 600px; margin: 0 auto;">
    44|
    45|<div style="background: #FAF8F3; padding: 24px; border-radius: 12px; margin-bottom: 16px;">
    46|    <div style="text-align: center; margin-bottom: 16px;">
    47|        <h1 style="color: #1B2A4A; font-size: 22px; margin: 0;">Meetings.ro</h1>
    48|        <p style="color: #666; font-size: 13px; margin: 4px 0;">Automatizare procese-verbale pentru administrația publică</p>
    49|    </div>
    50|</div>
    51|
    52|<p>Bună ziua,</p>
    53|
    54|<p>Vă contactăm pentru că <b>{nume_gal}</b> coordonează întâlniri regulate care, conform <b>OUG 54/2019</b>, necesită documentare detaliată cu proces-verbal la final.</p>
    55|
    56|<p>Din experiența cu alte GAL-uri și consilii locale, echipele pierd în medie <b>12-15 ore lunar</b> doar cu transcrierea și redactarea PV-urilor.</p>
    57|
    58|<div style="background: #1B2A4A; color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
    59|    <h3 style="margin-top: 0;">Meetings.ro automatizează:</h3>
    60|    <p>✓ Înregistrare audio direct din telefon/tabletă<br>
    61|    ✓ Transcriere automată în limba română (AI)<br>
    62|    ✓ Proces-verbal generat instant, gata de semnare<br>
    63|    ✓ Export PDF/DOCX pentru arhivare<br>
    64|    ✓ 100% conform cu cerințele legale <b>OUG 54/2019</b></p>
    65|</div>
    66|
    67|<p>Vă propun un <b>demo gratuit de 15 minute</b> pentru a vedea exact cum funcționează în practică.</p>
    68|
    69|<p style="text-align: center; margin: 30px 0;">
    70|    <a href="https://meetings.ro" style="background: #1B2A4A; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
    71|        Încearcă Gratuit →
    72|    </a>
    73|</p>
    74|
    75|<p style="color: #666; font-size: 14px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee;">
    76|    <em>Aplicația este deja disponibilă pe Google Play pentru Android.</em><br>
    77|    Întrebări? Răspund direct la acest email.
    78|</p>
    79|
    80|</body>
    81|</html>
    82|"""
    83|    return subject, body
    84|
    85|
    86|def template_b_time(destinatar, nume_gal="GAL Dobrogea de Sud"):
    87|    """Template B - Focus pe economisire timp"""
    88|    subject = f"[{nume_gal}] Reduceți cu 80% timpul de redactare PV"
    89|    
    90|    body = f"""
    91|<html>
    92|<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1B2A4A; line-height: 1.6; max-width: 600px; margin: 0 auto;">
    93|
    94|<div style="background: #FAF8F3; padding: 24px; border-radius: 12px; margin-bottom: 16px;">
    95|    <div style="text-align: center; margin-bottom: 16px;">
    96|        <h1 style="color: #1B2A4A; font-size: 22px; margin: 0;">Meetings.ro</h1>
    97|        <p style="color: #666; font-size: 13px; margin: 4px 0;">Automatizare procese-verbale pentru administrația publică</p>
    98|    </div>
    99|</div>
   100|
   101|<p>Bună ziua,</p>
   102|
   103|<p>Câte ore pe lună consumă echipa <b>{nume_gal}</b> doar pentru transcrierea audio și redactarea proceselor-verbale?</p>
   104|
   105|<div style="background: #f8f9fa; padding: 20px; border-left: 4px solid #1B2A4A; margin: 20px 0;">
   106|    <b>Răspunsul mediu: 12-15 ore/lună</b><br>
   107|    Cu Meetings.ro, echipele reduc acest timp la 2-3 ore.<br>
   108|    <b>Economie reală: 80%.</b>
   109|</div>
   110|
   111|<h3 style="color: #1B2A4A;">Cum funcționează:</h3>
   112|<ol>
   113|    <li><b>Înregistrare audio</b> direct din telefon sau tabletă</li>
   114|    <li><b>Transcriere automată</b> folosind AI (limba română)</li>
   115|    <li><b>Proces-verbal</b> generat instant cu structura corectă</li>
   116|    <li><b>Export PDF/DOCX</b> pentru semnare și arhivare</li>
   117|</ol>
   118|
   119|<p style="text-align: center; margin: 30px 0;">
   120|    <a href="https://meetings.ro" style="background: #1B2A4A; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
   121|        Vezi demo de 2 minute →
   122|    </a>
   123|</p>
   124|
   125|<p>Dacă aveți 15 minute săptămâna viitoare, vă arăt exact cum arată pentru <b>{nume_gal}</b>.</p>
   126|
   127|</body>
   128|</html>
   129|"""
   130|    return subject, body
   131|
   132|
   133|def template_c_proof(destinatar, nume_gal="GAL Cluj"):
   134|    """Template C - Social proof / case study"""
   135|    subject = f"[{nume_gal}] Cum economisesc GAL-urile 10+ ore lunar la procese-verbale"
   136|    
   137|    body = f"""
   138|<html>
   139|<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1B2A4A; line-height: 1.6; max-width: 600px; margin: 0 auto;">
   140|
   141|<div style="background: #FAF8F3; padding: 24px; border-radius: 12px; margin-bottom: 16px;">
   142|    <div style="text-align: center; margin-bottom: 16px;">
   143|        <h1 style="color: #1B2A4A; font-size: 22px; margin: 0;">Meetings.ro</h1>
   144|        <p style="color: #666; font-size: 13px; margin: 4px 0;">Automatizare procese-verbale pentru administrația publică</p>
   145|    </div>
   146|</div>
   147|
   148|<p>Bună ziua,</p>
   149|
   150|<p>Consiliile locale și GAL-urile care folosesc Meetings.ro ne raportează <b>rezultate concrete</b>:</p>
   151|
   152|<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0;">
   153|    <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; text-align: center;">
   154|        <div style="font-size: 28px; font-weight: bold; color: #1B2A4A;">80%</div>
   155|        <div style="font-size: 13px; color: #666;">timp economisit</div>
   156|    </div>
   157|    <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; text-align: center;">
   158|        <div style="font-size: 28px; font-weight: bold; color: #1B2A4A;">100%</div>
   159|        <div style="font-size: 13px; color: #666;">conformitate OUG 54</div>
   160|    </div>
   161|</div>
   162|
   163|<p><b>Ce înseamnă asta pentru {nume_gal}:</b></p>
   164|<ul>
   165|    <li>Procesele-verbale gata în 5 minute, nu 3-4 ore</li>
   166|    <li>Zero greșeli de transcriere</li>
   167|    <li>Arhivă digitală completă, căutare instantanee</li>
   168|    <li>Echipa eliberată pentru sarcini mai importante</li>
   169|</ul>
   170|
   171|<div style="background: #1B2A4A; color: white; padding: 20px; border-radius: 8px; margin: 24px 0;">
   172|    <p style="margin: 0;"><em>"Am încercat să folosim dictafon + secretariat manual. Nu mai putem concepe să ne întoarcem."</em></p>
   173|</div>
   174|
   175|<p style="text-align: center; margin: 30px 0;">
   176|    <a href="https://meetings.ro" style="background: white; color: #1B2A4A; border: 2px solid #1B2A4A; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
   177|        Testează Gratuit 7 Zile →
   178|    </a>
   179|</p>
   180|
   181|</body>
   182|</html>
   183|"""
   184|    return subject, body
   185|
   186|
   187|def send_email(to_email, subject, html_body, variant_name):
   188|    """Trimite email prin SMTP PrivateEmail"""
   189|    msg = MIMEMultipart('alternative')
   190|    msg['From'] = formataddr((SMTP_CONFIG['from_name'], SMTP_CONFIG['email']))
   191|    msg['To'] = to_email
   192|    msg['Subject'] = subject
   193|    msg['Reply-To'] = SMTP_CONFIG['email']
   194|    msg['List-Unsubscribe'] = f'<mailto:{SMTP_CONFIG["email"]}?subject=unsubscribe>'
   195|    
   196|    # Plain text fallback
   197|    import re
   198|    plain_text = re.sub('<[^<]+?>', '', html_body)
   199|    plain_text = re.sub(r'\n{3,}', '\n\n', plain_text).strip()
   200|    
   201|    msg.attach(MIMEText(plain_text, 'plain', 'utf-8'))
   202|    msg.attach(MIMEText(html_body + SIGNATURE, 'html', 'utf-8'))
   203|    
   204|    context = ssl.create_default_context()
   205|    
   206|    try:
   207|        with smtplib.SMTP(SMTP_CONFIG['server'], SMTP_CONFIG['port']) as server:
   208|            server.ehlo()
   209|            server.starttls(context=context)
   210|            server.ehlo()
   211|            server.login(SMTP_CONFIG['email'], SMTP_CONFIG['password'])
   212|            server.send_message(msg)
   213|        return True, f"✅ {variant_name} → trimis la {to_email}"
   214|    except Exception as e:
   215|        return False, f"❌ {variant_name} → EROARE: {e}"
   216|
   217|
   218|def main():
   219|    print("=" * 70)
   220|    print(f"📧 TEST EMAIL SEND - {datetime.now().strftime('%Y-%m-%d %H:%M')}")
   221|    print("=" * 70)
   222|    print(f"Sender: {SMTP_CONFIG['from_name']} <{SMTP_CONFIG['email']}>")
   223|    print(f"Destinatar test: {DESTINATAR}")
   224|    print()
   225|    
   226|    templates = [
   227|        ("Template A - Compliance OUG 54", 
   228|         template_a_compliance(DESTINATAR, "GAL Delta Dunării")),
   229|        ("Template B - Time Saving 80%", 
   230|         template_b_time(DESTINATAR, "GAL Dobrogea de Sud")),
   231|        ("Template C - Social Proof", 
   232|         template_c_proof(DESTINATAR, "GAL Cluj")),
   233|    ]
   234|    
   235|    results = []
   236|    for i, (name, (subject, body)) in enumerate(templates):
   237|        print(f"[{i+1}/3] {name}")
   238|        print(f"    Subject: {subject}")
   239|        ok, msg = send_email(DESTINATAR, subject, body, name)
   240|        results.append(msg)
   241|        print(f"    {msg}")
   242|        if i < 2:
   243|            time.sleep(2)  # mic delay între emailuri
   244|    print()
   245|    print("=" * 70)
   246|    print("REZUMAT:")
   247|    for r in results:
   248|        print(f"  {r}")
   249|    print("=" * 70)
   250|
   251|
   252|if __name__ == '__main__':
   253|    main()
   254|