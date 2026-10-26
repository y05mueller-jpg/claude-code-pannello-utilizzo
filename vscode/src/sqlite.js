// Readers for tools that keep their history in a SQLite database: opencode, ZCode (Z.ai / GLM) and MiniMax Code.
// The database is opened READ-ONLY with Node's built-in SQLite (node:sqlite); only numeric columns, ids, dates,
// model names, titles and folders are selected, never message text. Without node:sqlite (older editors) the
// panel says so instead of counting.
// Formats checked against the official source code only (not on real files):
//   opencode   github.com/anomalyco/opencode v1.19.4, packages/core/src/session/sql.ts + packages/schema/src/v1/session.ts
//   ZCode      github.com/zai-org/ZCode, apps/zcode-cli/.../storage/session-store
//   MiniMax    github.com/MiniMax-AI/minimax-code, packages/config/src/data-dir.ts + local runtime storage
'use strict';
const fs = require('fs'), path = require('path');
const { giorno, fileConFine, aggiungiRichiesta, aggiungiMessaggio } = require('./comune');

const VERSIONE = 1;

function apri(file) {
  let sqlite;
  try { sqlite = require('node:sqlite'); } catch (e) { return { errore: 'sqlite' }; }
  try { return { db: new sqlite.DatabaseSync(file, { readOnly: true }) }; } catch (e) { return { errore: String((e && e.message) || e).slice(0, 120) }; }
}
const tabelle = db => new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(r => r.name));
const colonne = (db, t) => new Set(db.prepare(`PRAGMA table_info("${t.replace(/"/g, '')}")`).all().map(r => r.name));
// a database changes when the file or its -wal file changes
function impronta(file) {
  let x = '';
  for (const f of [file, file + '-wal']) { try { const s = fs.statSync(f); x += `${s.size}:${s.mtimeMs};`; } catch (e) { x += '-;'; } }
  return x;
}
const nuovaSessione = (id, titolo, progetto, modello) => ({ id: String(id), titolo: titolo ? String(titolo).slice(0, 80) : '', progetto: progetto ? path.basename(String(progetto).replace(/[\\/]+$/, '')) : '', modello: modello ? String(modello).slice(0, 40) : '', messaggi: 0, richieste: 0, token: 0, u: [0, 0, 0, 0], scritti: 0, ultimo: 0, bloccata: false, giorni: {} });
const ms = v => { if (v == null) return NaN; if (typeof v === 'number') return v < 1e12 ? v * 1000 : v; const n = Number(v); if (!isNaN(n)) return n < 1e12 ? n * 1000 : n; return Date.parse(v); };
const num = v => Number(v) || 0;

// reads the databases only when they changed; otherwise the last result is reused
function conCache(file, cacheIn, leggi) {
  const cache = cacheIn && cacheIn.v === VERSIONE ? cacheIn : { v: VERSIONE };
  if (!fs.existsSync(file)) return { cache: { v: VERSIONE }, sessioni: [], limiti: [], avvisi: [] };
  const imp = impronta(file);
  if (cache.impronta === imp && cache.sessioni) return { cache, sessioni: cache.sessioni, limiti: [], avvisi: cache.avvisi || [] };
  const { db, errore } = apri(file);
  if (!db) return { cache, sessioni: cache.sessioni || [], limiti: [], avvisi: [{ chiave: errore === 'sqlite' ? 'senzaSqlite' : 'sqliteErrore', testo: errore }] };
  try {
    const sessioni = leggi(db).filter(s => s.richieste || s.messaggi);
    return { cache: { v: VERSIONE, impronta: imp, sessioni }, sessioni, limiti: [], avvisi: [] };
  } finally { try { db.close(); } catch (e) { /* closed */ } }
}

// ---------- opencode ----------
// <home>/.local/share/opencode/opencode.db: table session (id, directory, title, time_updated, model JSON) and
// message (session_id, time_created, data JSON with role, modelID, tokens { input, output, reasoning, cache { read, write } })
// or, in newer builds, session_message (session_id, type, data JSON with model { id }, tokens, time { created }).
// Older opencode wrote JSON files in storage/message/<session>/<message>.json: read when there is no database.
function leggiOpencode(radice, cacheIn) {
  const file = path.join(radice, 'opencode.db');
  if (!fs.existsSync(file)) return leggiOpencodeJson(radice, cacheIn);
  return opencodeDb(file, cacheIn);
}
// Kilo Code (kilocode.kilo-code v7, an opencode fork): ~/.local/share/kilo/kilo.db, same tables
// (github.com/Kilo-Org/kilocode packages/opencode/src/storage/db.ts)
function leggiKilo(radice, cacheIn) { return opencodeDb(path.join(radice, 'kilo.db'), cacheIn); }

