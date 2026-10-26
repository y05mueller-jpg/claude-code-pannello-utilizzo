// Readers for AI tools that live inside the editor: Cline and Roo Code (in VS Code, Cursor, Windsurf…), plus the Cline CLI / SDK.
// Formats checked against the official source code only (not on real files):
//   Cline legacy  github.com/cline/cline apps/vscode (v4.1.25): <globalStorage>/saoudrizwan.claude-dev/tasks/<id>/ui_messages.json
//                 api_req_started.text = JSON { tokensIn (without cache), tokensOut, cacheWrites, cacheReads, cost, request… }, modelInfo { modelId }
//   Cline SDK     ~/.cline/data/sessions/<id>/<id>.messages.json { messages: [{ role, ts, modelInfo { id }, metrics { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens } }] }
//   Roo Code      github.com/RooCodeInc/Roo-Code (archived 2026-05-15): <globalStorage>/rooveterinaryinc.roo-cline/tasks/<id>/ui_messages.json
//                 same api_req_started, but tokensIn INCLUDES the cache; history_item.json { workspace }; no model id is saved
// These files also contain the text of the chat: it is parsed in memory and dropped, only numbers are kept.
'use strict';
const fs = require('fs'), path = require('path');
const { giorno, aggiungiRichiesta, aggiungiMessaggio } = require('./comune');

const VERSIONE = 1;
const nuovaSessione = (id, progetto) => ({ id, titolo: '', progetto: progetto ? path.basename(String(progetto).replace(/[\\/]+$/, '')) : '', modello: '', messaggi: 0, richieste: 0, token: 0, u: [0, 0, 0, 0], scritti: 0, ultimo: 0, bloccata: false, giorni: {} });
const num = v => Number(v) || 0;
const sottocartelle = d => { try { return fs.readdirSync(d, { withFileTypes: true }).filter(x => x.isDirectory()).map(x => path.join(d, x.name)); } catch (e) { return []; } };

// one task folder of Cline or Roo Code → numbers of that task
function compito(cartella, roo, progetto) {
  const s = nuovaSessione(path.basename(cartella), progetto);
  let messaggi; try { messaggi = JSON.parse(fs.readFileSync(path.join(cartella, 'ui_messages.json'), 'utf8')); } catch (e) { return null; }
  if (!Array.isArray(messaggi)) return null;
  for (const m of messaggi) {
    if (!m || m.type !== 'say') continue;
    const ts = num(m.ts), g = ts ? giorno(ts) : null;
    if (ts > s.ultimo) s.ultimo = ts;
    if (m.modelInfo && m.modelInfo.modelId) s.modello = String(m.modelInfo.modelId).slice(0, 40);
    if (m.say === 'api_req_started' && typeof m.text === 'string') {
      let x; try { x = JSON.parse(m.text); } catch (e) { continue; }
      const entrata = num(x.tokensIn), cw = num(x.cacheWrites), cr = num(x.cacheReads);
      if (!entrata && !num(x.tokensOut) && !cw && !cr) continue;
      aggiungiRichiesta(s, g, roo ? Math.max(0, entrata - cw - cr) : entrata, num(x.tokensOut), cw, cr);
    } else if (m.say === 'task' || m.say === 'user_feedback') {
      aggiungiMessaggio(s, g, Math.ceil((typeof m.text === 'string' ? m.text.length : 0) / 4));
    }
  }
  return s;
}

// shared logic: reads only the task folders whose ui_messages.json changed
function leggiCompiti(cartelleTask, cacheIn, roo, progettoDi) {
  const cache = cacheIn && cacheIn.v === VERSIONE ? cacheIn : { v: VERSIONE, task: {} };
  const viste = new Set();
  for (const c of cartelleTask) {
    const f = path.join(c, 'ui_messages.json');
    let st; try { st = fs.statSync(f); } catch (e) { continue; }
    viste.add(c);
    const vecchio = cache.task[c];
    if (vecchio && vecchio.mtime === st.mtimeMs && vecchio.dim === st.size) continue;
    const s = compito(c, roo, progettoDi(c));
    cache.task[c] = { mtime: st.mtimeMs, dim: st.size, s };
  }
  for (const k of Object.keys(cache.task)) if (!viste.has(k)) delete cache.task[k];
  const sessioni = Object.values(cache.task).map(t => t.s).filter(s => s && (s.richieste || s.messaggi));
  return { cache, sessioni };
}

