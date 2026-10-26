// Conta messaggi e token di tutte le conversazioni di Claude Code salvate su questo PC (~/.claude/projects).
// Legge solo i numeri: messaggi dell'utente, token di ogni risposta, data e titolo della chat. Nessun testo esce da qui.
// Legge ogni file una volta sola e poi solo le righe nuove (cache in ~/.claude/utilizzo-cache.json).
// Uscita (stdout): JSON { aggiornato, totali, sessioni: [...], giorni: { "2026-10-23": { token, messaggi } } }
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const RADICE = path.join(os.homedir(), '.claude', 'projects');
const CACHE = path.join(os.homedir(), '.claude', 'utilizzo-cache.json');
const VERSIONE = 5;   // 5: anche i token scritti dalla persona (stima dalla lunghezza dei suoi messaggi)

let cache = { v: VERSIONE, file: {}, sessioni: {} };
try { const c = JSON.parse(fs.readFileSync(CACHE, 'utf8')); if (c.v === VERSIONE) cache = c; } catch (e) {}

function fileJsonl(dir, out = []) {
  let voci; try { voci = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const v of voci) {
    const p = path.join(dir, v.name);
    if (v.isDirectory()) fileJsonl(p, out);
    else if (v.name.endsWith('.jsonl')) out.push(p);
  }
  return out;
}
const giorno = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function sessione(id) {
  return cache.sessioni[id] || (cache.sessioni[id] = { messaggi: 0, richieste: 0, token: 0, input: 0, output: 0, cacheScritta: 0, cacheLetta: 0, scritti: 0, titolo: '', progetto: '', primo: 0, ultimo: 0, giorni: {}, bloccata: false });
}
// un messaggio scritto dalla persona (non i risultati degli strumenti, non gli avvisi del sistema)
function testoUtente(m) {
  if (!m || m.role !== 'user') return null;
  if (typeof m.content === 'string') return m.content;
  if (!Array.isArray(m.content) || m.content.some(b => b && b.type === 'tool_result')) return null;
  const t = m.content.find(b => b && b.type === 'text');
  return t ? t.text : null;
}

function leggiRighe(file, da) {
  const fd = fs.openSync(file, 'r'), dim = fs.fstatSync(fd).size, pezzi = [];
  let pos = da;
  const buf = Buffer.alloc(4 * 1024 * 1024);
  while (pos < dim) { const n = fs.readSync(fd, buf, 0, Math.min(buf.length, dim - pos), pos); if (!n) break; pezzi.push(Buffer.from(buf.subarray(0, n))); pos += n; }
  fs.closeSync(fd);
  const tutto = Buffer.concat(pezzi), fine = tutto.lastIndexOf(10);   // solo righe complete
  if (fine < 0) return { righe: [], nuovoInizio: da };
  return { righe: tutto.subarray(0, fine).toString('utf8').split('\n'), nuovoInizio: da + fine + 1 };
}

