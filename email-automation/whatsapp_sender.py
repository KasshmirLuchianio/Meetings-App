#!/usr/bin/env python3
"""
WhatsApp Cloud API sender pentru Meetings.ro
Trimite mesaje catre contacte prin Meta WhatsApp Business API.

Setup necesar (o singura data):
  1. Cont Facebook Business: https://business.facebook.com
  2. Creeaza WhatsApp Business App in Business Settings
  3. Adauga numarul +40 735 655 965 (trebuie sa poti primi SMS/call)
  4. Genereaza token permanent din System Users
  5. Pune token-ul si WABA ID in .env sau variabile de env

Configurare:
  export WHATSAPP_TOKEN="EAAx..."
  export WHATSAPP_WABA_ID="123456789"
  export WHATSAPP_PHONE_ID="987654321"
"""

import csv
import os
import sys
import json
import time
import urllib.request
import urllib.error

# ── Config ────────────────────────────────────────────────

WABA_ID = os.environ.get("WHATSAPP_WABA_ID", "")
PHONE_ID = os.environ.get("WHATSAPP_PHONE_ID", "")
TOKEN = os.environ.get("WHATSAPP_TOKEN", "")
API_VERSION = "v22.0"
DRY_RUN = os.environ.get("WHATSAPP_DRY_RUN", "1") == "1"  # Default: doar simuleaza
DELAY_BETWEEN = 3  # secunde intre mesaje (WhatsApp rate limit)

# ── Mesaje ─────────────────────────────────────────────────

MESAJ_INITIAL = """Bună ziua! Sunt Vlad, fondatorul Meetings.ro.

Am creat o aplicație care automatizează procesele-verbale conform OUG 54/2019 — înregistrezi audio și primești documentul gata de semnare.

📲 Google Play: https://play.google.com/store/apps/details?id=ro.meetingsapp.meetings

Dacă aveți 15 minute, vă arăt cum funcționează. Rămân la dispoziție."""

MESAJ_FOLLOW_UP = """Bună ziua! Revin cu un mesaj scurt legat de Meetings.ro — aplicația care generează automat procese-verbale conform OUG 54/2019.

Știu că sunteți ocupați, dar dacă aveți 10 minute săptămâna asta, vă arăt un demo rapid.

📲 Google Play: https://play.google.com/store/apps/details?id=ro.meetingsapp.meetings

O zi bună!"""

# ── Contact loader ─────────────────────────────────────────

def load_contacts(csv_path="whatsapp_contacts.csv"):
    contacts = []
    script_dir = os.path.dirname(os.path.abspath(__file__))
    full_path = os.path.join(script_dir, csv_path)
    if not os.path.exists(full_path):
        print(f"[ERROR] Fișierul {full_path} nu există")
        return contacts
    with open(full_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            phone = row.get('Telefon', '').strip()
            name = row.get('Nume', '').strip()
            if not phone:
                continue
            # Normalize: remove spaces, ensure international format
            phone = phone.replace(' ', '').replace('-', '')
            if not phone.startswith('+'):
                if phone.startswith('00'):
                    phone = '+' + phone[2:]
                elif phone.startswith('0'):
                    phone = '+4' + phone  # Romania: 07xx → +407xx
            contacts.append({'nume': name, 'telefon': phone, 'note': row.get('Note', '').strip()})
    return contacts


def send_whatsapp(to_phone: str, message: str) -> dict:
    """Trimite un mesaj WhatsApp prin Meta Cloud API."""
    if DRY_RUN:
        print(f"  [DRY RUN] → {to_phone}: {message[:60]}...")
        return {"ok": True, "dry_run": True}

    url = f"https://graph.facebook.com/{API_VERSION}/{PHONE_ID}/messages"
    body = json.dumps({
        "messaging_product": "whatsapp",
        "to": to_phone,
        "type": "text",
        "text": {"preview_url": True, "body": message}
    }).encode('utf-8')

    req = urllib.request.Request(url, data=body, headers={
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json"
    })

    try:
        resp = urllib.request.urlopen(req)
        return {"ok": True, "response": json.loads(resp.read())}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        return {"ok": False, "error": f"HTTP {e.code}: {err_body[:300]}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def send_batch(contacts, message_type="initial"):
    """Trimite mesaje la toate contactele."""
    message = MESAJ_INITIAL if message_type == "initial" else MESAJ_FOLLOW_UP
    results = {"trimise": 0, "esuate": 0, "erori": []}

    print(f"\n{'='*50}")
    print(f"TRIMITERE WHATSAPP — {'DRY RUN' if DRY_RUN else 'LIVE'}")
    print(f"Tip: {'INIȚIAL' if message_type == 'initial' else 'FOLLOW-UP'}")
    print(f"Contacte: {len(contacts)}")
    print(f"{'='*50}\n")

    for i, c in enumerate(contacts):
        label = f"[{i+1}/{len(contacts)}] {c['nume']} ({c['telefon']})"
        print(label, end=' ... ')
        sys.stdout.flush()

        result = send_whatsapp(c['telefon'], message)
        if result['ok']:
            print("✓")
            results['trimise'] += 1
        else:
            print(f"✗ {result.get('error', '')[:80]}")
            results['esuate'] += 1
            results['erori'].append({'contact': c, 'error': result.get('error', '')})

        if i < len(contacts) - 1:
            time.sleep(DELAY_BETWEEN)

    return results


def main():
    global DRY_RUN

    if len(sys.argv) > 1:
        cmd = sys.argv[1]
    else:
        cmd = "status"

    if cmd == "live":
        if not TOKEN or not PHONE_ID:
            print("ERROR: Setează WHATSAPP_TOKEN și WHATSAPP_PHONE_ID în environment!")
            print("  export WHATSAPP_TOKEN='EAAx...'")
            print("  export WHATSAPP_PHONE_ID='123456789'")
            sys.exit(1)
        DRY_RUN = False
    elif cmd == "status":
        contacts = load_contacts()
        print(f"📱 WhatsApp Business Status")
        print(f"   Contacte: {len(contacts)}")
        print(f"   Token: {'✓ configurat' if TOKEN else '✗ lipsește'}")
        print(f"   Phone ID: {'✓ configurat' if PHONE_ID else '✗ lipsește'}")
        print(f"   Mod: {'LIVE' if not DRY_RUN else 'DRY RUN (test)'}")
        print(f"\n   Comenzi disponibile:")
        print(f"     python3 whatsapp_sender.py status    — statusul curent")
        print(f"     python3 whatsapp_sender.py dry-run   — simulează trimiterea")
        print(f"     python3 whatsapp_sender.py live      — trimite LIVE")
        return

    contacts = load_contacts()
    if not contacts:
        print("Niciun contact găsit.")
        return

    results = send_batch(contacts, message_type="initial")

    print(f"\n{'='*50}")
    print(f"REZULTAT: {results['trimise']} trimise, {results['esuate']} eșuate")
    if results['erori']:
        print(f"\nErori:")
        for e in results['erori']:
            print(f"  - {e['contact']['nume']}: {e['error'][:100]}")
    print(f"{'='*50}")


if __name__ == '__main__':
    main()
