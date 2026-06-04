#!/usr/bin/env python3
"""
WhatsApp message templates for primărie/GAL outreach.
Messages: initial contact + follow-up after 5 days.
"""
import csv
import os

# ── Messages ─────────────────────────────────────────────

MESAJ_INITIAL = """Bună ziua! Sunt Vlad, fondatorul Meetings.ro.

Am creat o aplicație care automatizează procesele-verbale conform OUG 54/2019 — înregistrezi audio și primești documentul gata de semnare.

E disponibilă pe Google Play: https://play.google.com/store/apps/details?id=ro.meetingsapp.meetings

Dacă aveți 15 minute, vă arăt cum funcționează. Rămân la dispoziție."""

MESAJ_FOLLOW_UP = """Bună ziua! Revin cu un mesaj scurt legat de Meetings.ro — aplicația care generează automat procese-verbale conform OUG 54/2019.

Știu că sunteți ocupați, dar dacă aveți 10 minute săptămâna asta, vă arăt un demo rapid.

📲 Google Play: https://play.google.com/store/apps/details?id=ro.meetingsapp.meetings

O zi bună!"""

# ── Contact loader ───────────────────────────────────────

def load_contacts(csv_path="whatsapp_contacts.csv"):
    """Load WhatsApp contacts from CSV."""
    contacts = []
    if not os.path.exists(csv_path):
        csv_path = os.path.join(os.path.dirname(__file__), csv_path)
    if os.path.exists(csv_path):
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                contacts.append({
                    'nume': row.get('Nume', '').strip(),
                    'telefon': row.get('Telefon', '').strip(),
                    'note': row.get('Note', '').strip()
                })
    return contacts


def print_messages():
    """Print all messages for review."""
    print("=" * 50)
    print("MESAJ INIȚIAL:")
    print("=" * 50)
    print(MESAJ_INITIAL)
    print()
    print("=" * 50)
    print("MESAJ FOLLOW-UP (după 5 zile):")
    print("=" * 50)
    print(MESAJ_FOLLOW_UP)


if __name__ == '__main__':
    print_messages()
    print()
    contacts = load_contacts()
    print(f"Contacte încărcate: {len(contacts)}")