function opencodeDb(file, cacheIn) {
  return conCache(file, cacheIn, db => {
    const t = tabelle(db), sessioni = {};
    for (const nomeT of ['session', 'session_v2']) {
      if (!t.has(nomeT)) continue;
      const c = colonne(db, nomeT);
      const sel = ['id', c.has('directory') ? 'directory' : 'NULL AS directory', c.has('title') ? 'title' : 'NULL AS title', c.has('time_updated') ? 'time_updated' : 'NULL AS time_updated'].join(', ');
      for (const r of db.prepare(`SELECT ${sel} FROM "${nomeT}"`).all()) {
        const s = sessioni[r.id] || (sessioni[r.id] = nuovaSessione(r.id, r.title, r.directory, ''));
        s.ultimo = Math.max(s.ultimo, ms(r.time_updated) || 0);
      }
    }
    const conta = (sql) => {
      for (const r of db.prepare(sql).all()) {
        const s = sessioni[r.sid] || (sessioni[r.sid] = nuovaSessione(r.sid, '', '', ''));
        const ts = ms(r.creato), g = isNaN(ts) ? null : giorno(ts);
        if (!isNaN(ts) && ts > s.ultimo) s.ultimo = ts;
        if (r.ruolo === 'user') { aggiungiMessaggio(s, g, 0); continue; }
        if (r.ruolo !== 'assistant') continue;
        if (!num(r.ti) && !num(r.tout) && !num(r.cr) && !num(r.cw)) continue;
        // opencode keeps input without the cache; reasoning is billed as output
        aggiungiRichiesta(s, g, num(r.ti), num(r.tout) + num(r.tr), num(r.cw), num(r.cr));
        if (r.modello) s.modello = String(r.modello).slice(0, 40);
      }
    };
    const usati = new Set();
    if (t.has('message')) {
      const n = db.prepare("SELECT COUNT(*) AS n FROM message WHERE json_extract(data, '$.role') = 'assistant'").get().n;
      if (n) {
        conta(`SELECT session_id AS sid, COALESCE(json_extract(data, '$.time.created'), time_created) AS creato, json_extract(data, '$.role') AS ruolo,
          json_extract(data, '$.modelID') AS modello, json_extract(data, '$.tokens.input') AS ti, json_extract(data, '$.tokens.output') AS tout,
          json_extract(data, '$.tokens.reasoning') AS tr, json_extract(data, '$.tokens.cache.read') AS cr, json_extract(data, '$.tokens.cache.write') AS cw FROM message`);
        usati.add('message');
      }
    }
    if (!usati.size && t.has('session_message')) {
      conta(`SELECT session_id AS sid, COALESCE(json_extract(data, '$.time.created'), time_created) AS creato, type AS ruolo,
        json_extract(data, '$.model.id') AS modello, json_extract(data, '$.tokens.input') AS ti, json_extract(data, '$.tokens.output') AS tout,
        json_extract(data, '$.tokens.reasoning') AS tr, json_extract(data, '$.tokens.cache.read') AS cr, json_extract(data, '$.tokens.cache.write') AS cw FROM session_message`);
    }
    return Object.values(sessioni);
  });
}

function leggiOpencodeJson(radice, cacheIn) {
  const cartella = path.join(radice, 'storage');
  const file = fileConFine(path.join(cartella, 'message'), ['.json']);
  if (!file.length) return { cache: { v: VERSIONE }, sessioni: [], limiti: [], avvisi: [] };
  const imp = `${file.length}:${file.reduce((x, f) => { try { return Math.max(x, fs.statSync(f).mtimeMs); } catch (e) { return x; } }, 0)}`;
  if (cacheIn && cacheIn.v === VERSIONE && cacheIn.impronta === imp) return { cache: cacheIn, sessioni: cacheIn.sessioni, limiti: [], avvisi: [] };
  const info = {};
  for (const f of fileConFine(path.join(cartella, 'session'), ['.json'])) {
    try { const j = JSON.parse(fs.readFileSync(f, 'utf8')); if (j && j.id) info[j.id] = { titolo: j.title, cartella: j.directory }; } catch (e) { /* next */ }
  }
  const sessioni = {};
  for (const f of file) {
    let j; try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { continue; }
    const sid = j.sessionID || path.basename(path.dirname(f));
    const i = info[sid] || {};
    const s = sessioni[sid] || (sessioni[sid] = nuovaSessione(sid, i.titolo, i.cartella, ''));
    const ts = ms(j.time && j.time.created), g = isNaN(ts) ? null : giorno(ts);
    if (!isNaN(ts) && ts > s.ultimo) s.ultimo = ts;
    if (j.role === 'user') { aggiungiMessaggio(s, g, 0); continue; }
    const k = j.tokens;
    if (j.role !== 'assistant' || !k) continue;
    aggiungiRichiesta(s, g, num(k.input), num(k.output) + num(k.reasoning), num(k.cache && k.cache.write), num(k.cache && k.cache.read));
    if (j.modelID) s.modello = String(j.modelID).slice(0, 40);
  }
  const elenco = Object.values(sessioni).filter(s => s.richieste || s.messaggi);
  return { cache: { v: VERSIONE, impronta: imp, sessioni: elenco }, sessioni: elenco, limiti: [], avvisi: [] };
}

