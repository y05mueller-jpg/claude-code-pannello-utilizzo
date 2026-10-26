// Collects the numbers of every enabled source. Runs in a worker thread so the editor never freezes,
// even the first time, when all the chat files are read (afterwards only the new lines are read).
// Everything stays on this computer: no network, no API key, no message text.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { FONTI } = require('./fonti');

const casa = p => (p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p);

function caricaCache(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } }
function salvaCache(file, dati) {
  try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file + '.tmp', JSON.stringify(dati)); fs.renameSync(file + '.tmp', file); } catch (e) { /* next time */ }
}

// optional "API credits" section: a JSON file the person writes by hand (credits, expiry dates, prices).
// No key is ever read or needed; without the file the section does not appear.
function leggiApi(file) {
  const out = { presente: false, crediti: [], speso: 0, lavori: 0, prezzi: {}, ultimi: [] };
  try {
    const c = JSON.parse(fs.readFileSync(file, 'utf8'));
    out.presente = true;
    if (Array.isArray(c.crediti)) out.crediti = c.crediti.map(x => ({
      dollari: Number(x.dollari) || 0, arrivo: str(x.arrivo), scadenza: str(x.scadenza), nota: str(x.nota),
      // which provider the credit belongs to; "fonte": "openai" of the first version still works
      fornitore: str(x.fornitore) || (x.fonte === 'openai' ? 'openai' : 'anthropic'),
    }));
    if (c.prezzi_per_milione && typeof c.prezzi_per_milione === 'object') {
      for (const [m, p] of Object.entries(c.prezzi_per_milione)) out.prezzi[m] = { entrata: Number(p.entrata) || 0, uscita: Number(p.uscita) || 0, cache_scritta: Number(p.cache_scritta) || 0, cache_letta: Number(p.cache_letta) || 0 };
    }
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

// o = { attive: { id: bool }, cartelle: { id: path }, cache, api, fileApi, archivi: [editor globalStorage dirs], progetti: [workspace dirs] }
function raccogli(o) {
  const risultato = { aggiornato: Date.now(), sessioni: [], limiti: [], avvisi: [], fonti: {}, api: null, listino: require('./prezzi').LISTINO };
  for (const f of FONTI) {
    if (!o.attive || !o.attive[f.id]) continue;
    const radice = casa((o.cartelle || {})[f.id]) || (f.cartella ? f.cartella() : '');
    const info = { nome: f.nome, breve: f.breve, colore: f.colore, fornitore: f.fornitore, verificato: f.verificato, cartella: radice || '', sessioni: 0, errore: '' };
    risultato.fonti[f.id] = info;
    try {
      const cf = path.join(o.cache, `${f.id}.json`);
      const r = require(f.modulo)[f.funzione](radice, caricaCache(cf), { archivi: o.archivi || [], progetti: o.progetti || [] });
      salvaCache(cf, r.cache);
      for (const s of r.sessioni) s.fonte = f.id;
      info.sessioni = r.sessioni.length;
      risultato.sessioni.push(...r.sessioni);
      for (const l of r.limiti || []) { l.fonte = f.id; risultato.limiti.push(l); }
      for (const a of r.avvisi || []) { a.fonte = f.id; risultato.avvisi.push(a); }
    } catch (e) {
      // one broken source never stops the others
      info.errore = String((e && e.message) || e).slice(0, 200);
    }
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
