// Gemini CLI reader: ~/.gemini/tmp/<project>/chats/*.jsonl (and the older single-JSON session-*.json).
// Format checked against the official source code only (github.com/google-gemini/gemini-cli, commit cd1b45c,
// packages/core/src/services/chatRecordingTypes.ts + chatRecordingService.ts), NOT on real files:
//   first line   { sessionId, projectHash, startTime, lastUpdated, kind? }
//   message      { id, timestamp, type: 'user' | 'gemini' | 'info' | ..., content, model?, tokens?: { input, output, cached, thoughts?, tool?, total } }
//   updates      { "$set": { ... } }  ($set.messages replaces the whole list), { "$rewindTo": id }, { "$patch": ... }
//   The same message id can be written again (tokens arrive later): the last line wins.
//   input already includes cached; thoughts are billed as output and are not inside output.
// Only numbers are kept: for messages written by the person, only the length of their text.
'use strict';
const fs = require('fs'), path = require('path');
const { giorno, leggiRighe, fileConFine, aggiungiRichiesta, aggiungiMessaggio } = require('./comune');

const VERSIONE = 1;

function leggiGemini(radice, cacheIn) {
  const cache = cacheIn && cacheIn.v === VERSIONE ? cacheIn : { v: VERSIONE, file: {} };
  const tmp = path.join(radice, 'tmp');
  const elenco = fileConFine(tmp, ['.jsonl', '.json']).filter(p => p.split(path.sep).includes('chats'));
  const visti = new Set(elenco);
  for (const k of Object.keys(cache.file)) if (!visti.has(k)) delete cache.file[k];

  for (const file of elenco) {
    let st; try { st = fs.statSync(file); } catch (e) { continue; }
    const nuovo = () => ({ inizio: 0, mtime: 0, dim: 0, sessione: '', sub: false, m: {} });
    let f = cache.file[file] || (cache.file[file] = nuovo());
    if (file.endsWith('.json')) {
      // older format: one JSON document rewritten as a whole
      if (f.mtime === st.mtimeMs && f.dim === st.size) continue;
      f = cache.file[file] = nuovo();
      f.mtime = st.mtimeMs; f.dim = st.size;
      try {
        const j = JSON.parse(fs.readFileSync(file, 'utf8'));
        f.sessione = String(j.sessionId || ''); f.sub = j.kind === 'subagent';
        for (const m of Array.isArray(j.messages) ? j.messages : []) ricorda(f, m);
      } catch (e) { /* half-written: next time */ }
      continue;
    }
    if (st.size < f.inizio) f = cache.file[file] = nuovo();
    f.mtime = st.mtimeMs;
    if (st.size === f.inizio) continue;
    let letto; try { letto = leggiRighe(file, f.inizio); } catch (e) { continue; }
    for (const r of letto.righe) {
      if (!r) continue;
      let j; try { j = JSON.parse(r); } catch (e) { continue; }
      if (!j || typeof j !== 'object') continue;
      if (j.$rewindTo != null) { riavvolgi(f, String(j.$rewindTo)); continue; }
      if (j.$set) { if (Array.isArray(j.$set.messages)) { f.m = {}; for (const m of j.$set.messages) ricorda(f, m); } continue; }
      if (j.$patch) continue;
      if (j.sessionId && !j.type) { f.sessione = String(j.sessionId); if (j.kind === 'subagent') f.sub = true; continue; }
      ricorda(f, j);
    }
    f.inizio = letto.nuovoInizio;
  }

  // project names: each project folder keeps its full path in .project_root
  const progetti = {};
  const progettoDi = file => {
    const cartella = file.slice(0, file.lastIndexOf(`${path.sep}chats${path.sep}`));
    if (progetti[cartella] == null) {
      let nome = path.basename(cartella);
      try { const p = fs.readFileSync(path.join(cartella, '.project_root'), 'utf8').trim(); if (p) nome = path.basename(p.replace(/[\\/]+$/, '')); } catch (e) { /* the folder name is fine */ }
      progetti[cartella] = nome;
    }
    return progetti[cartella];
  };

  const sessioni = {};
  for (const [file, f] of Object.entries(cache.file)) {
    const id = f.sessione || path.basename(file).replace(/\.jsonl?$/, '');
    const s = sessioni[id] || (sessioni[id] = { id, titolo: '', progetto: progettoDi(file), modello: '', messaggi: 0, richieste: 0, token: 0, u: [0, 0, 0, 0], scritti: 0, ultimo: 0, bloccata: false, giorni: {} });
    for (const m of Object.values(f.m)) {
      const ts = m[1], g = ts ? giorno(ts) : null;
      if (ts > s.ultimo) s.ultimo = ts;
      if (m[0] === 'u') { if (!f.sub) aggiungiMessaggio(s, g, Math.ceil(m[2] / 4)); continue; }
      const [, , input, output, cached, thoughts, tool, modello] = m;
      if (!input && !output && !cached) continue;   // reply still without its numbers
      aggiungiRichiesta(s, g, Math.max(0, input - cached) + tool, output + thoughts, 0, cached);
      if (modello) s.modello = modello;
    }
    s.ultimo = Math.max(s.ultimo, f.mtime || 0);
  }
  return { cache, sessioni: Object.values(sessioni).filter(s => s.richieste || s.messaggi), limiti: [], avvisi: [] };
}

// keeps only the numbers of one message: ['u', time, text length] or ['g', time, input, output, cached, thoughts, tool, model]
function ricorda(f, m) {
  if (!m || m.id == null) return;
  const ts = m.timestamp ? Date.parse(m.timestamp) || 0 : 0;
  if (m.type === 'user') {
    const n = lunghezza(m.content);
    if (n >= 0) f.m[String(m.id)] = ['u', ts, n];
  } else if (m.type === 'gemini') {
    const t = m.tokens || {};
    const num = v => Number(v) || 0;
    f.m[String(m.id)] = ['g', ts, num(t.input), num(t.output), num(t.cached), num(t.thoughts), num(t.tool), m.model ? String(m.model).slice(0, 40) : ''];
  }
}
// { "$rewindTo": id }: that message and every later one are dropped
function riavvolgi(f, id) {
  const chiavi = Object.keys(f.m), i = chiavi.indexOf(id);
  if (i < 0) return;
  for (const k of chiavi.slice(i)) delete f.m[k];
}
function lunghezza(c) {
  let t = '';
  if (typeof c === 'string') t = c;
  else if (Array.isArray(c)) t = c.map(p => (typeof p === 'string' ? p : p && typeof p.text === 'string' ? p.text : '')).join('');
  else if (c && typeof c.text === 'string') t = c.text;
  if (!t || /^\s*</.test(t)) return -1;
  return t.length;
}

module.exports = { leggiGemini };
