# Configurare email tranzacțional (resetare parolă, verificare, invitații)

Aplicația trimite emailuri **întâi prin SMTP** (mailbox-ul privateemail
`contact@meetings-ro.app`) și, dacă SMTP nu e setat sau pică, cade automat
pe **Resend** ca rezervă.

Motivul pentru care clienții nu primeau emailul de resetare: nu era setat
**niciun** transport de email în mediul de producție (nici SMTP, nici
`RESEND_API_KEY`), așa că `forgot-password` genera codul dar nu îl trimitea
nicăieri.

## Variabile de mediu (setate în Render → Environment)

| Variabilă         | Valoare                                   | Secret? |
|-------------------|-------------------------------------------|---------|
| `SMTP_HOST`       | `mail.privateemail.com`                    | nu      |
| `SMTP_PORT`       | `465` (SSL) — sau `587` pentru STARTTLS    | nu      |
| `SMTP_USER`       | `contact@meetings-ro.app`                  | **da**  |
| `SMTP_PASSWORD`   | *(parola mailbox-ului privateemail)*       | **da**  |
| `SMTP_FROM_NAME`  | `Meetings.ro`                              | nu      |
| `SMTP_FROM_EMAIL` | `contact@meetings-ro.app`                  | nu      |
| `RESEND_API_KEY`  | *(opțional — rezervă dacă SMTP pică)*      | **da**  |

> **Niciodată** nu pune `SMTP_PASSWORD` în cod sau în git. Se setează doar în
> Render dashboard (sau în fișierul local `.env`, care e în `.gitignore`).
> `render.yaml` declară aceste chei cu `sync: false`, ca să le introduci manual
> ca secrete în dashboard.

## Pași în Render

1. Render → serviciul `meetings-ro-api` → **Environment**.
2. Adaugă cheile de mai sus. Pentru `SMTP_USER` și `SMTP_PASSWORD` folosește
   credențialele mailbox-ului privateemail.
3. **Save, rebuild & deploy**.
4. La pornire, în loguri trebuie să apară:
   `[Email] SMTP ENABLED — contact@meetings-ro.app via mail.privateemail.com:465`

## Test local

```bash
cd backend
export SMTP_HOST=mail.privateemail.com
export SMTP_PORT=465
export SMTP_USER=contact@meetings-ro.app
export SMTP_PASSWORD='...'         # parola mailbox-ului
export SMTP_FROM_EMAIL=contact@meetings-ro.app

python - <<'PY'
from server import send_transactional_email
ok = send_transactional_email(
    "adresa-ta@exemplu.ro",
    "Test SMTP Meetings.ro",
    "<p>Funcționează ✅</p>",
)
print("Trimis:", ok)
PY
```

Dacă primești emailul de test, resetarea parolei va funcționa pentru clienți.

## Note privateemail (Namecheap Private Email)

- SMTP host: `mail.privateemail.com`
- Port `465` cu SSL/TLS (recomandat) sau `587` cu STARTTLS.
- Utilizator = adresa completă (`contact@meetings-ro.app`), nu doar `contact`.
- Asigură-te că mailbox-ul este activ și că ai parola corectă; privateemail
  poate cere și activarea accesului SMTP din panoul de control.
