# Checklist tehnic GDPR — starea REALĂ a aplicației
## Livrabilul B pentru DPA (`DPA_GDPR_draft.md`)

**Data auditului:** 29 iulie 2026
**Metodă:** inspecția codului sursă (`backend/server.py`, 5.600+ linii) și a
configurației de deploy (`render.yaml`, `entrypoint.sh`, `supervisord.conf`).
**Autor:** audit tehnic automat, neverificat de auditor extern.

---

## De ce există acest document

Un DPA semnat descrie măsuri tehnice pe care furnizorul **se obligă** să le
aibă. Dacă măsurile nu există în realitate, DPA-ul nu e o protecție — e o
declarație falsă într-un contract cu o autoritate publică, cu expunere
juridică directă.

Acest document spune, fără înfrumusețare, **ce există și ce nu**. Coloana
„Stare" nu conține niciun „parțial" folosit ca eufemism pentru „nu".

**Legendă:**
- ✅ **DA** — implementat și verificat în cod
- ⚠️ **PARȚIAL** — există, dar cu lipsuri concrete (descrise)
- ❌ **NU** — nu există
- 🔍 **DE VERIFICAT** — nu poate fi confirmat din cod (ține de configurația
  furnizorului sau de contul de producție)

---

## Rezumat executiv

| Cerință DPA | Stare |
|---|---|
| 1. Logging de audit pentru accesul la date | ❌ **NU** |
| 2. Mecanism de ștergere date la cerere | ⚠️ **PARȚIAL** |
| 3. Mecanism de export date la cerere | ❌ **NU** (doar export per ședință) |
| 4. Criptare în tranzit | ✅ **DA** |
| 5. Criptare în repaus | 🔍 **DE VERIFICAT** (probabil DA, prin furnizori) |
| 6. Registru sub-procesatori | ⚠️ **PARȚIAL** (întocmit acum, neverificat) |
| 7. Flux de notificare breșă | ❌ **NU** |

**Concluzie onestă: 1 din 7 cerințe este integral acoperită.**
DPA-ul **nu poate fi semnat responsabil** înainte de rezolvarea punctelor
1, 3 și 7 — acestea sunt cele pe care un DPO de primărie le verifică efectiv.

---

## 1. Logging de audit pentru accesul la date — ❌ NU

**Ce cere DPA-ul (Art. 4.3):** evidența „cine, ce, când" pentru accesul la
datele cu caracter personal.

**Ce există în cod:**
- Colecții existente în bază: `meetings`, `localities`, `users`, `tenants`,
  `invitations`, `processed_events`, `invoices`, `invoice_failures`.
- **Nu există** nicio colecție de tip audit (`0` rezultate pentru
  `audit_log` / `audit_col` în întregul backend).
- Există `print()`-uri în consolă (loguri de aplicație), dar acestea:
  - nu sunt structurate,
  - nu sunt persistente (se pierd la restart-ul containerului),
  - nu înregistrează *cine a citit ce ședință*,
  - nu sunt protejate împotriva modificării.

**Impact concret:** la o solicitare a ANSPDCP sau la o suspiciune de acces
neautorizat, **nu se poate răspunde la întrebarea „cine a văzut transcrierea
ședinței X?"**. Este cea mai vizibilă lipsă din întreg checklist-ul.

**Ce trebuie construit:**
- colecție `audit_log` cu: `timestamp`, `user_id`, `tenant_id`, `action`
  (`view` / `export` / `delete` / `login` / `update_role`), `resource_type`,
  `resource_id`, `ip_address`, `user_agent`;
- scriere automată pe endpoint-urile care ating date personale;
- retenție configurabilă (recomandat 12 luni) + protecție la ștergere;
- endpoint de consultare pentru administratorul instituției.

**Efort estimat:** 1–2 zile.

---

## 2. Mecanism de ștergere date la cerere — ⚠️ PARȚIAL

**Ce există** (`backend/server.py:1576`, `DELETE /api/auth/delete-account`):
```
- șterge toate ședințele utilizatorului   (meetings_col.delete_many)
- șterge contul utilizatorului            (users_col.delete_one)
- șterge fișierele audio locale           (shutil.rmtree)
```

**Ce lipsește:**

| Lipsă | Consecință |
|---|---|
| Nu șterge datele din **copiile de siguranță** (S3) | Datele supraviețuiesc ștergerii — contrazice Art. 7.4 din DPA |
| Nu șterge **apartenența la organizație** (`tenants`, `invitations`) | Rămân referințe orfane către utilizatorul șters |
| Nu există ștergere **la nivel de organizație** (tenant) | La încetarea contractului nu există buton „șterge tot" — cerința Art. 7.1 |
| Nu emite **confirmare scrisă a ștergerii** | Cerută de Art. 7.5 din DPA |
| Nu există ștergere **selectivă** (o singură ședință la cererea unei persoane vizate) | Dreptul la ștergere al unui terț menționat în transcriere nu poate fi executat |
| Nu există **jurnalizarea** ștergerii | Nu se poate dovedi că ștergerea a avut loc |