// ---------- ZCode (Z.ai, GLM) ----------
// ~/.zcode/cli/db/db.sqlite: table model_usage (session_id, model_id, started_at, input_tokens, output_tokens, reasoning_tokens,
// cache_creation_input_tokens, cache_read_input_tokens) and session (directory, title). ZCode deletes usage rows after 30 days.
function leggiZcode(radice, cacheIn) {
  return conCache(path.join(radice, 'cli', 'db', 'db.sqlite'), cacheIn, db => {
    const t = tabelle(db), sessioni = {};
    if (t.has('session')) {
      const c = colonne(db, 'session');
      if (c.has('id')) for (const r of db.prepare(`SELECT id, ${c.has('directory') ? 'directory' : 'NULL AS directory'}, ${c.has('title') ? 'title' : 'NULL AS title'} FROM session`).all()) sessioni[r.id] = nuovaSessione(r.id, r.title, r.directory, '');
    }
    if (!t.has('model_usage')) return [];
    for (const r of db.prepare(`SELECT session_id AS sid, model_id AS modello, started_at AS creato, input_tokens AS ti, output_tokens AS tout, reasoning_tokens AS tr,
      cache_creation_input_tokens AS cw, cache_read_input_tokens AS cr FROM model_usage`).all()) {
      const s = sessioni[r.sid] || (sessioni[r.sid] = nuovaSessione(r.sid, '', '', ''));
      const ts = ms(r.creato), g = isNaN(ts) ? null : giorno(ts);
      if (!isNaN(ts) && ts > s.ultimo) s.ultimo = ts;
      // Anthropic-style names: input without the cache (not confirmed in the source)
      aggiungiRichiesta(s, g, num(r.ti), num(r.tout) + num(r.tr), num(r.cw), num(r.cr));
      if (r.modello) s.modello = String(r.modello).slice(0, 40);
    }
    return Object.values(sessioni);
  });
}

// ---------- MiniMax Code ----------
// ~/.minimax/v2/sqlite/*.sqlite (older: ~/.mavis): table local_runtime_token_usage (session_id, model, ts in ms,
// input_tokens, output_tokens, reasoning_tokens, cache_read_tokens, cache_write_tokens).
function leggiMinimax(radice, cacheIn) {
  const candidati = ['runtime-state.sqlite', 'usage-state.sqlite'].map(n => path.join(radice, 'v2', 'sqlite', n)).filter(f => fs.existsSync(f));
  const cache = cacheIn && cacheIn.v === VERSIONE && cacheIn.parti ? cacheIn : { v: VERSIONE, parti: {} };
  const sessioni = [], avvisi = [];
  for (const f of candidati) {
    const r = conCache(f, cache.parti[f], db => {
      if (!tabelle(db).has('local_runtime_token_usage')) return [];
      const s = {};
      for (const x of db.prepare(`SELECT session_id AS sid, model AS modello, ts AS creato, input_tokens AS ti, output_tokens AS tout, reasoning_tokens AS tr,
        cache_read_tokens AS cr, cache_write_tokens AS cw FROM local_runtime_token_usage`).all()) {
        const q = s[x.sid] || (s[x.sid] = nuovaSessione(x.sid, '', '', ''));
        const ts = ms(x.creato), g = isNaN(ts) ? null : giorno(ts);
        if (!isNaN(ts) && ts > q.ultimo) q.ultimo = ts;
        aggiungiRichiesta(q, g, num(x.ti), num(x.tout) + num(x.tr), num(x.cw), num(x.cr));
        if (x.modello) q.modello = String(x.modello).slice(0, 40);
      }
      return Object.values(s);
    });
    cache.parti[f] = r.cache;
    sessioni.push(...r.sessioni); avvisi.push(...r.avvisi);
  }
  return { cache, sessioni, limiti: [], avvisi };
}

module.exports = { leggiOpencode, leggiKilo, leggiZcode, leggiMinimax };
