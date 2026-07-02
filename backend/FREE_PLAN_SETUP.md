# Rulare pe Render FREE — fără pierdere de date

## De ce e nevoie de asta

Planul **free** de la Render **nu are disc persistent** și **adoarme serviciul
după 15 minute de inactivitate**. Până acum, MongoDB rula *în* container cu
datele pe discul persistent (planul plătit). Pe free, asta înseamnă:

> **Fiecare restart / spin-down / deploy șterge complet baza de date** —
> utilizatori, ședințe, transcripte, tot.

Soluția (tot gratuită): baza de date se mută pe **MongoDB Atlas M0** —
cluster gestionat, gratuit pe viață, 512MB stocare (suficient pentru mii de
PV-uri text), cu datele în siguranță indiferent ce face Render.

Codul detectează automat modul: dacă `MONGO_URL` pointează la `localhost`,
pornește mongod local (comportamentul vechi); dacă e un URI extern (Atlas),
nu mai pornește mongod deloc și economisește și RAM.

## Pasul 1 — Creează clusterul Atlas M0 (10 minute, gratuit)

1. Cont pe https://www.mongodb.com/cloud/atlas/register
2. **Create cluster** → alege **M0 (Free)** → provider **AWS**, regiune
   **Frankfurt (eu-central-1)** (aceeași cu Render → latență minimă).
3. **Database Access** → Add New Database User → username `meetingsro`,
   parolă generată (salveaz-o!), rol **Read and write to any database**.
4. **Network Access** → Add IP Address → **Allow access from anywhere**
   (`0.0.0.0/0`) — necesar pentru că Render free nu are IP-uri statice.
   (Securitatea rămâne în user+parolă+TLS, obligatorii pe Atlas.)
5. **Connect → Drivers** → copiază connection string-ul, de forma:
   ```
   mongodb+srv://meetingsro:<PAROLA>@cluster0.xxxxx.mongodb.net/gal_meetings?retryWrites=true&w=majority
   ```
   Înlocuiește `<PAROLA>` și asigură-te că path-ul e `/gal_meetings`.

## Pasul 2 — Setează MONGO_URL în Render

Render → `meetings-ro-api` → **Environment**:

| Variabilă   | Valoare                                    |
|-------------|--------------------------------------------|
| `MONGO_URL` | URI-ul Atlas de mai sus (secret!)          |

Save → deploy. În loguri trebuie să apară:
```
MongoDB:  external (MONGO_URL from env)
```
(Fără `MONGO_URL` setat, aplicația revine la mongod local = date efemere pe free.)

## Pasul 3 (recomandat) — Backup zilnic pe S3

Atlas M0 **nu are backup automat**, așa că aplicația include un job de backup
zilnic (`scripts/mongo_backup.py`) care face `mongodump` și urcă arhiva în S3.
Se activează singur când setezi în Render:

| Variabilă               | Valoare                              |
|-------------------------|--------------------------------------|
| `AWS_ACCESS_KEY_ID`     | IAM user cu acces doar la bucket     |
| `AWS_SECRET_ACCESS_KEY` | (secret)                             |
| `S3_BACKUP_BUCKET`      | ex. `meetings-ro-backups`            |

Opționale: `BACKUP_INTERVAL_HOURS` (default 24), `BACKUP_RETENTION_DAYS`
(default 30), `AWS_REGION` (default `eu-central-1`).

**Restaurare:** vezi instrucțiunile din docstring-ul `scripts/mongo_backup.py`
(`mongorestore --uri ... --archive=... --gzip --drop`).

## Pasul 4 (recomandat) — Keep-alive contra spin-down

Free plan adoarme serviciul după 15 min fără trafic → primul request de după
durează ~50s (rău pentru demo-uri și pentru clienți). Fix gratuit: un ping
extern la fiecare 10 minute.

- https://uptimerobot.com (gratuit) → monitor HTTP(s) →
  `https://meetings-ro-api.onrender.com/api/health` → interval 10 min.
- Bonus: primești și alerte pe email când API-ul pică. Două probleme
  rezolvate cu un singur tool.

Limita free Render e 750 ore instanță/lună — o instanță ținută trează nonstop
consumă ~730h, deci se încadrează.

## Limitări care rămân pe free (de știut, nu de rezolvat azi)

- **Fișierele audio sunt efemere** (se pierd la restart). Transcriptul și
  PV-ul sunt în Atlas (persistente), dar redarea audio a ședințelor vechi nu
  va funcționa după un restart. Fix-ul corect (S3 pentru audio) e planificat.
- **512MB RAM** — configurația pornește automat mai puțini workeri uvicorn
  (din `WEB_CONCURRENCY`/`UVICORN_WORKERS`, default 2). Procesările AI grele
  pot fi mai lente decât pe planul plătit.
- **Cold start ~50s** dacă nu setezi keep-alive-ul de la Pasul 4.
