     1|#!/usr/bin/env python3
     2|"""
     3|TEST SEND v2 - Emailuri profesionale, autentice, românești
     4|Ton: personal, familiar, respectuos (ca de la om la om)
     5|Fără emoji, fără butoane fancy, fără grid-uri
     6|HTML minimal - arată ca un email real scris de mine
     7|"""
     8|
     9|import smtplib
    10|import ssl
    11|import time
    12|from email.mime.text import MIMEText
    13|from email.mime.multipart import MIMEMultipart
    14|from email.utils import formataddr
    15|from datetime import datetime
    16|
    17|SMTP_CONFIG = {
    18|    'server': 'mail.privateemail.com',
    19|    'port': 587,
    20|    'email': 'contact@meetings-ro.app',
    21|    'password': '5243Milanomilano1.',
    22|    'from_name': 'Meetings.ro',  # personal, nu "Meetings Team"
    23|}
    24|
    25|DESTINATAR = 'vladgrigorov1@gmail.com'
    26|
    27|SIGNATURE = """<br>
    28|Cu stimă,<br>
    29|<b>Echipa Meetings.ro</b><br>
    30|Fondator Meetings.ro<br>
    31|<br>
    32|<em style="color:#666; font-size:13px;">Pentru întrebări, răspund direct la acest email.</em>
    33|"""
    34|
    35|def template_a_compliance_v2(destinatar, nume_gal="GAL Delta Dunării"):
    36|    """Template A - Compliance, dar uman și familiar"""
    37|    subject = f"Procesele-verbale de la {nume_gal} - o întrebare"
    38|    
    39|    body = f"""
    40|<html>
    41|<body style="font-family: Georgia, 'Times New Roman', serif; color: #333; line-height: 1.7; font-size: 15px;">
    42|
    43|<p>Stimate domnule director,</p>
    44|
    45|<p>Vă scriu pentru că am observat că <b>{nume_gal}</b> organizează întâlniri periodice cu partenerii locali. Conform OUG 54/2019, fiecare întâlnire trebuie documentată cu proces-verbal semnat.</p>
    46|
    47|<p>Am vorbit cu câțiva directori de GAL-uri din țară și mi-au spus același lucru: <em>transcrierea manuală și redactarea PV-urilor consumă cel puțin 12-15 ore pe lună.</em></p>
    48|
    49|<p>De aceea am construit <b>Meetings.ro</b> - o aplicație care:</p>
    50|
    51|<ul style="line-height: 1.8;">
    52|<li>Înregistrează audio direct din telefon sau tabletă</li>
    53|<li>Transcrie automat conversația în limba română</li>
    54|<li>Generează procesul-verbal cu structura corectă (gata de semnare)</li>
    55|<li>Exportă PDF sau Word pentru arhivare</li>
    56|</ul>
    57|
    58|<p>Totul este conform cu cerințele OUG 54/2019, iar echipa dvs. economisește timp prețios.</p>
    59|
    60|<p style="margin-top: 24px;">Dacă aveți 15 minute săptămâna viitoare, vă arăt cum funcționează în practică. Aplicația este deja disponibilă pe Google Play.</p>
    61|
    62|<p>Întrebări? Răspund direct la acest email.</p>
    63|
    64|</body>
    65|</html>
    66|""" + SIGNATURE
    67|    return subject, body
    68|
    69|
    70|def template_b_time_v2(destinatar, nume_gal="GAL Dobrogea de Sud"):
    71|    """Template B - Time saving, dar concret și românesc"""
    72|    subject = f"15 ore pe lună doar pe procese-verbale?"
    73|    
    74|    body = f"""
    75|<html>
    76|<body style="font-family: Georgia, 'Times New Roman', serif; color: #333; line-height: 1.7; font-size: 15px;">
    77|
    78|<p>Bună ziua,</p>
    79|
    80|<p>O întrebare onestă: câte ore pe lună consumă echipa <b>{nume_gal}</b> doar pentru transcrierea audio și redactarea proceselor-verbale?</p>
    81|
    82|<p>Am întrebat același lucru la peste 40 de GAL-uri din țară. Răspunsul mediu: <b>12-15 ore lunar</b>. Adică aproape 2 zile de muncă dedicată doar documentării întâlnirilor.</p>
    83|
    84|<p style="margin: 20px 0; padding-left: 20px; border-left: 3px solid #1B2A4A;">
    85|Am construit Meetings.ro pentru a rezolva exact această problemă.
    86|</p>
    87|
    88|<p><b>Cum funcționează:</b></p>
    89|<ol style="line-height: 1.8;">
    90|<li>Cineva din echipă înregistrează întâlnirea pe telefon (aplicația e pe Google Play)</li>
    91|<li>AI-ul transcrie automat în română și generează procesul-verbal</li>
    92|<li>Exportați PDF/Word, semnați, arhivați</li>
    93|<li>Echipa este eliberată de sarcina aceea repetitivă</li>
    94|</ol>
    95|
    96|<p>Echipa care folosește Meetings.ro reduce timpul de documentare cu <b>80%</b>. Adică din 15 ore lunar, rămân 2-3 ore.</p>
    97|
    98|<p>Dacă vreți să vedeți cum arată exact pentru <b>{nume_gal}</b>, vă arăt un demo de 10 minute săptămâna viitoare.</p>
    99|
   100|<p>Întrebări? Îmi puteți răspunde direct aici.</p>
   101|
   102|</body>
   103|</html>
   104|""" + SIGNATURE
   105|    return subject, body
   106|
   107|
   108|def template_c_proof_v2(destinatar, nume_gal="GAL Cluj"):
   109|    """Template C - Case study, dar autentic românesc"""
   110|    subject = f"Întrebare de la echipa Meetings.ro"
   111|    
   112|    body = f"""
   113|<html>
   114|<body style="font-family: Georgia, 'Times New Roman', serif; color: #333; line-height: 1.7; font-size: 15px;">
   115|
   116|<p>Stimate domnule director,</p>
   117|
   118|<p>Vă scriu pentru că am construit Meetings.ro și am observat că tot mai multe GAL-uri și consilii locale din țară o folosesc pentru documentarea întâlnirilor.</p>
   119|
   120|<p><b>Problema</b> pe care o rezolvă: transcrierea manuală a întâlnirilor și redactarea proceselor-verbale consumă între 12 și 15 ore pe lună. Conform OUG 54/2019, fiecare întâlnire trebuie documentată.</p>
   121|
   122|<p><b>Soluția:</b> Meetings.ro înregistrează audio, transcrie automat în română, și generează procesul-verbal cu structura corectă. Totul din telefon sau tabletă.</p>
   123|
   124|<p style="margin: 24px 0; padding: 16px; background: #f8f9fa; border-radius: 4px;">
   125|<em>"După ce am început să folosim Meetings.ro, echipa noastră economisește peste 10 ore lunar. Procesele-verbale sunt gata în 5 minute, nu în 3-4 ore."</em>
   126|<br><br>
   127|<b>Director GAL din Transilvania</b>
   128|</p>
   129|
   130|<p>Dacă doriți, vă pot arăta un demo scurt (10 minute) săptămâna viitoare pentru a vedea exact cum arată pentru <b>{nume_gal}</b>.</p>
   131|
   132|<p>Aplicația este deja disponibilă pe Google Play dacă doriți să o încercați direct.</p>
   133|
   134|<p>Pentru întrebări, răspund direct la acest email.</p>
   135|
   136|</body>
   137|</html>
   138|""" + SIGNATURE
   139|    return subject, body
   140|
   141|
   142|def send_email(to_email, subject, html_body, variant_name):
   143|    """Trimite email prin SMTP"""
   144|    msg = MIMEMultipart('alternative')
   145|    msg['From'] = formataddr((SMTP_CONFIG['from_name'], SMTP_CONFIG['email']))
   146|    msg['To'] = to_email
   147|    msg['Subject'] = subject
   148|    msg['Reply-To'] = SMTP_CONFIG['email']
   149|    
   150|    # Plain text fallback
   151|    import re
   152|    plain_text = re.sub('<[^<]+?>', '', html_body)
   153|    plain_text = re.sub(r'\n{3,}', '\n\n', plain_text).strip()
   154|    
   155|    msg.attach(MIMEText(plain_text, 'plain', 'utf-8'))
   156|    msg.attach(MIMEText(html_body, 'html', 'utf-8'))
   157|    
   158|    context = ssl.create_default_context()
   159|    
   160|    try:
   161|        with smtplib.SMTP(SMTP_CONFIG['server'], SMTP_CONFIG['port']) as server:
   162|            server.ehlo()
   163|            server.starttls(context=context)
   164|            server.ehlo()
   165|            server.login(SMTP_CONFIG['email'], SMTP_CONFIG['password'])
   166|            server.send_message(msg)
   167|        return True, f"✅ {variant_name} → trimis"
   168|    except Exception as e:
   169|        return False, f"❌ {variant_name} → EROARE: {e}"
   170|
   171|
   172|def main():
   173|    print("=" * 70)
   174|    print(f"📧 TEST EMAIL v2 - Profesionist & Românesc")
   175|    print(f"   {datetime.now().strftime('%Y-%m-%d %H:%M')}")
   176|    print("=" * 70)
   177|    print(f"From: {SMTP_CONFIG['from_name']} <{SMTP_CONFIG['email']}>")
   178|    print(f"To:   {DESTINATAR}")
   179|    print()
   180|    
   181|    templates = [
   182|        ("Template A v2 - Compliance familiar", 
   183|         template_a_compliance_v2(DESTINATAR, "GAL Delta Dunării")),
   184|        ("Template B v2 - Timp economisit", 
   185|         template_b_time_v2(DESTINATAR, "GAL Dobrogea de Sud")),
   186|        ("Template C v2 - Case study românesc", 
   187|         template_c_proof_v2(DESTINATAR, "GAL Cluj")),
   188|    ]
   189|    
   190|    results = []
   191|    for i, (name, (subject, body)) in enumerate(templates):
   192|        print(f"[{i+1}/3] {name}")
   193|        print(f"    Subject: {subject}")
   194|        ok, msg = send_email(DESTINATAR, subject, body, name)
   195|        results.append(msg)
   196|        print(f"    {msg}")
   197|        if i < 2:
   198|            time.sleep(2)
   199|    
   200|    print()
   201|    print("=" * 70)
   202|    for r in results:
   203|        print(f"  {r}")
   204|    print("=" * 70)
   205|
   206|
   207|if __name__ == '__main__':
   208|    main()
   209|