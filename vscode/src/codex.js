// OpenAI Codex CLI reader: counts messages and tokens from ~/.codex/sessions/**/rollout-*.jsonl
// (and archived_sessions/), including old rollouts that Codex compresses to .jsonl.zst.
// Format checked against the official source code (github.com/openai/codex, codex-rs/history + protocol):
//   every line is { "timestamp", "type", "payload" } with type
//   - "session_meta"        payload { id, timestamp, cwd, ... }
//   - "turn_context"        payload { model, cwd, ... }
//   - "token_usage_record"  payload { response_id, usage: TokenUsage, ... }    (one per model reply, newer Codex)
//   - "event_msg"           payload { type: "token_count", info: { total_token_usage, last_token_usage }, rate_limits }
//                           payload { type: "user_message", message }           (only the length is used)
//   TokenUsage = { input_tokens (includes cached_input_tokens), cached_input_tokens, cache_write_input_tokens?,
//                  output_tokens (includes reasoning_output_tokens), reasoning_output_tokens, total_tokens }
// Thread names come from ~/.codex/session_index.jsonl ({ id, thread_name, updated_at }) when present.
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const { giorno, leggiRighe, fileConFine, aggiungiRichiesta, aggiungiMessaggio } = require('./comune');

const VERSIONE = 1;
const vuota = () => ({ messaggi: 0, richieste: 0, token: 0, u: [0, 0, 0, 0], scritti: 0, giorni: {} });

