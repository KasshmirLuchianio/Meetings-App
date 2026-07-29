# Plan de implementare — semnătură electronică calificată (certSIGN / CSC API)
## Etapa 1: PLAN FĂRĂ COD, pentru aprobare

**Data:** 29 iulie 2026
**Status:** 🟡 **AȘTEAPTĂ APROBARE** — nu s-a scris nicio linie de cod.

---

## Regula de bază a acestui document

Fiecare afirmație este marcată cu sursa ei:

- ✅ **VERIFICAT** — confirmat din sursă publică, citată
- 🔴 **DE VERIFICAT** — **necunoscut**, trebuie obținut de la certSIGN înainte
  de implementare. **Nu a fost inventat.**
- 🟢 **DECIZIE INTERNĂ** — ține de noi, nu de certSIGN

**Nu există în acest document niciun endpoint, parametru sau URL certSIGN
inventat.** Unde nu am putut verifica, scrie explicit că nu știu.

---

## 1. Ce am verificat efectiv

### 1.1 certSIGN este membru CSC și implementează CSC API — ✅ VERIFICAT

certSIGN este membru al [Cloud Signature Consortium](https://cloudsignatureconsortium.org/member/certsign/)
și și-a integrat serviciul de semnătură calificată la distanță în Adobe Acrobat
Sign [folosind standardul CSC](https://cloudsignatureconsortium.org/certsign-remote-qualified-electronic-signature-service-integrated-into-adobe-acrobat-sign/),
descris ca „standardul dezvoltat de Cloud Signature Consortium care definește
un mod unificat de interacțiune între aplicațiile de semnare și serviciile de
semnătură electronică conforme eIDAS".

Prin proiectul [CISRES](https://www.certsign.ro/en/cisres-interoperable-system-based-on-certified-components-for-remote-electronic-signature-creation-services/),
certSIGN a dezvoltat un **modul software care implementează standardul CSC
pentru interfațarea cu aplicații terțe**, acoperind cerințele ETSI, CEN și CSC.

De asemenea, certSIGN a folosit **CSC API v2.2** în sandbox-ul propriu pentru
EUDI Wallet — deci versiunea 2.2 este în uz activ la ei.

**Concluzie:** direcția tehnică (CSC API v2.2) este **corectă și confirmată**,
nu o presupunere.

### 1.2 Fluxul standard CSC v2.2 — ✅ VERIFICAT ca standard

Fluxul canonic, identic la toți furnizorii CSC:

```
1. OAuth 2.0          → obținere access_token
                        (client_credentials sau authorization_code + refresh_token)
2. /info              → capabilitățile furnizorului
3. /credentials/list  → certificatele disponibile ale semnatarului
4. /credentials/info  → detaliile unui certificat (validitate, algoritmi)
5. autorizare credential → SAD (Signature Activation Data), tipic prin OTP/SMS
6. /signatures/signHash → semnarea hash-ului documentului
```

Pentru referință de implementare există documentație publică detaliată de la
alți membri CSC — de ex. [ghidul eSigner CSC API de la SSL.com](https://www.ssl.com/guide/remote-document-signing-with-esigner-csc-api/)
și [ghidul lor de integrare/testare](https://www.ssl.com/guide/integration-guide-testing-remote-signing-with-esigner-csc-api/),
plus [implementări open-source](https://github.com/simionrobert/cloud-signature-consortium).
Acestea sunt utile ca model, **dar nu ca sursă pentru specificul certSIGN**.

Specificațiile oficiale: [Cloud Signature Consortium — Protocols and API
specifications](https://cloudsignatureconsortium.org/resources/).

### 1.3 certSIGN oferă două moduri de semnare — ✅ VERIFICAT (sursă terță)

[Documentația de integrare FintechOS](https://docs.fintechos.com/Platform/21.1.1/AdminGuide/Content/DEVOPS/CertSign%20Integration%20for%20electronic%20signature.htm)
descrie integrarea cu certSIGN ca oferind:
- **semnătură la distanță** — cu cod de autorizare trimis prin **SMS**;
- **semnătură automată** — cu un certificat existent, fără interacțiune.

Menționează configurarea de *endpoints* și **subscription keys**.

> ⚠️ Sursă terță, versiune veche (platformă 21.1.1). Utilă ca indiciu asupra
> modelului de autentificare (subscription key), **nu** ca specificație.

---

## 2. Ce NU știu — 🔴 DE VERIFICAT direct cu certSIGN

**Acestea sunt blocante. Nu pot fi ghicite, iar implementarea nu poate începe
fără ele.**

| # | Necunoscută | De ce blochează |
|---|---|---|
| 1 | **URL-ul de bază** al API-ului CSC certSIGN (producție + test/sandbox) | Fără el nu există integrare. Documentația publică certSIGN nu îl expune (paginile lor au returnat HTTP 403 la accesare automată). |
| 2 | **Procedura de onboarding** ca „Sign Application" | Cine poate deveni aplicație semnatară, ce contract, ce verificări. |
| 3 | **Modelul de autentificare exact** — OAuth 2.0 pur, `subscription key`, sau ambele | Determină întreaga arhitectură de credențiale. Indiciul FintechOS sugerează subscription key, dar poate fi depășit. |
| 4 | **Ce flux OAuth acceptă** — `client_credentials` și/sau `authorization_code` | Decide dacă semnatarul se autentifică interactiv (probabil obligatoriu pentru QES). |
| 5 | **Extensii proprietare** peste CSC | Furnizorii CSC adaugă frecvent parametri proprii. |
| 6 | **Mecanismul SAD / autorizarea semnăturii** — SMS OTP, aplicație mobilă, push | Afectează direct UX-ul și ecranele de implementat. |
| 7 | **Suport `signDoc`** (semnare document integral, cu PAdES) sau doar `signHash` | Dacă doar `signHash`, trebuie să construim noi structura PAdES — **efort semnificativ mai mare**. |
| 8 | **Formatul de semnătură** suportat: PAdES-B, -T, -LT, -LTA | Pentru contracte B2G se cere de regulă cel puțin **PAdES-LT** (validabil pe termen lung). |
| 9 | **Timestamp calificat (QTSA)** — inclus sau separat | Necesar pentru PAdES-T și superior. |
| 10 | **Existența unui mediu de test** gratuit | Fără sandbox, dezvoltarea se face „orb" sau pe semnături reale (cu cost). |
| 11 | **Costurile** — per semnătură, abonament, certificat per utilizator | Constrângere explicită: **nicio acțiune cu costuri fără aprobarea ta separată.** |
| 12 | Cerințele pentru **certificatul semnatarului instituțional** | Fiecare funcționar semnatar are nevoie de certificat calificat propriu — cine îl obține, cine plătește. |

### Cum se obțin: acțiune umană necesară

Documentația tehnică certSIGN **nu este publică**. Trebuie solicitată. Concret:

1. Contact comercial/tehnic certSIGN, prin formularul de pe
   [pagina de semnătură electronică la distanță](https://www.certsign.ro/en/products/eidas-trust-services/remote-electronic-signature/)
   sau direct la departamentul de parteneriate.
2. Cerere explicită: *documentația CSC API v2.2, acces la mediul de test și
   condițiile de onboarding ca Sign Application*.
3. Menționează contextul: SaaS românesc, integrare pentru semnarea contractelor
   cu instituții publice.

> 🔴 **Acesta este singurul lucru care blochează întreg Task-ul 2. Este o
> acțiune pe care doar tu o poți face** — eu nu pot semna contracte, nu pot
> deschide conturi și nu pot angaja costuri.

---

## 3. Arhitectura propusă (independentă de necunoscute)

Partea de mai jos **nu depinde** de răspunsurile certSIGN și poate fi
proiectată/aprobată acum. E construită ca **adaptor**: dacă mâine se schimbă
furnizorul (sau se adaugă un al doilea), se schimbă un singur modul.

```
┌──────────────────────────────────────────────────────────────┐
│  Meetings.ro backend                                          │
│                                                               │
│  1. Generator document contractual                            │
│     → PDF (reutilizează pipeline-ul existent fpdf2)          │
│     ↓                                                         │
│  2. signing_service.py   ← ADAPTOR (interfață abstractă)     │
│     ├── prepare_document()   : PDF → hash de semnat          │
│     ├── verify_signer()      : confirmă identitatea          │
│     ├── request_signature()  : apel către furnizor           │
│     └── embed_signature()    : semnătură → PDF final         │
│     ↓                                                         │
│  3. certsign_provider.py ← IMPLEMENTARE CSC (după docs)      │
│     OAuth → /info → /credentials/* → /signatures/signHash    │
│     ↓                                                         │
│  4. Stocare + audit                                          │
│     signed_documents (colecție nouă) + audit_log             │
└──────────────────────────────────────────────────────────────┘
```

### Colecție nouă propusă: `signed_documents`

| Câmp | Rol |
|---|---|
| `document_id`, `tenant_id`, `document_type` | identificare |
| `pdf_hash` (SHA-256) | integritate — dovada că s-a semnat exact acest document |
| `signer_user_id`, `signer_name`, `signer_cnp_or_id` | cine a semnat 🟢 |
| `identity_verified_at`, `identity_method` | **cerința ta: identitate confirmată înainte de semnare** |
| `status` | `draft` → `pending_identity` → `pending_signature` → `signed` / `failed` |
| `provider`, `provider_transaction_id` | trasabilitate la furnizor |
| `signed_at`, `signature_format`, `timestamp_authority` | dovadă juridică |
| `signed_pdf_location` | unde e documentul final |

### Confirmarea identității înainte de semnare — 🟢 DECIZIE INTERNĂ

Cerință explicită din brief. Propunere, în ordinea forței juridice:

1. **Nivel minim** (implementabil imediat): re-autentificare cu parola + email
   verificat + rol `admin` în organizație + jurnalizare în `audit_log`.
2. **Nivel recomandat**: cele de mai sus + confirmare pe email cu link unic
   valabil 15 minute.
3. **Nivel maxim**: identitatea e garantată chiar de certificatul calificat al
   semnatarului (certSIGN a făcut deja verificarea la emitere) + SAD prin SMS.

> Observație onestă: la **nivelul 3, verificarea noastră devine în mare parte
> redundantă** — certificatul calificat *este* dovada de identitate, emisă de un
> QTSP care a făcut verificarea față-în-față. Nivelurile 1–2 rămân utile ca
> **jurnal intern** („cine a apăsat butonul în platformă"), nu ca dovadă
> juridică de identitate.

---

## 4. Etapele de implementare (cu status)

| Etapă | Conținut | Status | Depinde de |
|---|---|---|---|
| **E0** | Plan (acest document) | 🟡 **așteaptă aprobare** | tine |
| **E1** | Obținere documentație + acces test certSIGN | ⬜ neînceput | 🔴 **acțiune umană** |
| **E2** | Generator PDF contractual + hash + colecție `signed_documents` | ⬜ neînceput | E0 aprobat. **Nu depinde de certSIGN** — se poate face în paralel cu E1 |
| **E3** | Flux de confirmare identitate + `audit_log` | ⬜ neînceput | E2 |
| **E4** | Adaptor `signing_service` + implementare certSIGN | ⬜ neînceput | **E1** (blocant) |
| **E5** | Integrare PAdES + validare semnătură | ⬜ neînceput | E1 (răspuns la necunoscuta #7) |
| **E6** | UI: ecran de semnare + status + descărcare | ⬜ neînceput | E4 |
| **E7** | Testare pe mediu de test + validare externă a semnăturii | ⬜ neînceput | E4, E5 |

**Observația utilă:** **E2 și E3 nu depind deloc de certSIGN.** Dacă aprobi
planul, pot începe imediat cu ele, iar când sosește documentația, adaptorul se
conectează la o infrastructură deja gata. Nu pierdem timpul de așteptare.

---

## 5. Riscuri identificate

| Risc | Probabilitate | Impact | Atenuare |
|---|---|---|---|
| certSIGN nu oferă acces API firmelor mici | Medie | 🔴 Blochează total | De întrebat **din primul email**. Alternative în UE: alți membri CSC |
| Doar `signHash`, fără `signDoc` | Medie | 🟠 +3-5 zile efort | Bibliotecă PAdES (ex. pyHanko) |
| Cost per semnătură prea mare pentru marja actuală | Medie | 🟠 Afectează prețul | Cost de aflat la E1; se repercutează în tier-ul instituțional |
| Fiecare semnatar are nevoie de certificat propriu | **Ridicată** | 🟠 Frecare la vânzare | De clarificat cine cumpără; mulți funcționari au deja token de semnătură |
| Am construit adaptorul pe presupuneri greșite | Scăzută | 🔴 Rescriere | **Exact de asta acest document nu conține cod** |

---

## 6. Ce cer de la tine ca să continui

1. **Aprobarea planului** (sau corecții).
2. **Contactarea certSIGN** pentru punctele 🔴 de la secțiunea 2 — singurul
   blocaj real.
3. **Decizie**: pornesc E2+E3 (independente de certSIGN) în paralel cu
   așteptarea răspunsului? **Recomandarea mea: da.**
4. Confirmare pe **nivelul de verificare a identității** (1, 2 sau 3 din
   secțiunea 3).

**Nu voi angaja niciun cost și nu voi crea niciun cont fără aprobarea ta
separată**, conform constrângerii din brief.

---

## Surse

- [certSIGN — membru Cloud Signature Consortium](https://cloudsignatureconsortium.org/member/certsign/)
- [certSIGN: Remote qualified electronic signature integrated into Adobe Acrobat Sign](https://cloudsignatureconsortium.org/certsign-remote-qualified-electronic-signature-service-integrated-into-adobe-acrobat-sign/)
- [certSIGN — Remote electronic signature](https://www.certsign.ro/en/products/eidas-trust-services/remote-electronic-signature/)
- [certSIGN — proiectul CISRES (implementare standard CSC)](https://www.certsign.ro/en/cisres-interoperable-system-based-on-certified-components-for-remote-electronic-signature-creation-services/)
- [Cloud Signature Consortium — Protocols and API specifications](https://cloudsignatureconsortium.org/resources/)
- [SSL.com — Remote Document Signing with eSigner CSC API](https://www.ssl.com/guide/remote-document-signing-with-esigner-csc-api/)
- [SSL.com — Integration Guide to Testing Remote Signing with CSC API](https://www.ssl.com/guide/integration-guide-testing-remote-signing-with-esigner-csc-api/)
- [FintechOS — CertSign Integration for electronic signature](https://docs.fintechos.com/Platform/21.1.1/AdminGuide/Content/DEVOPS/CertSign%20Integration%20for%20electronic%20signature.htm)
- [Implementare open-source CSC (referință)](https://github.com/simionrobert/cloud-signature-consortium)
