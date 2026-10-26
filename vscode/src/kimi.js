// Kimi CLI reader (Moonshot AI): ~/.kimi/sessions/<md5 of work dir>/<session id>/wire.jsonl (and subagents/<id>/wire.jsonl).
// Format checked against the official source code (github.com/MoonshotAI/kimi-cli, main, src/kimi_cli/wire/*.py, soul/context.py,
// metadata.py). On this PC only a session without any model call exists, so the token part was NOT tried on real files.
//   wire.jsonl: header { type: "metadata", protocol_version }, then { timestamp (epoch seconds), message: { type, payload } }
//     StatusUpdate.payload.token_usage = { input_other, output, input_cache_read, input_cache_creation }   (one per step; may be null)
//     TurnBegin = a message written by the person (only the length of user_input is used)
//     SubagentEvent = a subagent's events copied into the parent: skipped here, the subagent's own wire.jsonl is counted instead
//   context.jsonl "_usage" lines are the context size, not usage: never summed.
//   ~/.kimi/kimi.json { work_dirs: [{ path, kaos, last_session_id }] } gives the project of each folder (md5 of path).
//   The model is not written per session: default_model from ~/.kimi/config.toml (subagents: meta.json launch_spec.effective_model).
// ~/.kimi/credentials is never opened.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { giorno, leggiRighe, fileConFine, aggiungiRichiesta, aggiungiMessaggio } = require('./comune');

const VERSIONE = 1;

function leggiKimi(radice, cacheIn) {
  const cache = cacheIn && cacheIn.v === VERSIONE ? cacheIn : { v: VERSIONE, file: {} };
  const cartella = path.join(radice, 'sessions');
  const elenco = fileConFine(cartella, ['wire.jsonl']).filter(p => path.basename(p) === 'wire.jsonl');
  const visti = new Set(elenco);
  for (const k of Object.keys(cache.file)) if (!visti.has(k)) delete cache.file[k];

  // projects: md5(work dir) → folder name
  const progetti = {};
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(radice, 'kimi.json'), 'utf8'));
    for (const w of Array.isArray(meta.work_dirs) ? meta.work_dirs : []) {
      if (!w || typeof w.path !== 'string') continue;
      const h = crypto.createHash('md5').update(w.path, 'utf8').digest('hex');
      const nome = path.basename(w.path.replace(/[\\/]+$/, ''));
      progetti[h] = nome;
      if (w.kaos) progetti[`${w.kaos}_${h}`] = nome;
    }
  } catch (e) { /* folder names stay as they are */ }
  let modelloBase = '';
  try { const m = /^\s*default_model\s*=\s*["']([^"']+)["']/m.exec(fs.readFileSync(path.join(radice, 'config.toml'), 'utf8')); if (m) modelloBase = m[1].slice(0, 40); } catch (e) { /* unknown */ }

  for (const file of elenco) {
    let st; try { st = fs.statSync(file); } catch (e) { continue; }
    const nuovo = () => ({ inizio: 0, mtime: 0, s: { messaggi: 0, richieste: 0, token: 0, u: [0, 0, 0, 0], scritti: 0, giorni: {} }, ultimo: 0 });
    let f = cache.file[file] || (cache.file[file] = nuovo());
    if (st.size < f.inizio) f = cache.file[file] = nuovo();
    f.mtime = st.mtimeMs;
    if (st.size === f.inizio) continue;
    const sub = file.split(path.sep).includes('subagents');
    let letto; try { letto = leggiRighe(file, f.inizio); } catch (e) { continue; }
    for (const r of letto.righe) {
      if (!r) continue;
      let j; try { j = JSON.parse(r); } catch (e) { continue; }
      const m = j && j.message;
      if (!m || typeof m.type !== 'string') continue;
      const ts = typeof j.timestamp === 'number' ? j.timestamp * 1000 : NaN, g = isNaN(ts) ? null : giorno(ts);
      if (!isNaN(ts) && ts > f.ultimo) f.ultimo = ts;
      const p = m.payload || {};
      if (m.type === 'StatusUpdate' && p.token_usage) {
        const u = p.token_usage, n = v => Number(v) || 0;
        if (!n(u.input_other) && !n(u.output) && !n(u.input_cache_read) && !n(u.input_cache_creation)) continue;
        aggiungiRichiesta(f.s, g, n(u.input_other), n(u.output), n(u.input_cache_creation), n(u.input_cache_read));
      } else if (m.type === 'TurnBegin' && !sub) {
        const t = p.user_input;
        const n = typeof t === 'string' ? t.length : Array.isArray(t) ? t.reduce((x, b) => x + (b && typeof b.text === 'string' ? b.text.length : 0), 0) : 0;
        aggiungiMessaggio(f.s, g, Math.ceil(n / 4));
      }
    }
    f.inizio = letto.nuovoInizio;
  }

  // one session per main session folder; its subagents are added to it
  const sessioni = {};
  for (const [file, f] of Object.entries(cache.file)) {
    const rel = path.relative(cartella, file).split(path.sep);   // <hash>/<session>/wire.jsonl or <hash>/<session>/subagents/<id>/wire.jsonl
    if (rel.length < 3) continue;
    const [hash, sid] = rel;
    const s = sessioni[sid] || (sessioni[sid] = { id: sid, titolo: titolo(path.join(cartella, hash, sid)), progetto: progetti[hash] || '', modello: modelloBase, messaggi: 0, richieste: 0, token: 0, u: [0, 0, 0, 0], scritti: 0, ultimo: 0, bloccata: false, giorni: {} });
    s.messaggi += f.s.messaggi; s.richieste += f.s.richieste; s.token += f.s.token; s.scritti += f.s.scritti;
    for (let i = 0; i < 4; i++) s.u[i] += f.s.u[i];
    for (const [k, v] of Object.entries(f.s.giorni)) { const x = s.giorni[k] || (s.giorni[k] = [0, 0, 0, 0, 0, 0, 0, 0]); for (let i = 0; i < 8; i++) x[i] += v[i]; }
    s.ultimo = Math.max(s.ultimo, f.ultimo, f.mtime || 0);
  }
  return { cache, sessioni: Object.values(sessioni).filter(s => s.richieste || s.messaggi), limiti: [], avvisi: [] };
}

// the session title kept by Kimi in state.json (a title, not message text)
function titolo(cartella) {
  try { const j = JSON.parse(fs.readFileSync(path.join(cartella, 'state.json'), 'utf8')); return typeof j.title === 'string' ? j.title.slice(0, 80) : ''; } catch (e) { return ''; }
}

module.exports = { leggiKimi };