function leggiCodex(radice, cacheIn) {
  const cache = cacheIn && cacheIn.v === VERSIONE ? cacheIn : { v: VERSIONE, file: {} };
  const avvisi = [];
  const zstd = typeof zlib.zstdDecompressSync === 'function';
  const elenco = [...fileConFine(path.join(radice, 'sessions'), ['.jsonl', '.jsonl.zst']), ...fileConFine(path.join(radice, 'archived_sessions'), ['.jsonl', '.jsonl.zst'])]
    .filter(p => path.basename(p).startsWith('rollout-'))
    // oldest first (the name starts with the creation time), so an original thread is counted before its forks
    .sort((a, b) => (path.basename(a) < path.basename(b) ? -1 : path.basename(a) > path.basename(b) ? 1 : 0));
  const visti = new Set(elenco);
  for (const k of Object.keys(cache.file)) if (!visti.has(k)) delete cache.file[k];
  // replies already counted in any file (a forked thread copies the history of the original one)
  const risposte = new Set();
  for (const f of Object.values(cache.file)) for (const id of f.risposte || []) risposte.add(id);
  let saltati = 0;

  for (const file of elenco) {
    let st; try { st = fs.statSync(file); } catch (e) { continue; }
    const compresso = file.endsWith('.zst');
    let f = cache.file[file];
    const nuovo = () => ({ inizio: 0, dim: 0, mtime: 0, id: '', progetto: '', modello: '', primo: 0, ultimo: 0, rec: vuota(), tc: vuota(), msg: vuota(), totale: -1, risposte: [], limiti: null });
    if (!f) f = cache.file[file] = nuovo();
    if (compresso) {
      if (f.dim === st.size && f.mtime === st.mtimeMs) continue;
      if (!zstd) { saltati++; continue; }
      for (const id of f.risposte) risposte.delete(id);
      f = cache.file[file] = nuovo();
    } else {
      if (st.size < f.inizio) { for (const id of f.risposte) risposte.delete(id); f = cache.file[file] = nuovo(); }
      if (st.size === f.inizio) { f.mtime = st.mtimeMs; continue; }
    }
    f.mtime = st.mtimeMs; f.dim = st.size;
    let righe;
    try {
      if (compresso) { righe = zlib.zstdDecompressSync(fs.readFileSync(file)).toString('utf8').split('\n'); f.inizio = st.size; }
      else { const l = leggiRighe(file, f.inizio); righe = l.righe; f.inizio = l.nuovoInizio; }
    } catch (e) { continue; }
    if (!f.id) { const m = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(path.basename(file)); f.id = m ? m[1] : path.basename(file); }
    for (const r of righe) {
      if (!r) continue;
      let j; try { j = JSON.parse(r); } catch (e) { continue; }
      const p = j && j.payload;
      if (!p || typeof j.type !== 'string') continue;
      const ts = j.timestamp ? Date.parse(j.timestamp) : NaN;
      const g = isNaN(ts) ? null : giorno(ts);
      if (!isNaN(ts)) { if (!f.primo || ts < f.primo) f.primo = ts; if (ts > f.ultimo) f.ultimo = ts; }
      if (j.type === 'session_meta') {
        if (p.id && !f.metaId) f.metaId = String(p.id);
        if (p.cwd && !f.progetto) f.progetto = path.basename(String(p.cwd).replace(/[\\/]+$/, ''));
      } else if (j.type === 'turn_context') {
        if (p.model) f.modello = String(p.model).slice(0, 40);
        if (p.cwd && !f.progetto) f.progetto = path.basename(String(p.cwd).replace(/[\\/]+$/, ''));
      } else if (j.type === 'token_usage_record' && p.usage) {
        const id = p.response_id ? String(p.response_id) : '';
        if (id && risposte.has(id)) continue;
        if (id) { risposte.add(id); f.risposte.push(id); }
        aggiungi(f.rec, g, p.usage);
      } else if (j.type === 'event_msg' && p.type === 'token_count') {
        if (p.rate_limits && !isNaN(ts)) f.limiti = { ts, primary: finestra(p.rate_limits.primary, ts), secondary: finestra(p.rate_limits.secondary, ts) };
        const info = p.info;
        if (!info || !info.last_token_usage) continue;
        const tot = info.total_token_usage ? Number(info.total_token_usage.total_tokens) || 0 : -2;
        if (tot === f.totale) continue;   // the same count is repeated when nothing new happened
        f.totale = tot;
        aggiungi(f.tc, g, info.last_token_usage);
      } else if (j.type === 'event_msg' && p.type === 'user_message') {
        if (p.kind && p.kind !== 'plain') continue;   // older Codex: instructions and environment context
        const t = typeof p.message === 'string' ? p.message : '';
        if (/^\s*</.test(t)) continue;
        aggiungiMessaggio(f.msg, g, Math.ceil(t.length / 4));   // only the length is used, the text is not kept
      }
    }
  }
  if (saltati) avvisi.push({ chiave: 'codexZst', n: saltati });

  // thread names, if Codex saved any
  const nomi = {};
  try {
    for (const r of fs.readFileSync(path.join(radice, 'session_index.jsonl'), 'utf8').split('\n')) {
      try { const j = JSON.parse(r); if (j && j.id && j.thread_name) nomi[j.id] = String(j.thread_name).slice(0, 80); } catch (e) { /* next line */ }
    }
  } catch (e) { /* no index */ }

  const sessioni = [];
  let limiti = null;
  for (const f of Object.values(cache.file)) {
    // newer Codex writes one record per reply; older Codex only the running token_count
    const base = f.rec.richieste > 0 ? f.rec : f.tc;
    if (!base.richieste && !f.msg.messaggi) continue;
    const giorni = {};
    for (const [k, v] of Object.entries(base.giorni)) giorni[k] = v.slice();
    for (const [k, v] of Object.entries(f.msg.giorni)) { const x = giorni[k] || (giorni[k] = [0, 0, 0, 0, 0, 0, 0, 0]); x[1] += v[1]; x[7] += v[7]; }
    const id = f.metaId || f.id;
    const pieno = w => w && w.used_percent >= 100 && (!w.resets_at || w.resets_at * 1000 > Date.now());
    sessioni.push({
      id, fonte: 'codex', titolo: nomi[id] || nomi[f.id] || '', progetto: f.progetto || '', modello: f.modello || '',
      messaggi: f.msg.messaggi, richieste: base.richieste, token: base.token, u: base.u.slice(), scritti: f.msg.scritti,
      ultimo: Math.max(f.ultimo, f.mtime || 0), bloccata: !!(f.limiti && (pieno(f.limiti.primary) || pieno(f.limiti.secondary))), giorni,
    });
    if (f.limiti && (!limiti || f.limiti.ts > limiti.ts)) limiti = f.limiti;
  }
  const elencoLimiti = [];
  if (limiti) for (const w of [limiti.primary, limiti.secondary]) if (w) elencoLimiti.push({ fonte: 'codex', minuti: w.window_minutes, percento: w.used_percent, azzera: w.resets_at ? w.resets_at * 1000 : 0, letto: limiti.ts });
  return { cache, sessioni, limiti: elencoLimiti, avvisi };
}

// Codex TokenUsage → the four numbers used by the panel (new input, output, cache write, cache read)
function aggiungi(s, g, u) {
  const entrata = Number(u.input_tokens) || 0, letti = Number(u.cached_input_tokens) || 0, scritti = Number(u.cache_write_input_tokens) || 0;
  aggiungiRichiesta(s, g, Math.max(0, entrata - letti - scritti), Number(u.output_tokens) || 0, scritti, letti);
}

// a rate-limit window with an absolute reset time (older Codex wrote resets_in_seconds)
function finestra(w, ts) {
  if (!w || typeof w.used_percent !== 'number') return null;
  const azzera = typeof w.resets_at === 'number' ? w.resets_at : typeof w.resets_in_seconds === 'number' ? Math.round(ts / 1000 + w.resets_in_seconds) : 0;
  return { used_percent: w.used_percent, window_minutes: typeof w.window_minutes === 'number' ? w.window_minutes : 0, resets_at: azzera };
}

module.exports = { leggiCodex };
