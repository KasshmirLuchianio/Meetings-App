#!/usr/bin/env node
/**
 * WhatsApp sender via Baileys — NO Meta API, NO Facebook Business.
 * Se conectează direct la WhatsApp Web.
 *
 * PRIMA RULARE: primești un cod de 6 cifre. Intră pe WhatsApp pe telefonul
 * cu +407****5965 → Setări → Dispozitive conectate → Asociază un dispozitiv →
 * introdu codul. Sesiunea se salvează, data viitoare merge direct.
 *
 * Usage:
 *   node whatsapp_baileys_sender.js test +40793693875  — trimite test la un singur numar
 *   node whatsapp_baileys_sender.js dry-run              — vezi contactele, fara trimitere
 *   node whatsapp_baileys_sender.js live                 — trimite la toate contactele
 */

const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, delay } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────
const AUTH_DIR = path.join(__dirname, 'auth_session');
const CSV_PATH = path.join(__dirname, '..', 'email-automation', 'whatsapp_contacts.csv');
const DELAY_BETWEEN = 3000;
const DRY_RUN = !process.argv.includes('live');

// ── Mesaje ─────────────────────────────────────────────────
const MESAJ = `Bună ziua! Sunt Vlad, fondatorul Meetings.ro.

Am creat o aplicație care automatizează procesele-verbale conform OUG 54/2019 — înregistrezi audio și primești documentul gata de semnare.

📲 Google Play: https://play.google.com/store/apps/details?id=ro.meetingsapp.meetings

Dacă aveți 15 minute, vă arăt cum funcționează. Rămân la dispoziție.`;

// ── Contact loader ─────────────────────────────────────────
function loadContacts() {
  const data = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = data.trim().split('\n');
  const contacts = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',');
    let phone = (vals[1] || '').trim();
    const name = (vals[0] || '').trim();
    if (!phone) continue;
    phone = phone.replace(/[\s\-]/g, '');
    if (!phone.startsWith('+')) {
      if (phone.startsWith('00')) phone = '+' + phone.slice(2);
      else if (phone.startsWith('0')) phone = '+4' + phone;
    }
    const waId = phone.replace(/\+/g, '') + '@s.whatsapp.net';
    contacts.push({ name, phone, waId });
  }
  return contacts;
}

// ── Main ───────────────────────────────────────────────────
async function main() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    markOnlineOnConnect: false,
  });

  // Connection handler
  const connectionPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout conectare — 60s')), 60000);
    sock.ev.on('connection.update', ({ connection, qr, lastDisconnect }) => {
      if (connection === 'open') {
        clearTimeout(timeout);
        console.log('✅ Conectat la WhatsApp!');
        resolve(true);
      }
      if (connection === 'close') {
        const err = lastDisconnect?.error;
        if (err?.output?.statusCode === 401) {
          // Session expired — delete auth and retry
          console.log('⚠️  Sesiune expirată. Șterg auth și reîncerc...');
          fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          reject(new Error('Sesiune expirata — ruleaza din nou'));
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);
  });

  // If not registered, request pairing code
  if (!sock.authState.creds.registered) {
    const phoneNumber = '40735655965'; // fără +
    console.log('\n🔑 Se solicită codul de asociere...');
    try {
      const code = await sock.requestPairingCode(phoneNumber);
      console.log(`\n📱 CODUL TĂU: ${code}`);
      console.log('  1. Deschide WhatsApp pe telefonul cu +407****5965');
      console.log('  2. Mergi la Setări → Dispozitive conectate → Asociază un dispozitiv');
      console.log('  3. Introdu codul de mai sus');
      console.log('\n   ⏳ Aștept conectarea...\n');
    } catch (e) {
      console.log('❌ Eroare la pairing:', e.message);
      process.exit(1);
    }
  } else {
    console.log('🔑 Sesiune salvată — reconectare automată...');
  }

  await connectionPromise;

  // Done connecting
  const contacts = loadContacts();
  console.log(`\n${'='.repeat(50)}`);
  console.log(`TRIMITERE WHATSAPP — ${DRY_RUN ? 'DRY RUN (simulare)' : 'LIVE'}`);
  console.log(`Contacte: ${contacts.length}`);
  console.log(`${'='.repeat(50)}\n`);

  if (DRY_RUN) {
    contacts.forEach((c, i) => {
      console.log(`[${i + 1}] ${c.name} — ${c.phone}`);
    });
    console.log(`\n💡 Pentru trimitere reală: node whatsapp_baileys_sender.js live`);
    process.exit(0);
  }

  let sent = 0, failed = 0;

  // ── TEST mode: send to a single number ─────────────────
  if (process.argv.includes('test')) {
    const testPhone = process.argv[process.argv.indexOf('test') + 1] || null;
    if (!testPhone) {
      console.log('❌ Folosire: node whatsapp_baileys_sender.js test +40793693875');
      process.exit(1);
    }
    let phone = testPhone.replace(/[\s\-]/g, '');
    if (!phone.startsWith('+')) {
      if (phone.startsWith('00')) phone = '+' + phone.slice(2);
      else if (phone.startsWith('0')) phone = '+4' + phone;
    }
    const waId = phone.replace(/\+/g, '') + '@s.whatsapp.net';
    console.log(`\n📱 TEST: trimit mesaj la ${phone}...\n`);

    if (DRY_RUN && !process.argv.includes('test')) {
      // dry-run without test: show contacts
    }

    try {
      await sock.sendMessage(waId, { text: MESAJ });
      console.log(`✅ Mesaj trimis cu succes la ${phone}!\n`);
      sent++;
    } catch (e) {
      console.log(`❌ Eșuat: ${e.message?.slice(0, 100)}\n`);
      failed++;
    }
    process.exit(0);
  }

  // ── BATCH mode: send to all contacts ───────────────────
  const errors = [];

  for (let i = 0; i < contacts.length; i++) {
    const c = contacts[i];
    process.stdout.write(`[${i + 1}/${contacts.length}] ${c.name} ... `);

    try {
      await sock.sendMessage(c.waId, { text: MESAJ });
      console.log('✓');
      sent++;
    } catch (e) {
      console.log('✗');
      failed++;
      errors.push({ name: c.name, error: e.message?.slice(0, 80) });
    }

    if (i < contacts.length - 1) await delay(DELAY_BETWEEN);
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`REZULTAT: ${sent} trimise ✓ | ${failed} eșuate ✗`);
  if (errors.length > 0) {
    console.log(`\nErori:`);
    errors.forEach(e => console.log(`  - ${e.name}: ${e.error}`));
  }
  console.log(`${'='.repeat(50)}`);

  process.exit(0);
}

main().catch(e => {
  console.error('\n❌ Eroare:', e.message);
  process.exit(1);
});