// ---------- Cline ----------
function leggiCline(radice, cacheIn, extra) {
  const cache = cacheIn && cacheIn.v === VERSIONE ? cacheIn : { v: VERSIONE };
  // the extension, in every editor on this computer
  const cartelle = (extra.archivi || []).map(a => path.join(a, 'saoudrizwan.claude-dev'));
  const progetti = {};
  for (const c of cartelle) {
    try {
      for (const h of JSON.parse(fs.readFileSync(path.join(c, 'state', 'taskHistory.json'), 'utf8'))) {
        if (h && h.id && h.cwdOnTaskInitialization) progetti[h.id] = h.cwdOnTaskInitialization;   // the "task" field is the prompt: not read
      }
    } catch (e) { /* no history */ }
  }
  const r = leggiCompiti(cartelle.flatMap(c => sottocartelle(path.join(c, 'tasks'))), cache.legacy, false, c => progetti[path.basename(c)]);
  cache.legacy = r.cache;
  // the Cline CLI / SDK
  const sdk = leggiClineSdk(radice, cache.sdk);
  cache.sdk = sdk.cache;
  return { cache, sessioni: [...r.sessioni, ...sdk.sessioni], limiti: [], avvisi: [] };
}

function leggiClineSdk(radice, cacheIn) {
  const cache = cacheIn && cacheIn.v === VERSIONE ? cacheIn : { v: VERSIONE, file: {} };
  const viste = new Set();
  for (const c of sottocartelle(path.join(radice, 'sessions'))) {
    const id = path.basename(c), f = path.join(c, `${id}.messages.json`);
    let st; try { st = fs.statSync(f); } catch (e) { continue; }
    viste.add(f);
    const v = cache.file[f];
    if (v && v.mtime === st.mtimeMs && v.dim === st.size) continue;
    let progetto = '';
    try { const m = JSON.parse(fs.readFileSync(path.join(c, `${id}.json`), 'utf8')); progetto = m.cwd || m.workspace_root || m.workspaceRoot || ''; } catch (e) { /* no manifest */ }
    const s = nuovaSessione(id, progetto);
    try {
      const j = JSON.parse(fs.readFileSync(f, 'utf8'));
      for (const m of Array.isArray(j.messages) ? j.messages : []) {
        const ts = num(m.ts) || Date.parse(m.ts) || 0, g = ts ? giorno(ts) : null;
        if (ts > s.ultimo) s.ultimo = ts;
        if (m.role === 'user') {
          const t = typeof m.content === 'string' ? m.content : Array.isArray(m.content) ? m.content.map(b => (b && typeof b.text === 'string' ? b.text : '')).join('') : '';
          if (t) aggiungiMessaggio(s, g, Math.ceil(t.length / 4));
        } else if (m.metrics) {
          const x = m.metrics;
          aggiungiRichiesta(s, g, num(x.inputTokens), num(x.outputTokens), num(x.cacheWriteTokens), num(x.cacheReadTokens));
          if (m.modelInfo && m.modelInfo.id) s.modello = String(m.modelInfo.id).slice(0, 40);
        }
      }
    } catch (e) { continue; }
    cache.file[f] = { mtime: st.mtimeMs, dim: st.size, s };
  }
  for (const k of Object.keys(cache.file)) if (!viste.has(k)) delete cache.file[k];
  return { cache, sessioni: Object.values(cache.file).map(x => x.s).filter(s => s.richieste || s.messaggi) };
}

// ---------- Roo Code ----------
function leggiRoo(radice, cacheIn, extra) {
  const cartelle = (extra.archivi || []).map(a => path.join(a, 'rooveterinaryinc.roo-cline'));
  if (radice) cartelle.push(radice);   // the "roo-cline.customStoragePath" setting, if the person set it in "folders"
  const r = leggiCompiti(cartelle.flatMap(c => sottocartelle(path.join(c, 'tasks'))), cacheIn, true, c => {
    try { return JSON.parse(fs.readFileSync(path.join(c, 'history_item.json'), 'utf8')).workspace || ''; } catch (e) { return ''; }
  });
  return { cache: r.cache, sessioni: r.sessioni, limiti: [], avvisi: [] };
}

module.exports = { leggiCline, leggiRoo };