**Efort estimat:** 2–3 zile.

---

## 3. Mecanism de export date la cerere — ❌ NU

**Ce există:** export **per ședință**, în trei formate
(`server.py:4292/4460/4599` — PDF, DOCX, proces-verbal).

**Ce lipsește:** exportul cerut de Art. 20 GDPR (portabilitate) și de Art. 7.3
din DPA — adică **toate datele unui utilizator sau ale unei organizații**,
într-un singur pachet, în format structurat și lizibil automat.

Un funcționar care trebuie să răspundă unei cereri de portabilitate ar trebui
azi să descarce manual, ședință cu ședință. La o organizație cu 200 de ședințe,
cerința legală devine practic inaplicabilă.

**Ce trebuie construit:**
- endpoint de export complet → arhivă ZIP cu:
  - `user.json` / `tenant.json` (date de cont, structurate),
  - `meetings.json` (metadate + transcrieri integrale),
  - documentele generate (PDF/DOCX),
  - `README.txt` explicativ pentru persoana vizată;
- generare asincronă + notificare pe email la finalizare (arhiva poate fi mare);
- jurnalizarea exportului în `audit_log`.

**Efort estimat:** 2 zile.

---

## 4. Criptare în tranzit — ✅ DA

- Aplicația este servită exclusiv prin **HTTPS** (TLS terminat de Render).
- Apelurile către sub-procesatori (OpenAI, Anthropic, Stripe, MongoDB Atlas)
  se fac prin HTTPS/TLS, impus de SDK-urile oficiale.
- Conexiunea la baza de date folosește `mongodb+srv://` (Atlas) — **TLS
  obligatoriu**, nu poate fi dezactivat.
- SMTP: port 465 cu `smtplib.SMTP_SSL` și context SSL implicit
  (`backend/server.py`, funcția `_send_email_smtp`).

**Observație:** nu este configurat **HSTS** și nu există redirect explicit
HTTP→HTTPS la nivel de aplicație (Render îl asigură implicit).
Recomandare minoră: adăugarea antetelor de securitate
(`Strict-Transport-Security`, `X-Content-Type-Options`).

---

## 5. Criptare în repaus — 🔍 DE VERIFICAT

**Nu poate fi confirmată din codul aplicației** — depinde de configurația
furnizorilor. De verificat individual, cu dovadă documentară, înainte de
semnarea DPA:

| Componentă | Așteptare | De verificat |
|---|---|---|
| MongoDB Atlas | Criptare AES-256 în repaus, activă implicit pe toate clusterele, inclusiv M0 | Confirmare în documentația Atlas + captură din consolă |
| Amazon S3 (backup) | SSE-S3 activă implicit la obiecte noi | **De activat explicit** la crearea bucket-ului + verificare politică |
| Disc Render | Criptare la nivel de platformă | De confirmat cu Render (documentație/suport) |

**Notă importantă:** parolele utilizatorilor sunt stocate corect — **hash
bcrypt**, nu text clar (`hash_password`, biblioteca `bcrypt` în
`requirements.txt`). Acesta este un punct bun.

**Notă critică separată:** transcrierile sunt stocate în bază **în clar** (nu
criptate la nivel de aplicație). Criptarea la nivel de furnizor protejează
împotriva furtului fizic al discului, **nu** împotriva unui acces neautorizat
la baza de date. Pentru date de ședințe ale autorităților publice, o instituție
exigentă poate cere criptare la nivel de câmp.
`[DE DECIS]` — decizie de arhitectură, nu se rezolvă în DPA.

---

## 6. Registru sub-procesatori — ⚠️ PARȚIAL

**Ce s-a făcut:** registrul a fost întocmit prin inspecția codului și se află
în **Anexa 2** din `DPA_GDPR_draft.md` (11 sub-procesatori identificați).

**Ce lipsește:**
- **Verificare umană** — pot exista servicii configurate exclusiv prin
  variabile de mediu în Render, invizibile în cod.