const ora = Date.now(), visti = new Set();
for (const file of fileJsonl(RADICE)) {
  visti.add(file);
  let st; try { st = fs.statSync(file); } catch (e) { continue; }
  const f = cache.file[file] || (cache.file[file] = { inizio: 0, richieste: [], mtime: 0 });
  f.mtime = st.mtimeMs;
  if (st.size < f.inizio) { f.inizio = 0; f.richieste = []; }   // file riscritto: si ricomincia
  if (st.size === f.inizio) continue;
  const secondario = file.includes(`${path.sep}subagents${path.sep}`);
  const giaContate = new Set(f.richieste);
  const { righe, nuovoInizio } = leggiRighe(file, f.inizio);
  for (const r of righe) {
    if (!r) continue;
    let j; try { j = JSON.parse(r); } catch (e) { continue; }
    if (!j.sessionId) continue;
    const s = sessione(j.sessionId);
    if (!s.progetto) s.progetto = path.basename(secondario ? path.dirname(path.dirname(path.dirname(file))) : path.dirname(file));
    if (j.type === 'custom-title' && j.customTitle) { s.titolo = j.customTitle; continue; }
    const ts = j.timestamp ? Date.parse(j.timestamp) : NaN;
    if (!isNaN(ts)) { if (!s.primo || ts < s.primo) s.primo = ts; if (ts > s.ultimo) s.ultimo = ts; }
    if (j.type === 'assistant' && j.message && j.message.usage) {
      const id = j.requestId || j.message.id;
      if (id && giaContate.has(id)) continue;   // la stessa risposta è scritta su più righe
      if (id) { giaContate.add(id); f.richieste.push(id); }
      const u = j.message.usage, tot = (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
      s.richieste++; s.token += tot; s.input += u.input_tokens || 0; s.output += u.output_tokens || 0;
      s.cacheScritta += u.cache_creation_input_tokens || 0; s.cacheLetta += u.cache_read_input_tokens || 0;
      if (!isNaN(ts)) {
        const g = s.giorni[giorno(ts)] || (s.giorni[giorno(ts)] = [0, 0, 0, 0, 0, 0, 0]);
        g[0] += tot; g[2] = (g[2] || 0) + 1; g[3] = (g[3] || 0) + (u.input_tokens || 0); g[4] = (g[4] || 0) + (u.output_tokens || 0);
        g[5] = (g[5] || 0) + (u.cache_creation_input_tokens || 0); g[6] = (g[6] || 0) + (u.cache_read_input_tokens || 0);
      }
      s.bloccata = false;
      if (f.richieste.length > 50000) f.richieste = f.richieste.slice(-20000);
    } else if (j.type === 'assistant' && j.isApiErrorMessage) {
      const t = JSON.stringify(j.message || '').toLowerCase();
      s.bloccata = /limit|limite|quota|rate/.test(t);
    } else if (!secondario && j.type === 'user' && !j.isMeta && !j.isCompactSummary) {
      const t = testoUtente(j.message);
      if (t == null || /^\s*</.test(t)) continue;   // avvisi e comandi interni, non messaggi della persona
      s.messaggi++;
      const stima = Math.ceil(t.length / 4);   // ~4 caratteri per token: si conta solo la lunghezza, il testo non si salva
      s.scritti = (s.scritti || 0) + stima;
      if (!s.titolo && !s.primoTesto) s.primoTesto = t.replace(/\s+/g, ' ').slice(0, 60);
      if (!isNaN(ts)) { const g = s.giorni[giorno(ts)] || (s.giorni[giorno(ts)] = [0, 0, 0, 0, 0, 0, 0, 0]); g[1]++; g[7] = (g[7] || 0) + stima; }
    }
  }
  f.inizio = nuovoInizio;
}
for (const k of Object.keys(cache.file)) if (!visti.has(k)) delete cache.file[k];
try { fs.writeFileSync(CACHE, JSON.stringify(cache)); } catch (e) {}

// ---- riepilogo ----
const ultimoFile = {};
for (const [p, f] of Object.entries(cache.file)) { const id = path.basename(p, '.jsonl'); ultimoFile[id] = Math.max(ultimoFile[id] || 0, f.mtime); }
// per ogni mese "2026-10": [token, messaggi, richieste] della chat
function perMese(g) { const m = {}; for (const [k, v] of Object.entries(g)) { const x = m[k.slice(0, 7)] || (m[k.slice(0, 7)] = [0, 0, 0]); x[0] += v[0] || 0; x[1] += v[1] || 0; x[2] += v[2] || 0; } return m; }
const totali = { messaggi: 0, richieste: 0, token: 0, input: 0, output: 0, cacheScritta: 0, cacheLetta: 0, scritti: 0, sessioni: 0 };
const giorni = {}, sessioni = [];
for (const [id, s] of Object.entries(cache.sessioni)) {
  if (!s.richieste && !s.messaggi) continue;
  for (const k of ['messaggi', 'richieste', 'token', 'input', 'output', 'cacheScritta', 'cacheLetta', 'scritti']) totali[k] += s[k] || 0;
  totali.sessioni++;
  for (const [g, v] of Object.entries(s.giorni)) {
    const x = giorni[g] || (giorni[g] = { token: 0, messaggi: 0, richieste: 0, input: 0, output: 0, cacheScritta: 0, cacheLetta: 0, scritti: 0 });
    x.token += v[0] || 0; x.messaggi += v[1] || 0; x.richieste += v[2] || 0; x.input += v[3] || 0; x.output += v[4] || 0; x.cacheScritta += v[5] || 0; x.cacheLetta += v[6] || 0; x.scritti += v[7] || 0;
  }
  const attivita = Math.max(s.ultimo, ultimoFile[id] || 0);
  const stato = ora - attivita < 120000 ? 'al lavoro' : s.bloccata ? 'bloccata' : 'ferma';
  sessioni.push({ id, titolo: s.titolo || s.primoTesto || 'Senza titolo', progetto: s.progetto.replace(/^C--Users-[^-]+-(Documents-)?/, '').replace(/-/g, ' '),
    messaggi: s.messaggi, richieste: s.richieste, token: s.token, u: [s.input || 0, s.output || 0, s.cacheScritta || 0, s.cacheLetta || 0], ultimo: attivita, stato, mesi: perMese(s.giorni), giorni: Object.fromEntries(Object.entries(s.giorni).map(([k, v]) => [k, [v[0] || 0, v[1] || 0, v[2] || 0]])) });
}
sessioni.sort((a, b) => b.ultimo - a.ultimo);
process.stdout.write(JSON.stringify({ aggiornato: ora, totali, sessioni, giorni }));
