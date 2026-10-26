// Collects the numbers of every enabled source. Runs in a worker thread so the editor never freezes,
// even the first time, when all the chat files are read (afterwards only the new lines are read).
// Everything stays on this computer: no network, no API key, no message text.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { leggiClaude } = require('./claude');
const { leggiCodex } = require('./codex');

const casa = p => (p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p);

function caricaCache(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } }
function salvaCache(file, dati) {
  try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file + '.tmp', JSON.stringify(dati)); fs.renameSync(file + '.tmp', file); } catch (e) { /* next time */ }
}

// optional "API credits" section: a JSON file the person writes by hand (credits, expiry dates, prices).
// No key is ever read or needed; without the file the section does not appear.
function leggiApi(file) {
  const out = { presente: false, crediti: [], speso: 0, lavori: 0, prezzi: {}, ricarica: 'https://console.anthropic.com/settings/billing', ricaricaOpenai: 'https://platform.openai.com/settings/organization/billing', ultimi: [] };
  try {
    const c = JSON.parse(fs.readFileSync(file, 'utf8'));
    out.presente = true;
    if (Array.isArray(c.crediti)) out.crediti = c.crediti.map(x => ({ dollari: Number(x.dollari) || 0, arrivo: str(x.arrivo), scadenza: str(x.scadenza), nota: str(x.nota), fonte: x.fonte === 'openai' ? 'openai' : 'claude' }));
    if (c.prezzi_per_milione && typeof c.prezzi_per_milione === 'object') {
      for (const [m, p] of Object.entries(c.prezzi_per_milione)) out.prezzi[m] = { entrata: Number(p.entrata) || 0, uscita: Number(p.uscita) || 0, cache_scritta: Number(p.cache_scritta) || 0, cache_letta: Number(p.cache_letta) || 0 };
    }
    if (/^https:\/\//.test(c.ricarica || '')) out.ricarica = c.ricarica;
    if (/^https:\/\//.test(c.ricarica_openai || '')) out.ricaricaOpenai = c.ricarica_openai;
  } catch (e) { return out; }
  try {
    const lavori = [];
    for (const r of fs.readFileSync(path.join(path.dirname(file), 'uso.jsonl'), 'utf8').split('\n')) {
      if (!r.trim()) continue;
      try { const j = JSON.parse(r); lavori.push({ data: str(j.data), titolo: str(j.titolo).slice(0, 60), modello: str(j.modello), costo: Number(j.costo) || 0 }); } catch (e) { /* next line */ }
    }
    out.lavori = lavori.length; out.speso = lavori.reduce((s, l) => s + l.costo, 0); out.ultimi = lavori.slice(-5).reverse();
  } catch (e) { /* no spending log */ }
  return out;
}
const str = v => (typeof v === 'string' ? v : '');

function raccogli(o) {
  const risultato = { aggiornato: Date.now(), sessioni: [], limiti: [], avvisi: [], fonti: {}, api: null };
  if (o.claude) {
    const radice = casa(o.cartellaClaude) || path.join(os.homedir(), '.claude', 'projects');
    const cf = path.join(o.cache, 'claude.json');
    const r = leggiClaude(radice, caricaCache(cf));
    salvaCache(cf, r.cache);
    risultato.fonti.claude = { cartella: radice, trovata: fs.existsSync(radice), sessioni: r.sessioni.length };
    risultato.sessioni.push(...r.sessioni);
  }
  if (o.codex) {
    const radice = casa(o.cartellaCodex) || path.join(os.homedir(), '.codex');
    const cf = path.join(o.cache, 'codex.json');
    const r = leggiCodex(radice, caricaCache(cf));
    salvaCache(cf, r.cache);
    risultato.fonti.codex = { cartella: radice, trovata: fs.existsSync(path.join(radice, 'sessions')), sessioni: r.sessioni.length };
    risultato.sessioni.push(...r.sessioni);
    risultato.limiti.push(...r.limiti);
    risultato.avvisi.push(...r.avvisi);
  }
  if (o.api) risultato.api = leggiApi(casa(o.fileApi) || path.join(os.homedir(), '.claude', 'utilizzo-api', 'config.json'));
  risultato.sessioni.sort((a, b) => b.ultimo - a.ultimo);
  return risultato;
}

module.exports = { raccogli, leggiApi };

// as a worker thread: receive the options, send back the result
try {
  const { parentPort, workerData } = require('worker_threads');
  if (parentPort && workerData && workerData.pannelloUtilizzo) {
    try { parentPort.postMessage({ ok: true, dati: raccogli(workerData.opzioni) }); }
    catch (e) { parentPort.postMessage({ ok: false, errore: String((e && e.message) || e).slice(0, 300) }); }
  }
} catch (e) { /* not in a worker */ }