- **Confirmarea localizării** fiecărui furnizor (coloana „Localizare" conține
  „de confirmat" pentru majoritatea).
- **Contractele/DPA-urile cu fiecare sub-procesator** — obligatoriu conform
  Art. 28 alin. (4). În prezent **nu există dovada** că au fost semnate DPA-uri
  cu OpenAI, Anthropic, MongoDB, AWS etc. (majoritatea le oferă standard, dar
  trebuie acceptate explicit și arhivate).
- **Procedura de notificare** a Operatorului la schimbarea unui sub-procesator
  (Art. 5.2 din DPA cere 30 de zile) — nu există mecanism.
- **Pagină publică** cu lista sub-procesatorilor (bună practică, așteptată de
  instituții).

> ⚠️ **Punctul cel mai greu, semnalat și în DPA (Art. 5):** OpenAI și Anthropic
> sunt în SUA și primesc **conținutul integral al ședințelor**. Acesta nu e un
> detaliu de anexă — e o decizie de arhitectură care poate bloca vânzarea către
> instituții care impun păstrarea datelor în UE. Trebuie clarificat **înainte**
> de a intra în discuții contractuale, nu în timpul lor.

---

## 7. Flux de notificare breșă — ❌ NU

**Ce cere DPA-ul (Art. 9):** notificarea Operatorului în maximum 24 de ore, în
scris, cu un conținut minim definit.

**Ce există:** nimic. Nu există procedură documentată, nici mecanism tehnic,
nici responsabil desemnat, nici șablon de notificare.

Există **Sentry** configurat (monitorizare erori), care e util pentru detectarea
incidentelor tehnice, dar:
- nu detectează breșe de confidențialitate (ex. acces neautorizat cu credențiale
  valide),
- nu declanșează niciun flux de notificare,
- nu are alertare configurată către o persoană responsabilă.

**Ce trebuie construit (majoritar organizatoric, nu cod):**
1. **Procedură scrisă**: cine detectează, cine evaluează, cine decide, cine
   notifică, în ce termen.
2. **Responsabil desemnat** + contact de rezervă.
3. **Șablon de notificare** conform Art. 9.2 din DPA (câmpurile sunt deja
   listate acolo).
4. **Registru intern al incidentelor** (obligatoriu, Art. 33 alin. (5) GDPR).
5. **Alertare tehnică**: Sentry → email/telefon responsabil; alertă la eșecuri
   de autentificare repetate; alertă la export masiv de date.
6. **Test anual** al procedurii (simulare).

**Efort estimat:** 1 zi (cod/alertare) + redactarea procedurii cu avocatul/DPO.

---

## Constatări suplimentare de securitate (în afara cerințelor DPA)

Descoperite în timpul auditului, relevante pentru orice discuție de securitate
cu o instituție:

| # | Constatare | Severitate | Detaliu |
|---|---|---|---|
| 1 | **Conturi seed cu parole fixe în cod** | 🔴 Ridicată | `create_demo_account()` și `create_google_review_account()` creează la fiecare pornire conturi cu parole hardcodate, vizibile în cod sursă și tipărite în loguri. Contul de review are **plan PRO**. Oricine citește repo-ul (sau logurile) se poate autentifica. **Recomandare: parole din variabile de mediu + dezactivare în producție.** |
| 2 | Lipsă 2FA | 🟠 Medie | Nicio formă de autentificare cu doi factori. Instituțiile publice o cer frecvent pentru conturi administrative. |
| 3 | Lipsă politică de retenție configurabilă | 🟠 Medie | Retenția audio e binară (`keep_audio` da/nu). Nu există „șterge automat ședințele mai vechi de N luni" — cerință frecventă în caietele de sarcini. |
| 4 | Fișiere audio efemere pe planul actual | 🟡 Informativ | Pe Render free, fișierele audio se pierd la restart. Nu e o problemă GDPR (mai puține date = mai bine), dar e o **problemă de așteptări contractuale** dacă se promite redarea audio. |
| 5 | Lipsă antete de securitate HTTP | 🟡 Scăzută | Fără HSTS, CSP, X-Content-Type-Options. |

---

## Plan de remediere propus (ordine recomandată)

Ordinea nu e după efort, ci după **ce blochează efectiv semnarea unui contract**.

| Etapă | Ce se face | Efort | Blochează contractul? |
|---|---|---|---|
| **0** | Fix parole conturi seed (constatarea #1) | 2 ore | Nu, dar e risc activ acum |
| **1** | Audit log (`audit_log` + scriere + consultare) | 1–2 zile | **DA** |
| **2** | Export complet date (utilizator + organizație) | 2 zile | **DA** |
| **3** | Ștergere completă (tenant, backup, confirmare) | 2–3 zile | **DA** |
| **4** | Procedură + alertare breșă | 1 zi + redactare | **DA** |
| **5** | Verificare criptare at-rest + DPA-uri sub-procesatori | 1 zi (administrativ) | **DA** |
| **6** | Decizie transfer internațional (AI în UE?) | Decizie strategică | **DA — cea mai grea** |
| **7** | 2FA + retenție configurabilă + antete securitate | 3–4 zile | Nu, dar întăresc oferta |

**Total estimat până la „DPA semnabil onest": ~8–10 zile de dezvoltare**, plus
timpul avocatului și decizia de la etapa 6.

---

## Criteriu de succes verificabil

Acest livrabil se consideră îndeplinit când, pentru fiecare din cele 7 cerințe,
starea este ✅ sau 🔍-confirmat-documentar, iar tabelul din **Anexa 1** a DPA-ului
poate fi completat integral **fără nicio afirmație falsă**.

Astăzi, acel criteriu **nu este îndeplinit**. Documentul de față există tocmai
ca să nu fie declarat îndeplinit din greșeală.
