#!/usr/bin/env python3
"""
BATCH 1 - Primele 20 GAL-uri HIGH priority
Template-uri: A (compliance), B (time), C (social proof)
Distribuție: 7 Template A, 7 Template B, 6 Template C (pentru A/B testing)

DESTINATARI (20 GAL-uri):
1.  GAL Delta Dunării (Tulcea)           - Template A
2.  GAL Dobrogea de Sud (Constanța)      - Template B
3.  GAL Dunărea Veche (Brăila)           - Template C
4.  GAL Muntenia de Nord-Est (Buzău)     - Template A
5.  GAL Văile Prahovei (Prahova)         - Template B
6.  GAL Teleorman (Alexandria)           - Template C
7.  GAL Giurgiu (Giurgiu)                - Template A
8.  GAL Ilfov Nord (Voluntari)           - Template B
9.  GAL Ținutul Zimbrului (Vrancea)      - Template C
10. GAL Podisul de Nord (Bacău)          - Template A
11. GAL Moldova Prutului de Jos (Vaslui) - Template B
12. GAL Colinele Tutovei (Iași)          - Template C
13. GAL Bucovina de Nord (Suceava)       - Template A
14. GAL Țara Dornelor (Vatra Dornei)     - Template B
15. GAL Moldova de Mijloc (Neamț)        - Template C
16. GAL Maramureș (Baia Mare)            - Template A
17. GAL Sălaj (Zalău)                    - Template B
18. GAL Bistrița-Năsăud (Bistrița)       - Template C
19. GAL Cluj (Cluj-Napoca)               - Template A
20. GAL Mureș (Târgu Mureș)              - Template B

TOTAL: 20 emailuri (7A + 7B + 6C)
TIMING: Toate trimise în 1 minut (pentru test)
"""

import sys
sys.path.insert(0, '/home/kashmirluchiano/Meetings-App/email-automation')

from send_emails import (
    load_contacts, 
    send_email_batch,
    SMTP_CONFIG
)
from datetime import datetime

def run_batch_1():
    print("=" * 70)
    print(f"📧 BATCH 1 - GAL-uri HIGH PRIORITY")
    print(f"   Data: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"   Destinatar: 20 GAL-uri")
    print(f"   Sender: {SMTP_CONFIG['from_name']} <{SMTP_CONFIG['email']}>")
    print("=" * 70)
    print()
    
    # Load contacts
    contacts = load_contacts('data/gal_database.csv')
    
    # Select first 20 (HIGH priority)
    batch_1_contacts = contacts[:20]
    
    print(f"✅ Loaded {len(batch_1_contacts)} contacts from database")
    print()
    
    # Send batch
    results = send_email_batch(
        contacts=batch_1_contacts,
        sender_email=SMTP_CONFIG['email'],
        sender_password=SMTP_CONFIG['password'],
        batch_size=20,  # toate într-un batch
        delay_between_emails=2,  # 2 secunde între emailuri
        dry_run=False
    )
    
    # Results summary
    print()
    print("=" * 70)
    print("REZUMAT BATCH 1:")
    print(f"   Total trimise: {results['sent']}/{results['total']}")
    print(f"   Succes: {results['success']}")
    print(f"   Eșuate: {results['failed']}")
    print("=" * 70)
    
    # Save report
    report_file = f"reports/batch1_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"
    with open(report_file, 'w') as f:
        f.write("email,gal_name,template,status,error,timestamp\n")
        for result in results['details']:
            f.write(f"{result['email']},{result['gal_name']},{result['template']},"
                   f"{result['status']},{result.get('error', '')},{result['timestamp']}\n")
    
    print(f"\n📊 Report salvat: {report_file}")
    
    return results

if __name__ == '__main__':
    run_batch_1()
