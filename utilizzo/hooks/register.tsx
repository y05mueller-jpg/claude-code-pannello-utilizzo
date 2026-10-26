// Pannello «Utilizzo» accanto alla chat: limiti delle 5 ore e settimanale, memoria della sessione, sessioni al lavoro,
// ferme o bloccate, messaggi e token (in totale, per chat, per richiesta) e un grafico a barre blu, una per giorno, del
// mese scelto. I numeri delle chat li conta strumenti/conta.js dai file delle conversazioni su questo PC (solo numeri).
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Altri, Api, Dati, Limite, Memoria, Prezzo, Scelta } from '../types'
import { TESTI, TESTI_ALTRI, TESTI_API, codiceLingua, linguaNota, type Lingua } from './testi'

// lingua del pannello: impostazione "language" di Claude Code, poi lingua del computer, altrimenti inglese
let T = TESTI.en
async function rilevaLingua($: any): Promise<Lingua> {
  try {
    const righe: any[] = await $.config.list()
    const r = righe.find(x => /^(language|preferredLanguage)$/i.test(String(x.key)))
    const v = r && r.value ? String(r.value) : ''
    const l = v && !/default|predefin|auto/i.test(v) ? linguaNota(v) : null
    if (l) return l
  } catch (e) { /* si prova con la lingua del computer */ }
  try { const l = linguaNota(Intl.DateTimeFormat().resolvedOptions().locale); if (l && l !== 'en') return l } catch (e) { /* niente Intl qui */ }
  try {
    const r = await $.process.run(['node', '-e', 'process.stdout.write(Intl.DateTimeFormat().resolvedOptions().locale)'], { timeoutMs: 10000 })
    if (r.exitCode === 0 && r.stdout) return codiceLingua(r.stdout)
  } catch (e) { /* inglese */ }
  return 'en'
}

const PANNELLO = 'utilizzo'
// compressione automatica: alla fine di una risposta, se la memoria della chat supera questa soglia
const SOGLIA = 40
let senzaClic = false
// il contatore (strumenti/conta.js) viaggia dentro il modulo e gira con `node -e`: così funziona in qualsiasi cartella
const CONTA_JS = "// Conta messaggi e token di tutte le conversazioni di Claude Code salvate su questo PC (~/.claude/projects).\n// Legge solo i numeri: messaggi dell'utente, token di ogni risposta, data e titolo della chat. Nessun testo esce da qui.\n// Legge ogni file una volta sola e poi solo le righe nuove (cache in ~/.claude/utilizzo-cache.json).\n// Uscita (stdout): JSON { aggiornato, totali, sessioni: [...], giorni: { \"2026-10-23\": { token, messaggi } } }\n'use strict';\nconst fs = require('fs'), path = require('path'), os = require('os');\nconst RADICE = path.join(os.homedir(), '.claude', 'projects');\nconst CACHE = path.join(os.homedir(), '.claude', 'utilizzo-cache.json');\nconst VERSIONE = 5;   // 5: anche i token scritti dalla persona (stima dalla lunghezza dei suoi messaggi)\n\nlet cache = { v: VERSIONE, file: {}, sessioni: {} };\ntry { const c = JSON.parse(fs.readFileSync(CACHE, 'utf8')); if (c.v === VERSIONE) cache = c; } catch (e) {}\n\nfunction fileJsonl(dir, out = []) {\n  let voci; try { voci = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }\n  for (const v of voci) {\n    const p = path.join(dir, v.name);\n    if (v.isDirectory()) fileJsonl(p, out);\n    else if (v.name.endsWith('.jsonl')) out.push(p);\n  }\n  return out;\n}\nconst giorno = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };\nfunction sessione(id) {\n  return cache.sessioni[id] || (cache.sessioni[id] = { messaggi: 0, richieste: 0, token: 0, input: 0, output: 0, cacheScritta: 0, cacheLetta: 0, scritti: 0, titolo: '', progetto: '', primo: 0, ultimo: 0, giorni: {}, bloccata: false });\n}\n// un messaggio scritto dalla persona (non i risultati degli strumenti, non gli avvisi del sistema)\nfunction testoUtente(m) {\n  if (!m || m.role !== 'user') return null;\n  if (typeof m.content === 'string') return m.content;\n  if (!Array.isArray(m.content) || m.content.some(b => b && b.type === 'tool_result')) return null;\n  const t = m.content.find(b => b && b.type === 'text');\n  return t ? t.text : null;\n}\n\nfunction leggiRighe(file, da) {\n  const fd = fs.openSync(file, 'r'), dim = fs.fstatSync(fd).size, pezzi = [];\n  let pos = da;\n  const buf = Buffer.alloc(4 * 1024 * 1024);\n  while (pos < dim) { const n = fs.readSync(fd, buf, 0, Math.min(buf.length, dim - pos), pos); if (!n) break; pezzi.push(Buffer.from(buf.subarray(0, n))); pos += n; }\n  fs.closeSync(fd);\n  const tutto = Buffer.concat(pezzi), fine = tutto.lastIndexOf(10);   // solo righe complete\n  if (fine < 0) return { righe: [], nuovoInizio: da };\n  return { righe: tutto.subarray(0, fine).toString('utf8').split('\\n'), nuovoInizio: da + fine + 1 };\n}\n\nconst ora = Date.now(), visti = new Set();\nfor (const file of fileJsonl(RADICE)) {\n  visti.add(file);\n  let st; try { st = fs.statSync(file); } catch (e) { continue; }\n  const f = cache.file[file] || (cache.file[file] = { inizio: 0, richieste: [], mtime: 0 });\n  f.mtime = st.mtimeMs;\n  if (st.size < f.inizio) { f.inizio = 0; f.richieste = []; }   // file riscritto: si ricomincia\n  if (st.size === f.inizio) continue;\n  const secondario = file.includes(`${path.sep}subagents${path.sep}`);\n  const giaContate = new Set(f.richieste);\n  const { righe, nuovoInizio } = leggiRighe(file, f.inizio);\n  for (const r of righe) {\n    if (!r) continue;\n    let j; try { j = JSON.parse(r); } catch (e) { continue; }\n    if (!j.sessionId) continue;\n    const s = sessione(j.sessionId);\n    if (!s.progetto) s.progetto = path.basename(secondario ? path.dirname(path.dirname(path.dirname(file))) : path.dirname(file));\n    if (j.type === 'custom-title' && j.customTitle) { s.titolo = j.customTitle; continue; }\n    const ts = j.timestamp ? Date.parse(j.timestamp) : NaN;\n    if (!isNaN(ts)) { if (!s.primo || ts < s.primo) s.primo = ts; if (ts > s.ultimo) s.ultimo = ts; }\n    if (j.type === 'assistant' && j.message && j.message.usage) {\n      const id = j.requestId || j.message.id;\n      if (id && giaContate.has(id)) continue;   // la stessa risposta \u00e8 scritta su pi\u00f9 righe\n      if (id) { giaContate.add(id); f.richieste.push(id); }\n      const u = j.message.usage, tot = (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);\n      s.richieste++; s.token += tot; s.input += u.input_tokens || 0; s.output += u.output_tokens || 0;\n      s.cacheScritta += u.cache_creation_input_tokens || 0; s.cacheLetta += u.cache_read_input_tokens || 0;\n      if (!isNaN(ts)) {\n        const g = s.giorni[giorno(ts)] || (s.giorni[giorno(ts)] = [0, 0, 0, 0, 0, 0, 0]);\n        g[0] += tot; g[2] = (g[2] || 0) + 1; g[3] = (g[3] || 0) + (u.input_tokens || 0); g[4] = (g[4] || 0) + (u.output_tokens || 0);\n        g[5] = (g[5] || 0) + (u.cache_creation_input_tokens || 0); g[6] = (g[6] || 0) + (u.cache_read_input_tokens || 0);\n      }\n      s.bloccata = false;\n      if (f.richieste.length > 50000) f.richieste = f.richieste.slice(-20000);\n    } else if (j.type === 'assistant' && j.isApiErrorMessage) {\n      const t = JSON.stringify(j.message || '').toLowerCase();\n      s.bloccata = /limit|limite|quota|rate/.test(t);\n    } else if (!secondario && j.type === 'user' && !j.isMeta && !j.isCompactSummary) {\n      const t = testoUtente(j.message);\n      if (t == null || /^\\s*</.test(t)) continue;   // avvisi e comandi interni, non messaggi della persona\n      s.messaggi++;\n      const stima = Math.ceil(t.length / 4);   // ~4 caratteri per token: si conta solo la lunghezza, il testo non si salva\n      s.scritti = (s.scritti || 0) + stima;\n      if (!s.titolo && !s.primoTesto) s.primoTesto = t.replace(/\\s+/g, ' ').slice(0, 60);\n      if (!isNaN(ts)) { const g = s.giorni[giorno(ts)] || (s.giorni[giorno(ts)] = [0, 0, 0, 0, 0, 0, 0, 0]); g[1]++; g[7] = (g[7] || 0) + stima; }\n    }\n  }\n  f.inizio = nuovoInizio;\n}\nfor (const k of Object.keys(cache.file)) if (!visti.has(k)) delete cache.file[k];\ntry { fs.writeFileSync(CACHE, JSON.stringify(cache)); } catch (e) {}\n\n// ---- riepilogo ----\nconst ultimoFile = {};\nfor (const [p, f] of Object.entries(cache.file)) { const id = path.basename(p, '.jsonl'); ultimoFile[id] = Math.max(ultimoFile[id] || 0, f.mtime); }\n// per ogni mese \"2026-10\": [token, messaggi, richieste] della chat\nfunction perMese(g) { const m = {}; for (const [k, v] of Object.entries(g)) { const x = m[k.slice(0, 7)] || (m[k.slice(0, 7)] = [0, 0, 0]); x[0] += v[0] || 0; x[1] += v[1] || 0; x[2] += v[2] || 0; } return m; }\nconst totali = { messaggi: 0, richieste: 0, token: 0, input: 0, output: 0, cacheScritta: 0, cacheLetta: 0, scritti: 0, sessioni: 0 };\nconst giorni = {}, sessioni = [];\nfor (const [id, s] of Object.entries(cache.sessioni)) {\n  if (!s.richieste && !s.messaggi) continue;\n  for (const k of ['messaggi', 'richieste', 'token', 'input', 'output', 'cacheScritta', 'cacheLetta', 'scritti']) totali[k] += s[k] || 0;\n  totali.sessioni++;\n  for (const [g, v] of Object.entries(s.giorni)) {\n    const x = giorni[g] || (giorni[g] = { token: 0, messaggi: 0, richieste: 0, input: 0, output: 0, cacheScritta: 0, cacheLetta: 0, scritti: 0 });\n    x.token += v[0] || 0; x.messaggi += v[1] || 0; x.richieste += v[2] || 0; x.input += v[3] || 0; x.output += v[4] || 0; x.cacheScritta += v[5] || 0; x.cacheLetta += v[6] || 0; x.scritti += v[7] || 0;\n  }\n  const attivita = Math.max(s.ultimo, ultimoFile[id] || 0);\n  const stato = ora - attivita < 120000 ? 'al lavoro' : s.bloccata ? 'bloccata' : 'ferma';\n  sessioni.push({ id, titolo: s.titolo || s.primoTesto || 'Senza titolo', progetto: s.progetto.replace(/^C--Users-[^-]+-(Documents-)?/, '').replace(/-/g, ' '),\n    messaggi: s.messaggi, richieste: s.richieste, token: s.token, u: [s.input || 0, s.output || 0, s.cacheScritta || 0, s.cacheLetta || 0], ultimo: attivita, stato, mesi: perMese(s.giorni), giorni: Object.fromEntries(Object.entries(s.giorni).map(([k, v]) => [k, [v[0] || 0, v[1] || 0, v[2] || 0]])) });\n}\nsessioni.sort((a, b) => b.ultimo - a.ultimo);\nprocess.stdout.write(JSON.stringify({ aggiornato: ora, totali, sessioni, giorni }));\n"
// i crediti API (strumenti/api.js), anche loro dentro il modulo
const API_JS = "// Crediti API per il pannello \u00abUtilizzo\u00bb (facoltativo): legge ~/.claude/utilizzo-api/config.json (crediti, scadenze, prezzi)\n// e, se c'\u00e8, uso.jsonl (una riga per lavoro: { data, titolo, modello, costo }). Solo numeri. Senza config.json la sezione non compare.\n// Uscita (stdout): JSON { crediti, speso, lavori, prezzi, ricarica, chiave, agente, auto, soglia, scelta, perModello, risparmio, ultimi }\n'use strict';\nconst fs = require('fs'), path = require('path'), os = require('os');\nconst CARTELLA = path.join(os.homedir(), '.claude', 'utilizzo-api');\nlet config = { crediti: [], prezzi_per_milione: {}, ricarica: 'https://console.anthropic.com/settings/billing' };\nlet presente = false;\ntry { config = { ...config, ...JSON.parse(fs.readFileSync(path.join(CARTELLA, 'config.json'), 'utf8')) }; presente = true; } catch (e) {}\nconst lavori = [];\ntry {\n  for (const r of fs.readFileSync(path.join(CARTELLA, 'uso.jsonl'), 'utf8').split('\\n')) {\n    if (!r.trim()) continue;\n    try {\n      const j = JSON.parse(r)\n      lavori.push({ data: j.data, titolo: j.titolo, modello: j.modello, costo: Number(j.costo) || 0, minuti: j.minuti, esito: j.esito, livello: j.livello,\n        u: [Number(j.entrata) || 0, Number(j.uscita) || 0, Number(j.cache_scritta) || 0, Number(j.cache_letta) || 0] });\n    } catch (e) {}\n  }\n} catch (e) {}\nconst speso = lavori.reduce((s, l) => s + l.costo, 0);\n// passaggio automatico ai crediti API (hooks/register.tsx): serve l'aiutante agente.py e il file della chiave.\n// Della chiave si guarda solo che il file esista e non sia vuoto: non si legge mai.\nconst dim = f => { try { return fs.statSync(path.join(CARTELLA, f)).size; } catch (e) { return 0; } };\nconst agente = dim('agente.py') > 0 ? path.join(CARTELLA, 'agente.py') : '';\nconst auto = config.passaggio_api !== false, soglia = Number(config.soglia_piano) || 90;\n// scelta automatica del modello: lavori per modello e quanto si \u00e8 risparmiato rispetto a fare tutto con il modello di punta\nconst scelta = config.scelta_modello !== false;\nconst punta = config.modello_punta || 'claude-opus-5-5', pp = (config.prezzi_per_milione || {})[punta];\nconst perModello = {};\nlet risparmio = 0;\nfor (const l of lavori) {\n  const m = perModello[l.modello] || (perModello[l.modello] = { lavori: 0, costo: 0 });\n  m.lavori++; m.costo += l.costo;\n  if (pp && l.modello !== punta && l.u.some(x => x > 0)) {\n    const comePunta = (l.u[0] * pp.entrata + l.u[1] * pp.uscita + l.u[2] * pp.cache_scritta + l.u[3] * pp.cache_letta) / 1e6;\n    risparmio += Math.max(0, comePunta - l.costo);\n  }\n}\nprocess.stdout.write(JSON.stringify({\n  crediti: config.crediti, speso, lavori: lavori.length, prezzi: config.prezzi_per_milione, ricarica: config.ricarica,\n  presente, chiave: dim('chiave.txt') > 10, agente, auto, soglia, scelta, perModello, risparmio,\n  ultimi: lavori.slice(-5).reverse().map(({ u, ...x }) => x),\n}));\n"
// gli altri strumenti (Codex, Gemini, Qwen, Kimi…) e i prezzi di tutti i fornitori: generato da strumenti/genera-altri.js
const ALTRI_JS = "// Lettori degli altri strumenti (da vscode/src) e strumenti/altri.js, impacchettati da strumenti/genera-altri.js. Non modificare qui.\n'use strict';\nconst __m = {}, __c = {}, __req = require;\nfunction __r(n) {\n  if (!n.startsWith('./')) return __req(n);\n  n = n.slice(2).replace(/\\.js$/, '');\n  if (__c[n]) return __c[n].exports;\n  const module = { exports: {} }; __c[n] = module;\n  __m[n](module, module.exports, __r);\n  return module.exports;\n}\n__m[\"altri\"] = function (module, exports, require) {\n// Readers for Continue and Aider. Formats checked against the official source code only (not on real files).\r\n//   Continue  github.com/continuedev/continue core/data/log.ts: ~/.continue/dev_data/0.2.0/tokensGenerated.jsonl\r\n//             one line per model call { timestamp, model, provider, promptTokens, generatedTokens } (counted by Continue's own\r\n//             tokenizer; no cache, no session). chatInteraction.jsonl holds the chat text and is never opened.\r\n//   Aider     github.com/Aider-AI/aider io.py + base_coder.py: .aider.chat.history.md in each project (git root):\r\n//             \"# aider chat started at 2026-10-26 09:12:03\", \"> Model: <name> with \u2026\", \"#### <message>\",\r\n//             \"> Tokens: 12k sent, 2.3k cache write, 8.1k cache hit, 512 received.\" Numbers like 2.3k / 1235k.\r\n//             Aider has no global usage log by default, so only the open project folders (and the ones in the\r\n//             \"folders\" setting, separated by ;) are read.\r\n'use strict';\r\nconst fs = require('fs'), path = require('path');\r\nconst { giorno, leggiRighe, aggiungiRichiesta, aggiungiMessaggio } = require('./comune');\r\n\r\nconst VERSIONE = 1;\r\nconst nuovaSessione = (id, titolo, progetto, modello) => ({ id, titolo, progetto, modello, messaggi: 0, richieste: 0, token: 0, u: [0, 0, 0, 0], scritti: 0, ultimo: 0, bloccata: false, giorni: {} });\r\n\r\n// ---------- Continue ----------\r\n// no sessions in the file: one row per model in the list\r\nfunction leggiContinue(radice, cacheIn) {\r\n  const cache = cacheIn && cacheIn.v === VERSIONE ? cacheIn : { v: VERSIONE, inizio: 0, modelli: {} };\r\n  const file = path.join(radice, 'dev_data', '0.2.0', 'tokensGenerated.jsonl');\r\n  let st; try { st = fs.statSync(file); } catch (e) { return { cache, sessioni: [], limiti: [], avvisi: [] }; }\r\n  if (st.size < cache.inizio) { cache.inizio = 0; cache.modelli = {}; }\r\n  if (st.size > cache.inizio) {\r\n    const l = leggiRighe(file, cache.inizio);\r\n    for (const r of l.righe) {\r\n      let j; try { j = JSON.parse(r); } catch (e) { continue; }\r\n      if (!j || (j.eventName && j.eventName !== 'tokensGenerated')) continue;\r\n      const modello = String(j.model || '?').slice(0, 40);\r\n      const s = cache.modelli[modello] || (cache.modelli[modello] = nuovaSessione(`continue:${modello}`, modello, String(j.provider || ''), modello));\r\n      const ts = Date.parse(j.timestamp), g = isNaN(ts) ? null : giorno(ts);\r\n      if (!isNaN(ts) && ts > s.ultimo) s.ultimo = ts;\r\n      aggiungiRichiesta(s, g, Number(j.promptTokens) || 0, Number(j.generatedTokens) || 0, 0, 0);\r\n    }\r\n    cache.inizio = l.nuovoInizio;\r\n  }\r\n  return { cache, sessioni: Object.values(cache.modelli), limiti: [], avvisi: [] };\r\n}\r\n\r\n// ---------- Aider ----------\r\nconst numero = t => { const m = /^([\\d.]+)\\s*([kKmM]?)$/.exec(String(t).trim()); if (!m) return 0; return Math.round(parseFloat(m[1]) * (m[2].toLowerCase() === 'k' ? 1e3 : m[2].toLowerCase() === 'm' ? 1e6 : 1)); };\r\n\r\nfunction leggiAider(radice, cacheIn, extra) {\r\n  const cache = cacheIn && cacheIn.v === VERSIONE ? cacheIn : { v: VERSIONE, file: {} };\r\n  const cartelle = new Set(extra.progetti || []);\r\n  for (const c of String(radice || '').split(';').map(x => x.trim()).filter(Boolean)) cartelle.add(c);\r\n  const viste = new Set();\r\n  for (const c of cartelle) {\r\n    const file = path.join(c, '.aider.chat.history.md');\r\n    let st; try { st = fs.statSync(file); } catch (e) { continue; }\r\n    viste.add(file);\r\n    let f = cache.file[file];\r\n    if (!f || st.size < f.inizio) f = cache.file[file] = { inizio: 0, n: 0, sessioni: {}, attuale: '' };\r\n    if (st.size === f.inizio) continue;\r\n    const l = leggiRighe(file, f.inizio);\r\n    const progetto = path.basename(c.replace(/[\\\\/]+$/, ''));\r\n    for (const r of l.righe) {\r\n      const inizio = /^# aider chat started at (\\d{4})-(\\d{2})-(\\d{2}) (\\d{2}):(\\d{2}):(\\d{2})/.exec(r);\r\n      if (inizio) {\r\n        const ts = new Date(+inizio[1], +inizio[2] - 1, +inizio[3], +inizio[4], +inizio[5], +inizio[6]).getTime();   // local time, as Aider writes it\r\n        f.n++; f.attuale = `aider:${require('crypto').createHash('md5').update(file).digest('hex').slice(0, 10)}:${f.n}`;\r\n        f.sessioni[f.attuale] = Object.assign(nuovaSessione(f.attuale, '', progetto, ''), { ultimo: ts, inizio: ts });\r\n        continue;\r\n      }\r\n      const s = f.sessioni[f.attuale];\r\n      if (!s) continue;\r\n      const g = giorno(s.inizio);\r\n      const modello = /^> (?:Main model|Model): (\\S+)/.exec(r);\r\n      if (modello) { s.modello = modello[1].slice(0, 40); continue; }\r\n      if (/^#### /.test(r)) { aggiungiMessaggio(s, g, Math.ceil((r.length - 5) / 4)); continue; }\r\n      const tok = /Tokens: ([\\d.]+[kKmM]?) sent(?:, ([\\d.]+[kKmM]?) cache write)?(?:, ([\\d.]+[kKmM]?) cache hit)?, ([\\d.]+[kKmM]?) received/.exec(r);\r\n      if (tok) {\r\n        const inviati = numero(tok[1]), cw = tok[2] ? numero(tok[2]) : 0, cr = tok[3] ? numero(tok[3]) : 0;\r\n        // \"sent\" already contains the cache writes\r\n        aggiungiRichiesta(s, g, Math.max(0, inviati - cw), numero(tok[4]), cw, cr);\r\n      }\r\n    }\r\n    f.inizio = l.nuovoInizio;\r\n    f.mtime = st.mtimeMs;\r\n  }\r\n  for (const k of Object.keys(cache.file)) if (!viste.has(k)) delete cache.file[k];\r\n  const sessioni = [];\r\n  for (const f of Object.values(cache.file)) for (const s of Object.values(f.sessioni)) {\r\n    if (!s.richieste && !s.messaggi) continue;\r\n    const { inizio, ...resto } = s;\r\n    sessioni.push(resto);\r\n  }\r\n  return { cache, sessioni, limiti: [], avvisi: [] };\r\n}\r\n\r\nmodule.exports = { leggiContinue, leggiAider };\r\n\n};\n__m[\"codex\"] = function (module, exports, require) {\n// OpenAI Codex CLI reader: counts messages and tokens from ~/.codex/sessions/**/rollout-*.jsonl\r\n// (and archived_sessions/), including old rollouts that Codex compresses to .jsonl.zst.\r\n// Format checked against the official source code (github.com/openai/codex, codex-rs/history + protocol):\r\n//   every line is { \"timestamp\", \"type\", \"payload\" } with type\r\n//   - \"session_meta\"        payload { id, timestamp, cwd, ... }\r\n//   - \"turn_context\"        payload { model, cwd, ... }\r\n//   - \"token_usage_record\"  payload { response_id, usage: TokenUsage, ... }    (one per model reply, newer Codex)\r\n//   - \"event_msg\"           payload { type: \"token_count\", info: { total_token_usage, last_token_usage }, rate_limits }\r\n//                           payload { type: \"user_message\", message }           (only the length is used)\r\n//   TokenUsage = { input_tokens (includes cached_input_tokens), cached_input_tokens, cache_write_input_tokens?,\r\n//                  output_tokens (includes reasoning_output_tokens), reasoning_output_tokens, total_tokens }\r\n// Thread names come from ~/.codex/session_index.jsonl ({ id, thread_name, updated_at }) when present.\r\n'use strict';\r\nconst fs = require('fs'), path = require('path'), zlib = require('zlib');\r\nconst { giorno, leggiRighe, fileConFine, aggiungiRichiesta, aggiungiMessaggio } = require('./comune');\r\n\r\nconst VERSIONE = 1;\r\nconst vuota = () => ({ messaggi: 0, richieste: 0, token: 0, u: [0, 0, 0, 0], scritti: 0, giorni: {} });\r\n\r\nfunction leggiCodex(radice, cacheIn) {\r\n  const cache = cacheIn && cacheIn.v === VERSIONE ? cacheIn : { v: VERSIONE, file: {} };\r\n  const avvisi = [];\r\n  const zstd = typeof zlib.zstdDecompressSync === 'function';\r\n  const elenco = [...fileConFine(path.join(radice, 'sessions'), ['.jsonl', '.jsonl.zst']), ...fileConFine(path.join(radice, 'archived_sessions'), ['.jsonl', '.jsonl.zst'])]\r\n    .filter(p => path.basename(p).startsWith('rollout-'))\r\n    // oldest first (the name starts with the creation time), so an original thread is counted before its forks\r\n    .sort((a, b) => (path.basename(a) < path.basename(b) ? -1 : path.basename(a) > path.basename(b) ? 1 : 0));\r\n  const visti = new Set(elenco);\r\n  for (const k of Object.keys(cache.file)) if (!visti.has(k)) delete cache.file[k];\r\n  // replies already counted in any file (a forked thread copies the history of the original one)\r\n  const risposte = new Set();\r\n  for (const f of Object.values(cache.file)) for (const id of f.risposte || []) risposte.add(id);\r\n  let saltati = 0;\r\n\r\n  for (const file of elenco) {\r\n    let st; try { st = fs.statSync(file); } catch (e) { continue; }\r\n    const compresso = file.endsWith('.zst');\r\n    let f = cache.file[file];\r\n    const nuovo = () => ({ inizio: 0, dim: 0, mtime: 0, id: '', progetto: '', modello: '', primo: 0, ultimo: 0, rec: vuota(), tc: vuota(), msg: vuota(), totale: -1, risposte: [], limiti: null });\r\n    if (!f) f = cache.file[file] = nuovo();\r\n    if (compresso) {\r\n      if (f.dim === st.size && f.mtime === st.mtimeMs) continue;\r\n      if (!zstd) { saltati++; continue; }\r\n      for (const id of f.risposte) risposte.delete(id);\r\n      f = cache.file[file] = nuovo();\r\n    } else {\r\n      if (st.size < f.inizio) { for (const id of f.risposte) risposte.delete(id); f = cache.file[file] = nuovo(); }\r\n      if (st.size === f.inizio) { f.mtime = st.mtimeMs; continue; }\r\n    }\r\n    f.mtime = st.mtimeMs; f.dim = st.size;\r\n    let righe;\r\n    try {\r\n      if (compresso) { righe = zlib.zstdDecompressSync(fs.readFileSync(file)).toString('utf8').split('\\n'); f.inizio = st.size; }\r\n      else { const l = leggiRighe(file, f.inizio); righe = l.righe; f.inizio = l.nuovoInizio; }\r\n    } catch (e) { continue; }\r\n    if (!f.id) { const m = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(path.basename(file)); f.id = m ? m[1] : path.basename(file); }\r\n    for (const r of righe) {\r\n      if (!r) continue;\r\n      let j; try { j = JSON.parse(r); } catch (e) { continue; }\r\n      const p = j && j.payload;\r\n      if (!p || typeof j.type !== 'string') continue;\r\n      const ts = j.timestamp ? Date.parse(j.timestamp) : NaN;\r\n      const g = isNaN(ts) ? null : giorno(ts);\r\n      if (!isNaN(ts)) { if (!f.primo || ts < f.primo) f.primo = ts; if (ts > f.ultimo) f.ultimo = ts; }\r\n      if (j.type === 'session_meta') {\r\n        if (p.id && !f.metaId) f.metaId = String(p.id);\r\n        if (p.cwd && !f.progetto) f.progetto = path.basename(String(p.cwd).replace(/[\\\\/]+$/, ''));\r\n      } else if (j.type === 'turn_context') {\r\n        if (p.model) f.modello = String(p.model).slice(0, 40);\r\n        if (p.cwd && !f.progetto) f.progetto = path.basename(String(p.cwd).replace(/[\\\\/]+$/, ''));\r\n      } else if (j.type === 'token_usage_record' && p.usage) {\r\n        const id = p.response_id ? String(p.response_id) : '';\r\n        if (id && risposte.has(id)) continue;\r\n        if (id) { risposte.add(id); f.risposte.push(id); }\r\n        aggiungi(f.rec, g, p.usage);\r\n      } else if (j.type === 'event_msg' && p.type === 'token_count') {\r\n        if (p.rate_limits && !isNaN(ts)) f.limiti = { ts, primary: finestra(p.rate_limits.primary, ts), secondary: finestra(p.rate_limits.secondary, ts) };\r\n        const info = p.info;\r\n        if (!info || !info.last_token_usage) continue;\r\n        const tot = info.total_token_usage ? Number(info.total_token_usage.total_tokens) || 0 : -2;\r\n        if (tot === f.totale) continue;   // the same count is repeated when nothing new happened\r\n        f.totale = tot;\r\n        aggiungi(f.tc, g, info.last_token_usage);\r\n      } else if (j.type === 'event_msg' && p.type === 'user_message') {\r\n        if (p.kind && p.kind !== 'plain') continue;   // older Codex: instructions and environment context\r\n        const t = typeof p.message === 'string' ? p.message : '';\r\n        if (/^\\s*</.test(t)) continue;\r\n        aggiungiMessaggio(f.msg, g, Math.ceil(t.length / 4));   // only the length is used, the text is not kept\r\n      }\r\n    }\r\n  }\r\n  if (saltati) avvisi.push({ chiave: 'codexZst', n: saltati });\r\n\r\n  // thread names, if Codex saved any\r\n  const nomi = {};\r\n  try {\r\n    for (const r of fs.readFileSync(path.join(radice, 'session_index.jsonl'), 'utf8').split('\\n')) {\r\n      try { const j = JSON.parse(r); if (j && j.id && j.thread_name) nomi[j.id] = String(j.thread_name).slice(0, 80); } catch (e) { /* next line */ }\r\n    }\r\n  } catch (e) { /* no index */ }\r\n\r\n  const sessioni = [];\r\n  let limiti = null;\r\n  for (const f of Object.values(cache.file)) {\r\n    // newer Codex writes one record per reply; older Codex only the running token_count\r\n    const base = f.rec.richieste > 0 ? f.rec : f.tc;\r\n    if (!base.richieste && !f.msg.messaggi) continue;\r\n    const giorni = {};\r\n    for (const [k, v] of Object.entries(base.giorni)) giorni[k] = v.slice();\r\n    for (const [k, v] of Object.entries(f.msg.giorni)) { const x = giorni[k] || (giorni[k] = [0, 0, 0, 0, 0, 0, 0, 0]); x[1] += v[1]; x[7] += v[7]; }\r\n    const id = f.metaId || f.id;\r\n    const pieno = w => w && w.used_percent >= 100 && (!w.resets_at || w.resets_at * 1000 > Date.now());\r\n    sessioni.push({\r\n      id, fonte: 'codex', titolo: nomi[id] || nomi[f.id] || '', progetto: f.progetto || '', modello: f.modello || '',\r\n      messaggi: f.msg.messaggi, richieste: base.richieste, token: base.token, u: base.u.slice(), scritti: f.msg.scritti,\r\n      ultimo: Math.max(f.ultimo, f.mtime || 0), bloccata: !!(f.limiti && (pieno(f.limiti.primary) || pieno(f.limiti.secondary))), giorni,\r\n    });\r\n    if (f.limiti && (!limiti || f.limiti.ts > limiti.ts)) limiti = f.limiti;\r\n  }\r\n  const elencoLimiti = [];\r\n  if (limiti) for (const w of [limiti.primary, limiti.secondary]) if (w) elencoLimiti.push({ fonte: 'codex', minuti: w.window_minutes, percento: w.used_percent, azzera: w.resets_at ? w.resets_at * 1000 : 0, letto: limiti.ts });\r\n  return { cache, sessioni, limiti: elencoLimiti, avvisi };\r\n}\r\n\r\n// Codex TokenUsage \u2192 the four numbers used by the panel (new input, output, cache write, cache read)\r\nfunction aggiungi(s, g, u) {\r\n  const entrata = Number(u.input_tokens) || 0, letti = Number(u.cached_input_tokens) || 0, scritti = Number(u.cache_write_input_tokens) || 0;\r\n  aggiungiRichiesta(s, g, Math.max(0, entrata - letti - scritti), Number(u.output_tokens) || 0, scritti, letti);\r\n}\r\n\r\n// a rate-limit window with an absolute reset time (older Codex wrote resets_in_seconds)\r\nfunction finestra(w, ts) {\r\n  if (!w || typeof w.used_percent !== 'number') return null;\r\n  const azzera = typeof w.resets_at === 'number' ? w.resets_at : typeof w.resets_in_seconds === 'number' ? Math.round(ts / 1000 + w.resets_in_seconds) : 0;\r\n  return { used_percent: w.used_percent, window_minutes: typeof w.window_minutes === 'number' ? w.window_minutes : 0, resets_at: azzera };\r\n}\r\n\r\nmodule.exports = { leggiCodex };\r\n\n};\n__m[\"comune\"] = function (module, exports, require) {\n// Helpers shared by the readers.\r\n// Common session shape returned by every reader:\r\n//   { id, fonte: 'claude' | 'codex', titolo, progetto, modello, messaggi, richieste, token,\r\n//     u: [input, output, cacheWrite, cacheRead], scritti, ultimo (ms), bloccata,\r\n//     giorni: { 'YYYY-MM-DD': [token, messages, requests, input, output, cacheWrite, cacheRead, written] } }\r\n'use strict';\r\nconst fs = require('fs'), path = require('path');\r\n\r\nconst due = n => String(n).padStart(2, '0');\r\n// local calendar day of a timestamp, e.g. \"2026-10-26\"\r\nconst giorno = ts => { const d = new Date(ts); return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`; };\r\n\r\n// all files under dir whose name ends with one of the suffixes\r\nfunction fileConFine(dir, fini, out = []) {\r\n  let voci; try { voci = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }\r\n  for (const v of voci) {\r\n    const p = path.join(dir, v.name);\r\n    if (v.isDirectory()) fileConFine(p, fini, out);\r\n    else if (fini.some(f => v.name.endsWith(f))) out.push(p);\r\n  }\r\n  return out;\r\n}\r\n\r\n// complete lines from byte position `da` to the end of the file\r\nfunction leggiRighe(file, da) {\r\n  const fd = fs.openSync(file, 'r');\r\n  try {\r\n    const dim = fs.fstatSync(fd).size, pezzi = [];\r\n    let pos = da;\r\n    const buf = Buffer.alloc(4 * 1024 * 1024);\r\n    while (pos < dim) { const n = fs.readSync(fd, buf, 0, Math.min(buf.length, dim - pos), pos); if (!n) break; pezzi.push(Buffer.from(buf.subarray(0, n))); pos += n; }\r\n    const tutto = Buffer.concat(pezzi), fine = tutto.lastIndexOf(10);   // only complete lines\r\n    if (fine < 0) return { righe: [], nuovoInizio: da };\r\n    return { righe: tutto.subarray(0, fine).toString('utf8').split('\\n'), nuovoInizio: da + fine + 1 };\r\n  } finally { fs.closeSync(fd); }\r\n}\r\n\r\nconst nuovoGiorno = () => [0, 0, 0, 0, 0, 0, 0, 0];\r\n\r\n// one model reply: adds its tokens to the session and to its day\r\nfunction aggiungiRichiesta(s, g, input, output, cw, cr) {\r\n  const tot = input + output + cw + cr;\r\n  s.richieste++; s.token += tot;\r\n  s.u[0] += input; s.u[1] += output; s.u[2] += cw; s.u[3] += cr;\r\n  if (g) {\r\n    const x = s.giorni[g] || (s.giorni[g] = nuovoGiorno());\r\n    x[0] += tot; x[2]++; x[3] += input; x[4] += output; x[5] += cw; x[6] += cr;\r\n  }\r\n}\r\n\r\n// one message written by the person: only an estimate of its tokens is kept, never the text\r\nfunction aggiungiMessaggio(s, g, stima) {\r\n  s.messaggi++; s.scritti += stima;\r\n  if (g) { const x = s.giorni[g] || (s.giorni[g] = nuovoGiorno()); x[1]++; x[7] += stima; }\r\n}\r\n\r\nmodule.exports = { giorno, fileConFine, leggiRighe, nuovoGiorno, aggiungiRichiesta, aggiungiMessaggio };\r\n\n};\n__m[\"editori\"] = function (module, exports, require) {\n// Readers for AI tools that live inside the editor: Cline and Roo Code (in VS Code, Cursor, Windsurf\u2026), plus the Cline CLI / SDK.\r\n// Formats checked against the official source code only (not on real files):\r\n//   Cline legacy  github.com/cline/cline apps/vscode (v4.1.25): <globalStorage>/saoudrizwan.claude-dev/tasks/<id>/ui_messages.json\r\n//                 api_req_started.text = JSON { tokensIn (without cache), tokensOut, cacheWrites, cacheReads, cost, request\u2026 }, modelInfo { modelId }\r\n//   Cline SDK     ~/.cline/data/sessions/<id>/<id>.messages.json { messages: [{ role, ts, modelInfo { id }, metrics { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens } }] }\r\n//   Roo Code      github.com/RooCodeInc/Roo-Code (archived 2026-05-15): <globalStorage>/rooveterinaryinc.roo-cline/tasks/<id>/ui_messages.json\r\n//                 same api_req_started, but tokensIn INCLUDES the cache; history_item.json { workspace }; no model id is saved\r\n// These files also contain the text of the chat: it is parsed in memory and dropped, only numbers are kept.\r\n'use strict';\r\nconst fs = require('fs'), path = require('path');\r\nconst { giorno, aggiungiRichiesta, aggiungiMessaggio } = require('./comune');\r\n\r\nconst VERSIONE = 1;\r\nconst nuovaSessione = (id, progetto) => ({ id, titolo: '', progetto: progetto ? path.basename(String(progetto).replace(/[\\\\/]+$/, '')) : '', modello: '', messaggi: 0, richieste: 0, token: 0, u: [0, 0, 0, 0], scritti: 0, ultimo: 0, bloccata: false, giorni: {} });\r\nconst num = v => Number(v) || 0;\r\nconst sottocartelle = d => { try { return fs.readdirSync(d, { withFileTypes: true }).filter(x => x.isDirectory()).map(x => path.join(d, x.name)); } catch (e) { return []; } };\r\n\r\n// one task folder of Cline or Roo Code \u2192 numbers of that task\r\nfunction compito(cartella, roo, progetto) {\r\n  const s = nuovaSessione(path.basename(cartella), progetto);\r\n  let messaggi; try { messaggi = JSON.parse(fs.readFileSync(path.join(cartella, 'ui_messages.json'), 'utf8')); } catch (e) { return null; }\r\n  if (!Array.isArray(messaggi)) return null;\r\n  for (const m of messaggi) {\r\n    if (!m || m.type !== 'say') continue;\r\n    const ts = num(m.ts), g = ts ? giorno(ts) : null;\r\n    if (ts > s.ultimo) s.ultimo = ts;\r\n    if (m.modelInfo && m.modelInfo.modelId) s.modello = String(m.modelInfo.modelId).slice(0, 40);\r\n    if (m.say === 'api_req_started' && typeof m.text === 'string') {\r\n      let x; try { x = JSON.parse(m.text); } catch (e) { continue; }\r\n      const entrata = num(x.tokensIn), cw = num(x.cacheWrites), cr = num(x.cacheReads);\r\n      if (!entrata && !num(x.tokensOut) && !cw && !cr) continue;\r\n      aggiungiRichiesta(s, g, roo ? Math.max(0, entrata - cw - cr) : entrata, num(x.tokensOut), cw, cr);\r\n    } else if (m.say === 'task' || m.say === 'user_feedback') {\r\n      aggiungiMessaggio(s, g, Math.ceil((typeof m.text === 'string' ? m.text.length : 0) / 4));\r\n    }\r\n  }\r\n  return s;\r\n}\r\n\r\n// shared logic: reads only the task folders whose ui_messages.json changed\r\nfunction leggiCompiti(cartelleTask, cacheIn, roo, progettoDi) {\r\n  const cache = cacheIn && cacheIn.v === VERSIONE ? cacheIn : { v: VERSIONE, task: {} };\r\n  const viste = new Set();\r\n  for (const c of cartelleTask) {\r\n    const f = path.join(c, 'ui_messages.json');\r\n    let st; try { st = fs.statSync(f); } catch (e) { continue; }\r\n    viste.add(c);\r\n    const vecchio = cache.task[c];\r\n    if (vecchio && vecchio.mtime === st.mtimeMs && vecchio.dim === st.size) continue;\r\n    const s = compito(c, roo, progettoDi(c));\r\n    cache.task[c] = { mtime: st.mtimeMs, dim: st.size, s };\r\n  }\r\n  for (const k of Object.keys(cache.task)) if (!viste.has(k)) delete cache.task[k];\r\n  const sessioni = Object.values(cache.task).map(t => t.s).filter(s => s && (s.richieste || s.messaggi));\r\n  return { cache, sessioni };\r\n}\r\n\r\n// ---------- Cline ----------\r\nfunction leggiCline(radice, cacheIn, extra) {\r\n  const cache = cacheIn && cacheIn.v === VERSIONE ? cacheIn : { v: VERSIONE };\r\n  // the extension, in every editor on this computer\r\n  const cartelle = (extra.archivi || []).map(a => path.join(a, 'saoudrizwan.claude-dev'));\r\n  const progetti = {};\r\n  for (const c of cartelle) {\r\n    try {\r\n      for (const h of JSON.parse(fs.readFileSync(path.join(c, 'state', 'taskHistory.json'), 'utf8'))) {\r\n        if (h && h.id && h.cwdOnTaskInitialization) progetti[h.id] = h.cwdOnTaskInitialization;   // the \"task\" field is the prompt: not read\r\n      }\r\n    } catch (e) { /* no history */ }\r\n  }\r\n  const r = leggiCompiti(cartelle.flatMap(c => sottocartelle(path.join(c, 'tasks'))), cache.legacy, false, c => progetti[path.basename(c)]);\r\n  cache.legacy = r.cache;\r\n  // the Cline CLI / SDK\r\n  const sdk = leggiClineSdk(radice, cache.sdk);\r\n  cache.sdk = sdk.cache;\r\n  return { cache, sessioni: [...r.sessioni, ...sdk.sessioni], limiti: [], avvisi: [] };\r\n}\r\n\r\nfunction leggiClineSdk(radice, cacheIn) {\r\n  const cache = cacheIn && cacheIn.v === VERSIONE ? cacheIn : { v: VERSIONE, file: {} };\r\n  const viste = new Set();\r\n  for (const c of sottocartelle(path.join(radice, 'sessions'))) {\r\n    const id = path.basename(c), f = path.join(c, `${id}.messages.json`);\r\n    let st; try { st = fs.statSync(f); } catch (e) { continue; }\r\n    viste.add(f);\r\n    const v = cache.file[f];\r\n    if (v && v.mtime === st.mtimeMs && v.dim === st.size) continue;\r\n    let progetto = '';\r\n    try { const m = JSON.parse(fs.readFileSync(path.join(c, `${id}.json`), 'utf8')); progetto = m.cwd || m.workspace_root || m.workspaceRoot || ''; } catch (e) { /* no manifest */ }\r\n    const s = nuovaSessione(id, progetto);\r\n    try {\r\n      const j = JSON.parse(fs.readFileSync(f, 'utf8'));\r\n      for (const m of Array.isArray(j.messages) ? j.messages : []) {\r\n        const ts = num(m.ts) || Date.parse(m.ts) || 0, g = ts ? giorno(ts) : null;\r\n        if (ts > s.ultimo) s.ultimo = ts;\r\n        if (m.role === 'user') {\r\n          const t = typeof m.content === 'string' ? m.content : Array.isArray(m.content) ? m.content.map(b => (b && typeof b.text === 'string' ? b.text : '')).join('') : '';\r\n          if (t) aggiungiMessaggio(s, g, Math.ceil(t.length / 4));\r\n        } else if (m.metrics) {\r\n          const x = m.metrics;\r\n          aggiungiRichiesta(s, g, num(x.inputTokens), num(x.outputTokens), num(x.cacheWriteTokens), num(x.cacheReadTokens));\r\n          if (m.modelInfo && m.modelInfo.id) s.modello = String(m.modelInfo.id).slice(0, 40);\r\n        }\r\n      }\r\n    } catch (e) { continue; }\r\n    cache.file[f] = { mtime: st.mtimeMs, dim: st.size, s };\r\n  }\r\n  for (const k of Object.keys(cache.file)) if (!viste.has(k)) delete cache.file[k];\r\n  return { cache, sessioni: Object.values(cache.file).map(x => x.s).filter(s => s.richieste || s.messaggi) };\r\n}\r\n\r\n// ---------- Roo Code ----------\r\nfunction leggiRoo(radice, cacheIn, extra) {\r\n  const cartelle = (extra.archivi || []).map(a => path.join(a, 'rooveterinaryinc.roo-cline'));\r\n  if (radice) cartelle.push(radice);   // the \"roo-cline.customStoragePath\" setting, if the person set it in \"folders\"\r\n  const r = leggiCompiti(cartelle.flatMap(c => sottocartelle(path.join(c, 'tasks'))), cacheIn, true, c => {\r\n    try { return JSON.parse(fs.readFileSync(path.join(c, 'history_item.json'), 'utf8')).workspace || ''; } catch (e) { return ''; }\r\n  });\r\n  return { cache: r.cache, sessioni: r.sessioni, limiti: [], avvisi: [] };\r\n}\r\n\r\nmodule.exports = { leggiCline, leggiRoo };\r\n\n};\n__m[\"fonti\"] = function (module, exports, require) {\n// The list of tools the panel can read. Each one has its own switch in the settings\r\n// (pannelloUtilizzo.sources.<id>), its own color and its own button in the selector.\r\n// \"fornitore\" is the API provider (for credits and price links); '*' = the tool can use any provider.\r\n// \"verificato\" says how the file format was checked: 'dati' = on real files, 'sorgente' = only on the official source code.\r\n'use strict';\r\nconst path = require('path'), os = require('os');\r\n\r\nconst casa = (...p) => path.join(os.homedir(), ...p);\r\n\r\nconst FONTI = [\r\n  { id: 'claude', nome: 'Claude Code', breve: 'Claude', colore: '#3b82f6', fornitore: 'anthropic', verificato: 'dati',\r\n    cartella: () => casa('.claude', 'projects'), modulo: './claude', funzione: 'leggiClaude' },\r\n  { id: 'codex', nome: 'OpenAI Codex', breve: 'Codex', colore: '#10b981', fornitore: 'openai', verificato: 'sorgente',\r\n    cartella: () => casa('.codex'), modulo: './codex', funzione: 'leggiCodex' },\r\n  { id: 'gemini', nome: 'Gemini CLI', breve: 'Gemini', colore: '#f59e0b', fornitore: 'google', verificato: 'sorgente',\r\n    cartella: () => casa('.gemini'), modulo: './gemini', funzione: 'leggiGemini' },\r\n  { id: 'qwen', nome: 'Qwen Code', breve: 'Qwen', colore: '#8b5cf6', fornitore: 'alibaba', verificato: 'sorgente',\r\n    cartella: () => casa('.qwen'), modulo: './qwen', funzione: 'leggiQwen' },\r\n  { id: 'kimi', nome: 'Kimi CLI', breve: 'Kimi', colore: '#ec4899', fornitore: 'moonshot', verificato: 'sorgente',\r\n    cartella: () => casa('.kimi'), modulo: './kimi', funzione: 'leggiKimi' },\r\n  { id: 'zcode', nome: 'ZCode (GLM)', breve: 'GLM', colore: '#06b6d4', fornitore: 'zhipu', verificato: 'sorgente',\r\n    cartella: () => casa('.zcode'), modulo: './sqlite', funzione: 'leggiZcode' },\r\n  { id: 'minimax', nome: 'MiniMax Code', breve: 'MiniMax', colore: '#ef4444', fornitore: 'minimax', verificato: 'sorgente',\r\n    cartella: () => casa('.minimax'), modulo: './sqlite', funzione: 'leggiMinimax' },\r\n  { id: 'opencode', nome: 'opencode', breve: 'opencode', colore: '#a3a3a3', fornitore: '*', verificato: 'sorgente',\r\n    cartella: () => casa('.local', 'share', 'opencode'), modulo: './sqlite', funzione: 'leggiOpencode' },\r\n  { id: 'kilo', nome: 'Kilo Code', breve: 'Kilo', colore: '#eab308', fornitore: '*', verificato: 'sorgente',\r\n    cartella: () => casa('.local', 'share', 'kilo'), modulo: './sqlite', funzione: 'leggiKilo' },\r\n  { id: 'cline', nome: 'Cline', breve: 'Cline', colore: '#14b8a6', fornitore: '*', verificato: 'sorgente',\r\n    cartella: () => casa('.cline', 'data'), modulo: './editori', funzione: 'leggiCline' },\r\n  { id: 'roo', nome: 'Roo Code', breve: 'Roo', colore: '#f97316', fornitore: '*', verificato: 'sorgente',\r\n    cartella: () => '', modulo: './editori', funzione: 'leggiRoo' },\r\n  { id: 'continue', nome: 'Continue', breve: 'Continue', colore: '#6366f1', fornitore: '*', verificato: 'sorgente',\r\n    cartella: () => casa('.continue'), modulo: './altri', funzione: 'leggiContinue' },\r\n  { id: 'aider', nome: 'Aider', breve: 'Aider', colore: '#84cc16', fornitore: '*', verificato: 'sorgente',\r\n    cartella: () => '', modulo: './altri', funzione: 'leggiAider' },\r\n];\r\n\r\nmodule.exports = { FONTI, casa };\r\n\n};\n__m[\"gemini\"] = function (module, exports, require) {\n// Gemini CLI reader: ~/.gemini/tmp/<project>/chats/*.jsonl (and the older single-JSON session-*.json).\r\n// Format checked against the official source code only (github.com/google-gemini/gemini-cli, commit cd1b45c,\r\n// packages/core/src/services/chatRecordingTypes.ts + chatRecordingService.ts), NOT on real files:\r\n//   first line   { sessionId, projectHash, startTime, lastUpdated, kind? }\r\n//   message      { id, timestamp, type: 'user' | 'gemini' | 'info' | ..., content, model?, tokens?: { input, output, cached, thoughts?, tool?, total } }\r\n//   updates      { \"$set\": { ... } }  ($set.messages replaces the whole list), { \"$rewindTo\": id }, { \"$patch\": ... }\r\n//   The same message id can be written again (tokens arrive later): the last line wins.\r\n//   input already includes cached; thoughts are billed as output and are not inside output.\r\n// Only numbers are kept: for messages written by the person, only the length of their text.\r\n'use strict';\r\nconst fs = require('fs'), path = require('path');\r\nconst { giorno, leggiRighe, fileConFine, aggiungiRichiesta, aggiungiMessaggio } = require('./comune');\r\n\r\nconst VERSIONE = 1;\r\n\r\nfunction leggiGemini(radice, cacheIn) {\r\n  const cache = cacheIn && cacheIn.v === VERSIONE ? cacheIn : { v: VERSIONE, file: {} };\r\n  const tmp = path.join(radice, 'tmp');\r\n  const elenco = fileConFine(tmp, ['.jsonl', '.json']).filter(p => p.split(path.sep).includes('chats'));\r\n  const visti = new Set(elenco);\r\n  for (const k of Object.keys(cache.file)) if (!visti.has(k)) delete cache.file[k];\r\n\r\n  for (const file of elenco) {\r\n    let st; try { st = fs.statSync(file); } catch (e) { continue; }\r\n    const nuovo = () => ({ inizio: 0, mtime: 0, dim: 0, sessione: '', sub: false, m: {} });\r\n    let f = cache.file[file] || (cache.file[file] = nuovo());\r\n    if (file.endsWith('.json')) {\r\n      // older format: one JSON document rewritten as a whole\r\n      if (f.mtime === st.mtimeMs && f.dim === st.size) continue;\r\n      f = cache.file[file] = nuovo();\r\n      f.mtime = st.mtimeMs; f.dim = st.size;\r\n      try {\r\n        const j = JSON.parse(fs.readFileSync(file, 'utf8'));\r\n        f.sessione = String(j.sessionId || ''); f.sub = j.kind === 'subagent';\r\n        for (const m of Array.isArray(j.messages) ? j.messages : []) ricorda(f, m);\r\n      } catch (e) { /* half-written: next time */ }\r\n      continue;\r\n    }\r\n    if (st.size < f.inizio) f = cache.file[file] = nuovo();\r\n    f.mtime = st.mtimeMs;\r\n    if (st.size === f.inizio) continue;\r\n    let letto; try { letto = leggiRighe(file, f.inizio); } catch (e) { continue; }\r\n    for (const r of letto.righe) {\r\n      if (!r) continue;\r\n      let j; try { j = JSON.parse(r); } catch (e) { continue; }\r\n      if (!j || typeof j !== 'object') continue;\r\n      if (j.$rewindTo != null) { riavvolgi(f, String(j.$rewindTo)); continue; }\r\n      if (j.$set) { if (Array.isArray(j.$set.messages)) { f.m = {}; for (const m of j.$set.messages) ricorda(f, m); } continue; }\r\n      if (j.$patch) continue;\r\n      if (j.sessionId && !j.type) { f.sessione = String(j.sessionId); if (j.kind === 'subagent') f.sub = true; continue; }\r\n      ricorda(f, j);\r\n    }\r\n    f.inizio = letto.nuovoInizio;\r\n  }\r\n\r\n  // project names: each project folder keeps its full path in .project_root\r\n  const progetti = {};\r\n  const progettoDi = file => {\r\n    const cartella = file.slice(0, file.lastIndexOf(`${path.sep}chats${path.sep}`));\r\n    if (progetti[cartella] == null) {\r\n      let nome = path.basename(cartella);\r\n      try { const p = fs.readFileSync(path.join(cartella, '.project_root'), 'utf8').trim(); if (p) nome = path.basename(p.replace(/[\\\\/]+$/, '')); } catch (e) { /* the folder name is fine */ }\r\n      progetti[cartella] = nome;\r\n    }\r\n    return progetti[cartella];\r\n  };\r\n\r\n  const sessioni = {};\r\n  for (const [file, f] of Object.entries(cache.file)) {\r\n    const id = f.sessione || path.basename(file).replace(/\\.jsonl?$/, '');\r\n    const s = sessioni[id] || (sessioni[id] = { id, titolo: '', progetto: progettoDi(file), modello: '', messaggi: 0, richieste: 0, token: 0, u: [0, 0, 0, 0], scritti: 0, ultimo: 0, bloccata: false, giorni: {} });\r\n    for (const m of Object.values(f.m)) {\r\n      const ts = m[1], g = ts ? giorno(ts) : null;\r\n      if (ts > s.ultimo) s.ultimo = ts;\r\n      if (m[0] === 'u') { if (!f.sub) aggiungiMessaggio(s, g, Math.ceil(m[2] / 4)); continue; }\r\n      const [, , input, output, cached, thoughts, tool, modello] = m;\r\n      if (!input && !output && !cached) continue;   // reply still without its numbers\r\n      aggiungiRichiesta(s, g, Math.max(0, input - cached) + tool, output + thoughts, 0, cached);\r\n      if (modello) s.modello = modello;\r\n    }\r\n    s.ultimo = Math.max(s.ultimo, f.mtime || 0);\r\n  }\r\n  return { cache, sessioni: Object.values(sessioni).filter(s => s.richieste || s.messaggi), limiti: [], avvisi: [] };\r\n}\r\n\r\n// keeps only the numbers of one message: ['u', time, text length] or ['g', time, input, output, cached, thoughts, tool, model]\r\nfunction ricorda(f, m) {\r\n  if (!m || m.id == null) return;\r\n  const ts = m.timestamp ? Date.parse(m.timestamp) || 0 : 0;\r\n  if (m.type === 'user') {\r\n    const n = lunghezza(m.content);\r\n    if (n >= 0) f.m[String(m.id)] = ['u', ts, n];\r\n  } else if (m.type === 'gemini') {\r\n    const t = m.tokens || {};\r\n    const num = v => Number(v) || 0;\r\n    f.m[String(m.id)] = ['g', ts, num(t.input), num(t.output), num(t.cached), num(t.thoughts), num(t.tool), m.model ? String(m.model).slice(0, 40) : ''];\r\n  }\r\n}\r\n// { \"$rewindTo\": id }: that message and every later one are dropped\r\nfunction riavvolgi(f, id) {\r\n  const chiavi = Object.keys(f.m), i = chiavi.indexOf(id);\r\n  if (i < 0) return;\r\n  for (const k of chiavi.slice(i)) delete f.m[k];\r\n}\r\nfunction lunghezza(c) {\r\n  let t = '';\r\n  if (typeof c === 'string') t = c;\r\n  else if (Array.isArray(c)) t = c.map(p => (typeof p === 'string' ? p : p && typeof p.text === 'string' ? p.text : '')).join('');\r\n  else if (c && typeof c.text === 'string') t = c.text;\r\n  if (!t || /^\\s*</.test(t)) return -1;\r\n  return t.length;\r\n}\r\n\r\nmodule.exports = { leggiGemini };\r\n\n};\n__m[\"kimi\"] = function (module, exports, require) {\n// Kimi CLI reader (Moonshot AI): ~/.kimi/sessions/<md5 of work dir>/<session id>/wire.jsonl (and subagents/<id>/wire.jsonl).\r\n// Format checked against the official source code (github.com/MoonshotAI/kimi-cli, main, src/kimi_cli/wire/*.py, soul/context.py,\r\n// metadata.py). On this PC only a session without any model call exists, so the token part was NOT tried on real files.\r\n//   wire.jsonl: header { type: \"metadata\", protocol_version }, then { timestamp (epoch seconds), message: { type, payload } }\r\n//     StatusUpdate.payload.token_usage = { input_other, output, input_cache_read, input_cache_creation }   (one per step; may be null)\r\n//     TurnBegin = a message written by the person (only the length of user_input is used)\r\n//     SubagentEvent = a subagent's events copied into the parent: skipped here, the subagent's own wire.jsonl is counted instead\r\n//   context.jsonl \"_usage\" lines are the context size, not usage: never summed.\r\n//   ~/.kimi/kimi.json { work_dirs: [{ path, kaos, last_session_id }] } gives the project of each folder (md5 of path).\r\n//   The model is not written per session: default_model from ~/.kimi/config.toml (subagents: meta.json launch_spec.effective_model).\r\n// ~/.kimi/credentials is never opened.\r\n'use strict';\r\nconst fs = require('fs'), path = require('path'), crypto = require('crypto');\r\nconst { giorno, leggiRighe, fileConFine, aggiungiRichiesta, aggiungiMessaggio } = require('./comune');\r\n\r\nconst VERSIONE = 1;\r\n\r\nfunction leggiKimi(radice, cacheIn) {\r\n  const cache = cacheIn && cacheIn.v === VERSIONE ? cacheIn : { v: VERSIONE, file: {} };\r\n  const cartella = path.join(radice, 'sessions');\r\n  const elenco = fileConFine(cartella, ['wire.jsonl']).filter(p => path.basename(p) === 'wire.jsonl');\r\n  const visti = new Set(elenco);\r\n  for (const k of Object.keys(cache.file)) if (!visti.has(k)) delete cache.file[k];\r\n\r\n  // projects: md5(work dir) \u2192 folder name\r\n  const progetti = {};\r\n  try {\r\n    const meta = JSON.parse(fs.readFileSync(path.join(radice, 'kimi.json'), 'utf8'));\r\n    for (const w of Array.isArray(meta.work_dirs) ? meta.work_dirs : []) {\r\n      if (!w || typeof w.path !== 'string') continue;\r\n      const h = crypto.createHash('md5').update(w.path, 'utf8').digest('hex');\r\n      const nome = path.basename(w.path.replace(/[\\\\/]+$/, ''));\r\n      progetti[h] = nome;\r\n      if (w.kaos) progetti[`${w.kaos}_${h}`] = nome;\r\n    }\r\n  } catch (e) { /* folder names stay as they are */ }\r\n  let modelloBase = '';\r\n  try { const m = /^\\s*default_model\\s*=\\s*[\"']([^\"']+)[\"']/m.exec(fs.readFileSync(path.join(radice, 'config.toml'), 'utf8')); if (m) modelloBase = m[1].slice(0, 40); } catch (e) { /* unknown */ }\r\n\r\n  for (const file of elenco) {\r\n    let st; try { st = fs.statSync(file); } catch (e) { continue; }\r\n    const nuovo = () => ({ inizio: 0, mtime: 0, s: { messaggi: 0, richieste: 0, token: 0, u: [0, 0, 0, 0], scritti: 0, giorni: {} }, ultimo: 0 });\r\n    let f = cache.file[file] || (cache.file[file] = nuovo());\r\n    if (st.size < f.inizio) f = cache.file[file] = nuovo();\r\n    f.mtime = st.mtimeMs;\r\n    if (st.size === f.inizio) continue;\r\n    const sub = file.split(path.sep).includes('subagents');\r\n    let letto; try { letto = leggiRighe(file, f.inizio); } catch (e) { continue; }\r\n    for (const r of letto.righe) {\r\n      if (!r) continue;\r\n      let j; try { j = JSON.parse(r); } catch (e) { continue; }\r\n      const m = j && j.message;\r\n      if (!m || typeof m.type !== 'string') continue;\r\n      const ts = typeof j.timestamp === 'number' ? j.timestamp * 1000 : NaN, g = isNaN(ts) ? null : giorno(ts);\r\n      if (!isNaN(ts) && ts > f.ultimo) f.ultimo = ts;\r\n      const p = m.payload || {};\r\n      if (m.type === 'StatusUpdate' && p.token_usage) {\r\n        const u = p.token_usage, n = v => Number(v) || 0;\r\n        if (!n(u.input_other) && !n(u.output) && !n(u.input_cache_read) && !n(u.input_cache_creation)) continue;\r\n        aggiungiRichiesta(f.s, g, n(u.input_other), n(u.output), n(u.input_cache_creation), n(u.input_cache_read));\r\n      } else if (m.type === 'TurnBegin' && !sub) {\r\n        const t = p.user_input;\r\n        const n = typeof t === 'string' ? t.length : Array.isArray(t) ? t.reduce((x, b) => x + (b && typeof b.text === 'string' ? b.text.length : 0), 0) : 0;\r\n        aggiungiMessaggio(f.s, g, Math.ceil(n / 4));\r\n      }\r\n    }\r\n    f.inizio = letto.nuovoInizio;\r\n  }\r\n\r\n  // one session per main session folder; its subagents are added to it\r\n  const sessioni = {};\r\n  for (const [file, f] of Object.entries(cache.file)) {\r\n    const rel = path.relative(cartella, file).split(path.sep);   // <hash>/<session>/wire.jsonl or <hash>/<session>/subagents/<id>/wire.jsonl\r\n    if (rel.length < 3) continue;\r\n    const [hash, sid] = rel;\r\n    const s = sessioni[sid] || (sessioni[sid] = { id: sid, titolo: titolo(path.join(cartella, hash, sid)), progetto: progetti[hash] || '', modello: modelloBase, messaggi: 0, richieste: 0, token: 0, u: [0, 0, 0, 0], scritti: 0, ultimo: 0, bloccata: false, giorni: {} });\r\n    s.messaggi += f.s.messaggi; s.richieste += f.s.richieste; s.token += f.s.token; s.scritti += f.s.scritti;\r\n    for (let i = 0; i < 4; i++) s.u[i] += f.s.u[i];\r\n    for (const [k, v] of Object.entries(f.s.giorni)) { const x = s.giorni[k] || (s.giorni[k] = [0, 0, 0, 0, 0, 0, 0, 0]); for (let i = 0; i < 8; i++) x[i] += v[i]; }\r\n    s.ultimo = Math.max(s.ultimo, f.ultimo, f.mtime || 0);\r\n  }\r\n  return { cache, sessioni: Object.values(sessioni).filter(s => s.richieste || s.messaggi), limiti: [], avvisi: [] };\r\n}\r\n\r\n// the session title kept by Kimi in state.json (a title, not message text)\r\nfunction titolo(cartella) {\r\n  try { const j = JSON.parse(fs.readFileSync(path.join(cartella, 'state.json'), 'utf8')); return typeof j.title === 'string' ? j.title.slice(0, 80) : ''; } catch (e) { return ''; }\r\n}\r\n\r\nmodule.exports = { leggiKimi };\r\n\n};\n__m[\"prezzi\"] = function (module, exports, require) {\n// Official API prices (US dollars per 1 million tokens), read on the providers' own pricing pages on 2026-10-26.\r\n// Used for the table in \"Top up and what it costs\" and to estimate what the chats would cost if paid with the API.\r\n// Prices in the person's own configuration file always win over these.\r\n// Only the models whose id and price were read on the official page are here; uncertain ones are left out.\r\n'use strict';\r\n\r\nconst P = (entrata, uscita, cache_letta, cache_scritta, nota) => ({ entrata, uscita, cache_letta: cache_letta == null ? null : cache_letta, cache_scritta: cache_scritta == null ? null : cache_scritta, valuta: 'USD', nota: nota || '' });\r\n\r\nconst LISTINO = {\r\n  letto: '2026-10-26',\r\n  fornitori: {\r\n    anthropic: { nome: 'Anthropic', link: 'prezzi-anthropic', ricarica: 'ricarica-anthropic', modelli: {\r\n      'claude-fable-5-1': P(10, 50, 0.25, 12.5, 'cache write 5 min; 1 h: $20'),\r\n      'claude-opus-5-5': P(4, 20, 0.2, 5, 'cache write 5 min; 1 h: $8'),\r\n      'claude-sonnet-5-5': P(2, 10, 0.1, 2.5, 'cache write 5 min; 1 h: $4'),\r\n      'claude-haiku-5-5': P(0.1, 0.5, 0.01, 0.125, 'prompt > 100k: 0.50 / 2.50'),\r\n    } },\r\n    openai: { nome: 'OpenAI', link: 'prezzi-openai', ricarica: 'ricarica-openai', modelli: {\r\n      'gpt-6-astra': P(10, 50, 1, null, '> 272k input: 20 / 75'),\r\n      'gpt-6.1-sol': P(2, 10, 0.1, null, '> 272k input: 4 / 15'),\r\n      'gpt-6-sol': P(2, 10, 0.2, null, '> 272k input: 4 / 15'),\r\n      'gpt-6-luna': P(0.1, 0.5, 0.01, null, '> 272k input: 0.20 / 0.75'),\r\n      'gpt-5.5': P(5, 30, 0.5, null, '> 272k input: 10 / 45'),\r\n      'gpt-5.3-codex': P(1.75, 14, 0.175, null, ''),\r\n      'gpt-5.1': P(1.25, 10, 0.125, null, ''),\r\n      'gpt-5': P(1.25, 10, 0.125, null, ''),\r\n      'gpt-5-mini': P(0.25, 2, 0.025, null, ''),\r\n      'gpt-5-nano': P(0.05, 0.4, 0.005, null, ''),\r\n    } },\r\n    google: { nome: 'Google Gemini', link: 'prezzi-google', modelli: {\r\n      'gemini-4-argon': P(2, 10, 0.1, null, 'until 30.11.2026; from 1.12.2026: 4 / 20'),\r\n      'gemini-3.8-flash': P(0.75, 3.75, 0.075, null, 'from 1.1.2027: 1.50 / 7.50'),\r\n      'gemini-3.6-flash': P(0.75, 3.75, 0.075, null, ''),\r\n      'gemini-3.5-flash-lite': P(0.3, 2.5, 0.03, null, ''),\r\n      'gemini-3.1-pro-preview': P(2, 12, 0.2, null, '> 200k: 4 / 18'),\r\n      'gemini-2.5-pro': P(1.25, 10, 0.125, null, '> 200k: 2.50 / 15'),\r\n      'gemini-2.5-flash': P(0.3, 2.5, 0.03, null, ''),\r\n    } },\r\n    deepseek: { nome: 'DeepSeek', link: 'prezzi-deepseek', modelli: {\r\n      'deepseek-v4-pro': P(1.32, 3.96, 0.044, null, 'peak hours; off-peak half price'),\r\n      'deepseek-flash': P(0.3, 1.2, 0.006, null, 'off-peak half price; also deepseek-v4-flash'),\r\n      'deepseek-v4-flash': P(0.3, 1.2, 0.006, null, 'billed as deepseek-flash'),\r\n    } },\r\n    alibaba: { nome: 'Alibaba Qwen', link: 'prezzi-alibaba', modelli: {\r\n      'qwen3.8-max': P(2, 6, null, null, 'international (Singapore)'),\r\n      'qwen3.7-plus': P(0.4, 1.6, null, null, 'up to 256k; 256k\u20131M: 1.20 / 4.80'),\r\n      'qwen3.8-flash': P(0.15, 0.47, null, null, 'up to 1M'),\r\n      'qwen3-coder-flash': P(0.3, 1.5, null, null, '0\u201332k; up to 1.60 / 9.60 for 256k\u20131M'),\r\n    } },\r\n    moonshot: { nome: 'Moonshot Kimi', link: 'prezzi-moonshot', modelli: {\r\n      'kimi-k3.1-pro': P(2, 10, 0.2, 2, 'cache write 5 min; 1 h: $4'),\r\n      'kimi-k3': P(3, 15, 0.3, 3, 'cache write 5 min; 1 h: $6'),\r\n      'kimi-k2.7-code': P(0.95, 4, 0.19, null, 'K2 series retiring by end of 2026'),\r\n      'kimi-k2.6': P(0.95, 4, 0.16, null, 'K2 series retiring'),\r\n    } },\r\n    zhipu: { nome: 'Z.ai GLM', link: 'prezzi-zhipu', modelli: {\r\n      'glm-5.3': P(1.4, 4.4, 0.26, null, 'also glm-5.2 and glm-5.1'),\r\n      'glm-5': P(1, 3.2, 0.2, null, ''),\r\n      'glm-4.7': P(0.6, 2.2, 0.11, null, ''),\r\n      'glm-4.6': P(0.6, 2.2, 0.11, null, ''),\r\n      'glm-4.5': P(0.6, 2.2, 0.11, null, ''),\r\n      'glm-4.5-air': P(0.2, 1.1, 0.03, null, ''),\r\n    } },\r\n    minimax: { nome: 'MiniMax', link: 'prezzi-minimax', modelli: {\r\n      'MiniMax-M3': P(0.3, 1.2, 0.06, null, 'up to 512k; above: 0.60 / 2.40'),\r\n      'MiniMax-M3.1-Flash': P(0.15, 0.6, 0.015, null, ''),\r\n    } },\r\n    xai: { nome: 'xAI Grok', link: 'prezzi-xai', modelli: {\r\n      'grok-4.7': P(2, 6, 0.5, null, 'from 200k prompt: 4 / 12'),\r\n      'grok-4.3': P(1.25, 2.5, 0.2, null, 'from 200k: 2.50 / 5'),\r\n      'grok-build-0.1': P(1, 2, 0.2, null, 'from 200k: 2 / 4'),\r\n    } },\r\n  },\r\n};\r\n\r\n// the only pages the panel can open (in the normal browser, after a click)\r\nconst LINK = {\r\n  'prezzi-anthropic': 'https://platform.claude.com/docs/en/about-claude/pricing',\r\n  'prezzi-openai': 'https://developers.openai.com/api/docs/pricing',\r\n  'prezzi-google': 'https://ai.google.dev/gemini-api/docs/pricing',\r\n  'prezzi-deepseek': 'https://api-docs.deepseek.com/quick_start/pricing/',\r\n  'prezzi-alibaba': 'https://www.alibabacloud.com/help/en/model-studio/model-pricing',\r\n  'prezzi-moonshot': 'https://platform.kimi.ai/docs/pricing/chat',\r\n  'prezzi-zhipu': 'https://docs.z.ai/guides/overview/pricing',\r\n  'prezzi-minimax': 'https://platform.minimax.io/docs/guides/pricing',\r\n  'prezzi-xai': 'https://docs.x.ai/docs/models',\r\n  'ricarica-anthropic': 'https://console.anthropic.com/settings/billing',\r\n  'ricarica-openai': 'https://platform.openai.com/settings/organization/billing',\r\n};\r\n\r\nmodule.exports = { LISTINO, LINK };\r\n\n};\n__m[\"qwen\"] = function (module, exports, require) {\n// Qwen Code reader: ~/.qwen/projects/<project>/chats/<sessionId>.jsonl (also chats/archive/, and the older ~/.qwen/tmp/*/chats/).\r\n// Format checked against the official source code only (github.com/QwenLM/qwen-code, commit ef4c132,\r\n// packages/core/src/services/chatRecordingService.ts), NOT on real files. Append-only JSONL, one record per line:\r\n//   { uuid, parentUuid, sessionId, timestamp, type: 'user' | 'assistant' | 'tool_result' | 'system', subtype?, cwd, model?,\r\n//     message?, usageMetadata?: { promptTokenCount, candidatesTokenCount, cachedContentTokenCount, thoughtsTokenCount, totalTokenCount } }\r\n//   promptTokenCount already includes the cached tokens; candidatesTokenCount already includes reasoning.\r\n//   Only \"assistant\" lines are counted (\"system\" lines may repeat the same numbers for the interface).\r\n// Only numbers are kept: for messages written by the person, only the length of their text.\r\n'use strict';\r\nconst fs = require('fs'), path = require('path');\r\nconst { giorno, leggiRighe, fileConFine, aggiungiRichiesta, aggiungiMessaggio } = require('./comune');\r\n\r\nconst VERSIONE = 1;\r\nconst NOME = /^[0-9a-fA-F-]{32,36}\\.jsonl$/;\r\n\r\nfunction leggiQwen(radice, cacheIn) {\r\n  const cache = cacheIn && cacheIn.v === VERSIONE ? cacheIn : { v: VERSIONE, file: {}, sessioni: {} };\r\n  const elenco = [...fileConFine(path.join(radice, 'projects'), ['.jsonl']), ...fileConFine(path.join(radice, 'tmp'), ['.jsonl'])]\r\n    .filter(p => NOME.test(path.basename(p)) && p.split(path.sep).includes('chats'));\r\n  const visti = new Set(elenco);\r\n  for (const k of Object.keys(cache.file)) if (!visti.has(k)) delete cache.file[k];\r\n  const sessione = (id, file) => cache.sessioni[id] || (cache.sessioni[id] = {\r\n    id, titolo: '', progetto: '', modello: '', messaggi: 0, richieste: 0, token: 0, u: [0, 0, 0, 0], scritti: 0, ultimo: 0, bloccata: false, giorni: {}, file,\r\n  });\r\n\r\n  for (const file of elenco) {\r\n    let st; try { st = fs.statSync(file); } catch (e) { continue; }\r\n    const f = cache.file[file] || (cache.file[file] = { inizio: 0, mtime: 0, visti: [] });\r\n    f.mtime = st.mtimeMs;\r\n    if (st.size < f.inizio) { f.inizio = 0; f.visti = []; }\r\n    if (st.size === f.inizio) continue;\r\n    const giaVisti = new Set(f.visti);\r\n    let letto; try { letto = leggiRighe(file, f.inizio); } catch (e) { continue; }\r\n    for (const r of letto.righe) {\r\n      if (!r) continue;\r\n      let j; try { j = JSON.parse(r); } catch (e) { continue; }\r\n      if (!j || !j.type) continue;\r\n      if (j.uuid) { if (giaVisti.has(j.uuid)) continue; giaVisti.add(j.uuid); f.visti.push(j.uuid); }\r\n      const s = sessione(String(j.sessionId || path.basename(file, '.jsonl')), file);\r\n      if (j.cwd && !s.progetto) s.progetto = path.basename(String(j.cwd).replace(/[\\\\/]+$/, ''));\r\n      const ts = j.timestamp ? Date.parse(j.timestamp) : NaN, g = isNaN(ts) ? null : giorno(ts);\r\n      if (!isNaN(ts) && ts > s.ultimo) s.ultimo = ts;\r\n      if (j.type === 'assistant' && j.usageMetadata) {\r\n        const u = j.usageMetadata, n = v => Number(v) || 0;\r\n        let entrata = n(u.promptTokenCount), uscita = n(u.candidatesTokenCount);\r\n        const letti = n(u.cachedContentTokenCount);\r\n        if (!entrata && !uscita) entrata = n(u.totalTokenCount);   // some providers send only a total\r\n        if (!entrata && !uscita) continue;\r\n        aggiungiRichiesta(s, g, Math.max(0, entrata - letti), uscita, 0, letti);\r\n        if (j.model) s.modello = String(j.model).slice(0, 40);\r\n      } else if (j.type === 'user' && !j.subtype) {\r\n        const parti = j.message && Array.isArray(j.message.parts) ? j.message.parts : [];\r\n        const t = parti.map(p => (p && typeof p.text === 'string' ? p.text : '')).join('');\r\n        if (t && !/^\\s*</.test(t)) aggiungiMessaggio(s, g, Math.ceil(t.length / 4));\r\n      }\r\n    }\r\n    if (f.visti.length > 50000) f.visti = f.visti.slice(-20000);\r\n    f.inizio = letto.nuovoInizio;\r\n  }\r\n  const sessioni = [];\r\n  for (const s of Object.values(cache.sessioni)) {\r\n    if (!visti.has(s.file)) continue;\r\n    if (!s.richieste && !s.messaggi) continue;\r\n    const { file, ...resto } = s;\r\n    sessioni.push({ ...resto, giorni: s.giorni, u: s.u.slice(), ultimo: Math.max(s.ultimo, (cache.file[file] || {}).mtime || 0) });\r\n  }\r\n  for (const [id, s] of Object.entries(cache.sessioni)) if (!visti.has(s.file)) delete cache.sessioni[id];\r\n  return { cache, sessioni, limiti: [], avvisi: [] };\r\n}\r\n\r\nmodule.exports = { leggiQwen };\r\n\n};\n__m[\"raccolta\"] = function (module, exports, require) {\n// Collects the numbers of every enabled source. Runs in a worker thread so the editor never freezes,\r\n// even the first time, when all the chat files are read (afterwards only the new lines are read).\r\n// Everything stays on this computer: no network, no API key, no message text.\r\n'use strict';\r\nconst fs = require('fs'), path = require('path'), os = require('os');\r\nconst { FONTI } = require('./fonti');\r\n\r\nconst casa = p => (p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p);\r\n\r\nfunction caricaCache(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } }\r\nfunction salvaCache(file, dati) {\r\n  try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file + '.tmp', JSON.stringify(dati)); fs.renameSync(file + '.tmp', file); } catch (e) { /* next time */ }\r\n}\r\n\r\n// optional \"API credits\" section: a JSON file the person writes by hand (credits, expiry dates, prices).\r\n// No key is ever read or needed; without the file the section does not appear.\r\nfunction leggiApi(file) {\r\n  const out = { presente: false, crediti: [], speso: 0, lavori: 0, prezzi: {}, ultimi: [] };\r\n  try {\r\n    const c = JSON.parse(fs.readFileSync(file, 'utf8'));\r\n    out.presente = true;\r\n    if (Array.isArray(c.crediti)) out.crediti = c.crediti.map(x => ({\r\n      dollari: Number(x.dollari) || 0, arrivo: str(x.arrivo), scadenza: str(x.scadenza), nota: str(x.nota),\r\n      // which provider the credit belongs to; \"fonte\": \"openai\" of the first version still works\r\n      fornitore: str(x.fornitore) || (x.fonte === 'openai' ? 'openai' : 'anthropic'),\r\n    }));\r\n    if (c.prezzi_per_milione && typeof c.prezzi_per_milione === 'object') {\r\n      for (const [m, p] of Object.entries(c.prezzi_per_milione)) out.prezzi[m] = { entrata: Number(p.entrata) || 0, uscita: Number(p.uscita) || 0, cache_scritta: Number(p.cache_scritta) || 0, cache_letta: Number(p.cache_letta) || 0 };\r\n    }\r\n  } catch (e) { return out; }\r\n  try {\r\n    const lavori = [];\r\n    for (const r of fs.readFileSync(path.join(path.dirname(file), 'uso.jsonl'), 'utf8').split('\\n')) {\r\n      if (!r.trim()) continue;\r\n      try { const j = JSON.parse(r); lavori.push({ data: str(j.data), titolo: str(j.titolo).slice(0, 60), modello: str(j.modello), costo: Number(j.costo) || 0 }); } catch (e) { /* next line */ }\r\n    }\r\n    out.lavori = lavori.length; out.speso = lavori.reduce((s, l) => s + l.costo, 0); out.ultimi = lavori.slice(-5).reverse();\r\n  } catch (e) { /* no spending log */ }\r\n  return out;\r\n}\r\nconst str = v => (typeof v === 'string' ? v : '');\r\n\r\n// o = { attive: { id: bool }, cartelle: { id: path }, cache, api, fileApi, archivi: [editor globalStorage dirs], progetti: [workspace dirs] }\r\nfunction raccogli(o) {\r\n  const risultato = { aggiornato: Date.now(), sessioni: [], limiti: [], avvisi: [], fonti: {}, api: null, listino: require('./prezzi').LISTINO };\r\n  for (const f of FONTI) {\r\n    if (!o.attive || !o.attive[f.id]) continue;\r\n    const radice = casa((o.cartelle || {})[f.id]) || (f.cartella ? f.cartella() : '');\r\n    const info = { nome: f.nome, breve: f.breve, colore: f.colore, fornitore: f.fornitore, verificato: f.verificato, cartella: radice || '', sessioni: 0, errore: '' };\r\n    risultato.fonti[f.id] = info;\r\n    try {\r\n      const cf = path.join(o.cache, `${f.id}.json`);\r\n      const r = require(f.modulo)[f.funzione](radice, caricaCache(cf), { archivi: o.archivi || [], progetti: o.progetti || [] });\r\n      salvaCache(cf, r.cache);\r\n      for (const s of r.sessioni) s.fonte = f.id;\r\n      info.sessioni = r.sessioni.length;\r\n      risultato.sessioni.push(...r.sessioni);\r\n      for (const l of r.limiti || []) { l.fonte = f.id; risultato.limiti.push(l); }\r\n      for (const a of r.avvisi || []) { a.fonte = f.id; risultato.avvisi.push(a); }\r\n    } catch (e) {\r\n      // one broken source never stops the others\r\n      info.errore = String((e && e.message) || e).slice(0, 200);\r\n    }\r\n  }\r\n  if (o.api) risultato.api = leggiApi(casa(o.fileApi) || path.join(os.homedir(), '.claude', 'utilizzo-api', 'config.json'));\r\n  risultato.sessioni.sort((a, b) => b.ultimo - a.ultimo);\r\n  return risultato;\r\n}\r\n\r\nmodule.exports = { raccogli, leggiApi };\r\n\r\n// as a worker thread: receive the options, send back the result\r\ntry {\r\n  const { parentPort, workerData } = require('worker_threads');\r\n  if (parentPort && workerData && workerData.pannelloUtilizzo) {\r\n    try { parentPort.postMessage({ ok: true, dati: raccogli(workerData.opzioni) }); }\r\n    catch (e) { parentPort.postMessage({ ok: false, errore: String((e && e.message) || e).slice(0, 300) }); }\r\n  }\r\n} catch (e) { /* not in a worker */ }\r\n\n};\n__m[\"sqlite\"] = function (module, exports, require) {\n// Readers for tools that keep their history in a SQLite database: opencode, ZCode (Z.ai / GLM) and MiniMax Code.\r\n// The database is opened READ-ONLY with Node's built-in SQLite (node:sqlite); only numeric columns, ids, dates,\r\n// model names, titles and folders are selected, never message text. Without node:sqlite (older editors) the\r\n// panel says so instead of counting.\r\n// Formats checked against the official source code only (not on real files):\r\n//   opencode   github.com/anomalyco/opencode v1.19.4, packages/core/src/session/sql.ts + packages/schema/src/v1/session.ts\r\n//   ZCode      github.com/zai-org/ZCode, apps/zcode-cli/.../storage/session-store\r\n//   MiniMax    github.com/MiniMax-AI/minimax-code, packages/config/src/data-dir.ts + local runtime storage\r\n'use strict';\r\nconst fs = require('fs'), path = require('path');\r\nconst { giorno, fileConFine, aggiungiRichiesta, aggiungiMessaggio } = require('./comune');\r\n\r\nconst VERSIONE = 1;\r\n\r\nfunction apri(file) {\r\n  let sqlite;\r\n  try { sqlite = require('node:sqlite'); } catch (e) { return { errore: 'sqlite' }; }\r\n  try { return { db: new sqlite.DatabaseSync(file, { readOnly: true }) }; } catch (e) { return { errore: String((e && e.message) || e).slice(0, 120) }; }\r\n}\r\nconst tabelle = db => new Set(db.prepare(\"SELECT name FROM sqlite_master WHERE type = 'table'\").all().map(r => r.name));\r\nconst colonne = (db, t) => new Set(db.prepare(`PRAGMA table_info(\"${t.replace(/\"/g, '')}\")`).all().map(r => r.name));\r\n// a database changes when the file or its -wal file changes\r\nfunction impronta(file) {\r\n  let x = '';\r\n  for (const f of [file, file + '-wal']) { try { const s = fs.statSync(f); x += `${s.size}:${s.mtimeMs};`; } catch (e) { x += '-;'; } }\r\n  return x;\r\n}\r\nconst nuovaSessione = (id, titolo, progetto, modello) => ({ id: String(id), titolo: titolo ? String(titolo).slice(0, 80) : '', progetto: progetto ? path.basename(String(progetto).replace(/[\\\\/]+$/, '')) : '', modello: modello ? String(modello).slice(0, 40) : '', messaggi: 0, richieste: 0, token: 0, u: [0, 0, 0, 0], scritti: 0, ultimo: 0, bloccata: false, giorni: {} });\r\nconst ms = v => { if (v == null) return NaN; if (typeof v === 'number') return v < 1e12 ? v * 1000 : v; const n = Number(v); if (!isNaN(n)) return n < 1e12 ? n * 1000 : n; return Date.parse(v); };\r\nconst num = v => Number(v) || 0;\r\n\r\n// reads the databases only when they changed; otherwise the last result is reused\r\nfunction conCache(file, cacheIn, leggi) {\r\n  const cache = cacheIn && cacheIn.v === VERSIONE ? cacheIn : { v: VERSIONE };\r\n  if (!fs.existsSync(file)) return { cache: { v: VERSIONE }, sessioni: [], limiti: [], avvisi: [] };\r\n  const imp = impronta(file);\r\n  if (cache.impronta === imp && cache.sessioni) return { cache, sessioni: cache.sessioni, limiti: [], avvisi: cache.avvisi || [] };\r\n  const { db, errore } = apri(file);\r\n  if (!db) return { cache, sessioni: cache.sessioni || [], limiti: [], avvisi: [{ chiave: errore === 'sqlite' ? 'senzaSqlite' : 'sqliteErrore', testo: errore }] };\r\n  try {\r\n    const sessioni = leggi(db).filter(s => s.richieste || s.messaggi);\r\n    return { cache: { v: VERSIONE, impronta: imp, sessioni }, sessioni, limiti: [], avvisi: [] };\r\n  } finally { try { db.close(); } catch (e) { /* closed */ } }\r\n}\r\n\r\n// ---------- opencode ----------\r\n// <home>/.local/share/opencode/opencode.db: table session (id, directory, title, time_updated, model JSON) and\r\n// message (session_id, time_created, data JSON with role, modelID, tokens { input, output, reasoning, cache { read, write } })\r\n// or, in newer builds, session_message (session_id, type, data JSON with model { id }, tokens, time { created }).\r\n// Older opencode wrote JSON files in storage/message/<session>/<message>.json: read when there is no database.\r\nfunction leggiOpencode(radice, cacheIn) {\r\n  const file = path.join(radice, 'opencode.db');\r\n  if (!fs.existsSync(file)) return leggiOpencodeJson(radice, cacheIn);\r\n  return opencodeDb(file, cacheIn);\r\n}\r\n// Kilo Code (kilocode.kilo-code v7, an opencode fork): ~/.local/share/kilo/kilo.db, same tables\r\n// (github.com/Kilo-Org/kilocode packages/opencode/src/storage/db.ts)\r\nfunction leggiKilo(radice, cacheIn) { return opencodeDb(path.join(radice, 'kilo.db'), cacheIn); }\r\n\r\nfunction opencodeDb(file, cacheIn) {\r\n  return conCache(file, cacheIn, db => {\r\n    const t = tabelle(db), sessioni = {};\r\n    for (const nomeT of ['session', 'session_v2']) {\r\n      if (!t.has(nomeT)) continue;\r\n      const c = colonne(db, nomeT);\r\n      const sel = ['id', c.has('directory') ? 'directory' : 'NULL AS directory', c.has('title') ? 'title' : 'NULL AS title', c.has('time_updated') ? 'time_updated' : 'NULL AS time_updated'].join(', ');\r\n      for (const r of db.prepare(`SELECT ${sel} FROM \"${nomeT}\"`).all()) {\r\n        const s = sessioni[r.id] || (sessioni[r.id] = nuovaSessione(r.id, r.title, r.directory, ''));\r\n        s.ultimo = Math.max(s.ultimo, ms(r.time_updated) || 0);\r\n      }\r\n    }\r\n    const conta = (sql) => {\r\n      for (const r of db.prepare(sql).all()) {\r\n        const s = sessioni[r.sid] || (sessioni[r.sid] = nuovaSessione(r.sid, '', '', ''));\r\n        const ts = ms(r.creato), g = isNaN(ts) ? null : giorno(ts);\r\n        if (!isNaN(ts) && ts > s.ultimo) s.ultimo = ts;\r\n        if (r.ruolo === 'user') { aggiungiMessaggio(s, g, 0); continue; }\r\n        if (r.ruolo !== 'assistant') continue;\r\n        if (!num(r.ti) && !num(r.tout) && !num(r.cr) && !num(r.cw)) continue;\r\n        // opencode keeps input without the cache; reasoning is billed as output\r\n        aggiungiRichiesta(s, g, num(r.ti), num(r.tout) + num(r.tr), num(r.cw), num(r.cr));\r\n        if (r.modello) s.modello = String(r.modello).slice(0, 40);\r\n      }\r\n    };\r\n    const usati = new Set();\r\n    if (t.has('message')) {\r\n      const n = db.prepare(\"SELECT COUNT(*) AS n FROM message WHERE json_extract(data, '$.role') = 'assistant'\").get().n;\r\n      if (n) {\r\n        conta(`SELECT session_id AS sid, COALESCE(json_extract(data, '$.time.created'), time_created) AS creato, json_extract(data, '$.role') AS ruolo,\r\n          json_extract(data, '$.modelID') AS modello, json_extract(data, '$.tokens.input') AS ti, json_extract(data, '$.tokens.output') AS tout,\r\n          json_extract(data, '$.tokens.reasoning') AS tr, json_extract(data, '$.tokens.cache.read') AS cr, json_extract(data, '$.tokens.cache.write') AS cw FROM message`);\r\n        usati.add('message');\r\n      }\r\n    }\r\n    if (!usati.size && t.has('session_message')) {\r\n      conta(`SELECT session_id AS sid, COALESCE(json_extract(data, '$.time.created'), time_created) AS creato, type AS ruolo,\r\n        json_extract(data, '$.model.id') AS modello, json_extract(data, '$.tokens.input') AS ti, json_extract(data, '$.tokens.output') AS tout,\r\n        json_extract(data, '$.tokens.reasoning') AS tr, json_extract(data, '$.tokens.cache.read') AS cr, json_extract(data, '$.tokens.cache.write') AS cw FROM session_message`);\r\n    }\r\n    return Object.values(sessioni);\r\n  });\r\n}\r\n\r\nfunction leggiOpencodeJson(radice, cacheIn) {\r\n  const cartella = path.join(radice, 'storage');\r\n  const file = fileConFine(path.join(cartella, 'message'), ['.json']);\r\n  if (!file.length) return { cache: { v: VERSIONE }, sessioni: [], limiti: [], avvisi: [] };\r\n  const imp = `${file.length}:${file.reduce((x, f) => { try { return Math.max(x, fs.statSync(f).mtimeMs); } catch (e) { return x; } }, 0)}`;\r\n  if (cacheIn && cacheIn.v === VERSIONE && cacheIn.impronta === imp) return { cache: cacheIn, sessioni: cacheIn.sessioni, limiti: [], avvisi: [] };\r\n  const info = {};\r\n  for (const f of fileConFine(path.join(cartella, 'session'), ['.json'])) {\r\n    try { const j = JSON.parse(fs.readFileSync(f, 'utf8')); if (j && j.id) info[j.id] = { titolo: j.title, cartella: j.directory }; } catch (e) { /* next */ }\r\n  }\r\n  const sessioni = {};\r\n  for (const f of file) {\r\n    let j; try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { continue; }\r\n    const sid = j.sessionID || path.basename(path.dirname(f));\r\n    const i = info[sid] || {};\r\n    const s = sessioni[sid] || (sessioni[sid] = nuovaSessione(sid, i.titolo, i.cartella, ''));\r\n    const ts = ms(j.time && j.time.created), g = isNaN(ts) ? null : giorno(ts);\r\n    if (!isNaN(ts) && ts > s.ultimo) s.ultimo = ts;\r\n    if (j.role === 'user') { aggiungiMessaggio(s, g, 0); continue; }\r\n    const k = j.tokens;\r\n    if (j.role !== 'assistant' || !k) continue;\r\n    aggiungiRichiesta(s, g, num(k.input), num(k.output) + num(k.reasoning), num(k.cache && k.cache.write), num(k.cache && k.cache.read));\r\n    if (j.modelID) s.modello = String(j.modelID).slice(0, 40);\r\n  }\r\n  const elenco = Object.values(sessioni).filter(s => s.richieste || s.messaggi);\r\n  return { cache: { v: VERSIONE, impronta: imp, sessioni: elenco }, sessioni: elenco, limiti: [], avvisi: [] };\r\n}\r\n\r\n// ---------- ZCode (Z.ai, GLM) ----------\r\n// ~/.zcode/cli/db/db.sqlite: table model_usage (session_id, model_id, started_at, input_tokens, output_tokens, reasoning_tokens,\r\n// cache_creation_input_tokens, cache_read_input_tokens) and session (directory, title). ZCode deletes usage rows after 30 days.\r\nfunction leggiZcode(radice, cacheIn) {\r\n  return conCache(path.join(radice, 'cli', 'db', 'db.sqlite'), cacheIn, db => {\r\n    const t = tabelle(db), sessioni = {};\r\n    if (t.has('session')) {\r\n      const c = colonne(db, 'session');\r\n      if (c.has('id')) for (const r of db.prepare(`SELECT id, ${c.has('directory') ? 'directory' : 'NULL AS directory'}, ${c.has('title') ? 'title' : 'NULL AS title'} FROM session`).all()) sessioni[r.id] = nuovaSessione(r.id, r.title, r.directory, '');\r\n    }\r\n    if (!t.has('model_usage')) return [];\r\n    for (const r of db.prepare(`SELECT session_id AS sid, model_id AS modello, started_at AS creato, input_tokens AS ti, output_tokens AS tout, reasoning_tokens AS tr,\r\n      cache_creation_input_tokens AS cw, cache_read_input_tokens AS cr FROM model_usage`).all()) {\r\n      const s = sessioni[r.sid] || (sessioni[r.sid] = nuovaSessione(r.sid, '', '', ''));\r\n      const ts = ms(r.creato), g = isNaN(ts) ? null : giorno(ts);\r\n      if (!isNaN(ts) && ts > s.ultimo) s.ultimo = ts;\r\n      // Anthropic-style names: input without the cache (not confirmed in the source)\r\n      aggiungiRichiesta(s, g, num(r.ti), num(r.tout) + num(r.tr), num(r.cw), num(r.cr));\r\n      if (r.modello) s.modello = String(r.modello).slice(0, 40);\r\n    }\r\n    return Object.values(sessioni);\r\n  });\r\n}\r\n\r\n// ---------- MiniMax Code ----------\r\n// ~/.minimax/v2/sqlite/*.sqlite (older: ~/.mavis): table local_runtime_token_usage (session_id, model, ts in ms,\r\n// input_tokens, output_tokens, reasoning_tokens, cache_read_tokens, cache_write_tokens).\r\nfunction leggiMinimax(radice, cacheIn) {\r\n  const candidati = ['runtime-state.sqlite', 'usage-state.sqlite'].map(n => path.join(radice, 'v2', 'sqlite', n)).filter(f => fs.existsSync(f));\r\n  const cache = cacheIn && cacheIn.v === VERSIONE && cacheIn.parti ? cacheIn : { v: VERSIONE, parti: {} };\r\n  const sessioni = [], avvisi = [];\r\n  for (const f of candidati) {\r\n    const r = conCache(f, cache.parti[f], db => {\r\n      if (!tabelle(db).has('local_runtime_token_usage')) return [];\r\n      const s = {};\r\n      for (const x of db.prepare(`SELECT session_id AS sid, model AS modello, ts AS creato, input_tokens AS ti, output_tokens AS tout, reasoning_tokens AS tr,\r\n        cache_read_tokens AS cr, cache_write_tokens AS cw FROM local_runtime_token_usage`).all()) {\r\n        const q = s[x.sid] || (s[x.sid] = nuovaSessione(x.sid, '', '', ''));\r\n        const ts = ms(x.creato), g = isNaN(ts) ? null : giorno(ts);\r\n        if (!isNaN(ts) && ts > q.ultimo) q.ultimo = ts;\r\n        aggiungiRichiesta(q, g, num(x.ti), num(x.tout) + num(x.tr), num(x.cw), num(x.cr));\r\n        if (x.modello) q.modello = String(x.modello).slice(0, 40);\r\n      }\r\n      return Object.values(s);\r\n    });\r\n    cache.parti[f] = r.cache;\r\n    sessioni.push(...r.sessioni); avvisi.push(...r.avvisi);\r\n  }\r\n  return { cache, sessioni, limiti: [], avvisi };\r\n}\r\n\r\nmodule.exports = { leggiOpencode, leggiKilo, leggiZcode, leggiMinimax };\r\n\n};\n__m[\"__entrata\"] = function (module, exports, require) {\n// Altri strumenti per il pannello \u00abUtilizzo\u00bb di Claude Code: OpenAI Codex, Gemini CLI, Qwen Code, Kimi CLI, ZCode (GLM),\n// MiniMax Code, opencode, Kilo Code, Cline, Roo Code, Continue e Aider. Usa gli stessi lettori dell'estensione VS Code\n// (vscode/src), impacchettati dentro hooks/register.tsx da strumenti/genera-altri.js. Claude Code lo conta gi\u00e0 conta.js.\n// Legge solo i numeri dai file di quegli strumenti su questo PC: niente rete, nessuna chiave, nessun testo dei messaggi.\n// Uscita (stdout): JSON { aggiornato, fonti: { id: { nome, breve, colore, fornitore, dati } }, limiti, cercati, listino }\n'use strict';\nconst fs = require('fs'), path = require('path'), os = require('os');\nconst { FONTI } = require('./fonti');\nconst { raccogli } = require('./raccolta');\n\n// le cartelle \u00abglobalStorage\u00bb degli editor (Cline e Roo Code ci tengono i loro compiti); solo i posti standard\nfunction archiviEditor() {\n  const out = [];\n  const editori = ['Code', 'Code - Insiders', 'Cursor', 'Windsurf', 'VSCodium', 'Trae', 'Kiro'];\n  const basi = process.platform === 'win32' ? [path.join(os.homedir(), 'AppData', 'Roaming')]\n    : process.platform === 'darwin' ? [path.join(os.homedir(), 'Library', 'Application Support')]\n      : [path.join(os.homedir(), '.config')];\n  for (const b of basi) for (const e of editori) {\n    const p = path.join(b, e, 'User', 'globalStorage');\n    try { if (fs.statSync(p).isDirectory()) out.push(p); } catch (x) { /* non installato */ }\n  }\n  return out;\n}\n\nconst attive = {};\nfor (const f of FONTI) if (f.id !== 'claude') attive[f.id] = true;\nconst { LINK } = require('./prezzi');\nconst r = raccogli({ attive, cartelle: {}, cache: path.join(os.homedir(), '.claude', 'utilizzo-altri'), archivi: archiviEditor(), progetti: [] });\n\n// ogni strumento nella stessa forma dei numeri di Claude Code (conta.js): { aggiornato, totali, sessioni, giorni }\nconst ora = Date.now();\nconst fonti = {};\nfor (const [id, info] of Object.entries(r.fonti)) {\n  const sue = r.sessioni.filter(s => s.fonte === id);\n  if (!sue.length) continue;\n  const totali = { messaggi: 0, richieste: 0, token: 0, input: 0, output: 0, cacheScritta: 0, cacheLetta: 0, scritti: 0, sessioni: 0 };\n  const giorni = {}, sessioni = [];\n  for (const s of sue) {\n    const u = s.u || [0, 0, 0, 0];\n    totali.messaggi += s.messaggi || 0; totali.richieste += s.richieste || 0; totali.token += s.token || 0; totali.scritti += s.scritti || 0;\n    totali.input += u[0]; totali.output += u[1]; totali.cacheScritta += u[2]; totali.cacheLetta += u[3]; totali.sessioni++;\n    const mesi = {}, g3 = {};\n    for (const [k, v] of Object.entries(s.giorni || {})) {\n      const x = giorni[k] || (giorni[k] = { token: 0, messaggi: 0, richieste: 0, input: 0, output: 0, cacheScritta: 0, cacheLetta: 0, scritti: 0 });\n      x.token += v[0] || 0; x.messaggi += v[1] || 0; x.richieste += v[2] || 0; x.input += v[3] || 0; x.output += v[4] || 0;\n      x.cacheScritta += v[5] || 0; x.cacheLetta += v[6] || 0; x.scritti += v[7] || 0;\n      const m = mesi[k.slice(0, 7)] || (mesi[k.slice(0, 7)] = [0, 0, 0]);\n      m[0] += v[0] || 0; m[1] += v[1] || 0; m[2] += v[2] || 0;\n      g3[k] = [v[0] || 0, v[1] || 0, v[2] || 0];\n    }\n    const stato = ora - s.ultimo < 120000 ? 'al lavoro' : s.bloccata ? 'bloccata' : 'ferma';\n    sessioni.push({ id: `${id}:${s.id}`, titolo: s.titolo || 'Senza titolo', progetto: s.progetto || info.nome, modello: s.modello || '',\n      messaggi: s.messaggi || 0, richieste: s.richieste || 0, token: s.token || 0, u, ultimo: s.ultimo || 0, stato, mesi, giorni: g3 });\n  }\n  sessioni.sort((a, b) => b.ultimo - a.ultimo);\n  fonti[id] = { nome: info.nome, breve: info.breve, colore: info.colore, fornitore: info.fornitore, dati: { aggiornato: ora, totali, sessioni, giorni } };\n}\n// limiti riportati dagli strumenti stessi (per ora Codex: finestra di 5 ore e settimanale)\nconst limiti = r.limiti.filter(l => fonti[l.fonte]).map(l => ({ fonte: l.fonte, minuti: l.minuti, percento: l.percento, azzera: l.azzera }));\n// gli strumenti cercati, anche quelli non trovati, e gli errori (uno strumento rotto non ferma gli altri)\nconst cercati = Object.entries(r.fonti).map(([id, f]) => ({ id, nome: f.nome, trovato: !!fonti[id], errore: f.errore || '' }));\nprocess.stdout.write(JSON.stringify({ aggiornato: ora, fonti, limiti, cercati, listino: r.listino, link: LINK }));\n\n};\n__r('./__entrata');\n"
const BLU = '#3b82f6', BLU_SCURO = '#1d4ed8', GRIGIO = '#94a3b8'

const dati = atom({ plugin: 'utilizzo', key: 'dati' } as const, null)
const limiti = atom({ plugin: 'utilizzo', key: 'limiti' } as const, [])
const memoria = atom({ plugin: 'utilizzo', key: 'memoria' } as const, null)
const scelta = atom({ plugin: 'utilizzo', key: 'scelta' } as const, null)
const tutte = atom({ plugin: 'utilizzo', key: 'tutte' } as const, false)
const errore = atom({ plugin: 'utilizzo', key: 'errore' } as const, '')
const aperto = atom({ plugin: 'utilizzo', key: 'aperto' } as const, false)
const chatAperte = atom({ plugin: 'utilizzo', key: 'chatAperte' } as const, false)
// '' a riposo, 'conferma' dopo il primo tocco, 'in corso' mentre comprime, oppure il messaggio dell'esito
const comprimi = atom({ plugin: 'utilizzo', key: 'comprimi' } as const, '')
// quale scelta del grafico è aperta: '', 'giorno', 'mese' o 'anno'
const menu = atom({ plugin: 'utilizzo', key: 'menu' } as const, '')
// il riquadro dei totali di cui si sta mostrando la spiegazione ('' nessuno)
const info = atom({ plugin: 'utilizzo', key: 'info' } as const, '')
const misura = atom({ plugin: 'utilizzo', key: 'misura' } as const, 'a4')
// true quando il pannello è stato chiuso: sopra la casella dei messaggi compare il pulsante per riaprirlo
const chiuso = atom({ plugin: 'utilizzo', key: 'chiuso' } as const, false)
// crediti API (strumenti/api.js) e riquadro «Ricarica» aperto o chiuso
const api = atom({ plugin: 'utilizzo', key: 'api' } as const, null)
const apiAperto = atom({ plugin: 'utilizzo', key: 'apiAperto' } as const, false)
// spiegazione dietro l'icona ⓘ accanto a «Ricarica e quanto costa» (chiesta dall'utente il 26.10.2026)
const apiInfo = atom({ plugin: 'utilizzo', key: 'apiInfo' } as const, false)
// quanti giri di loop al massimo per richiesta (scelti nel pannello, ricordati tra le chat in $.store)
const giri = atom({ plugin: 'utilizzo', key: 'giri' } as const, 0)   // 0 = consigliato in automatico
const giriAperto = atom({ plugin: 'utilizzo', key: 'giriAperto' } as const, false)
const ultimoLivello = atom({ plugin: 'utilizzo', key: 'ultimoLivello' } as const, 'medio')
// altri strumenti (Codex, Gemini, Qwen…), quale si guarda ('claude', il loro id o 'tutti') e il riquadro dei prezzi di tutti i fornitori
const altri = atom({ plugin: 'utilizzo', key: 'altri' } as const, null)
const strumento = atom({ plugin: 'utilizzo', key: 'strumento' } as const, 'claude')
const prezziAperti = atom({ plugin: 'utilizzo', key: 'prezziAperti' } as const, false)
const fornitore = atom({ plugin: 'utilizzo', key: 'fornitore' } as const, 'anthropic')
// prezzi di riserva se config.json manca (dollari per milione di token, Opus 5.5)
const OPUS: Prezzo = { entrata: 4, uscita: 20, cache_scritta: 8, cache_letta: 0.2 }
// costo in dollari di [entrata, uscita, cache scritta, cache riletta]
const costo = (p: Prezzo, i: number, o: number, cw: number, cr: number) => (i * p.entrata + o * p.uscita + cw * p.cache_scritta + cr * p.cache_letta) / 1e6

// misure per rendere i token comprensibili. Un token è circa 3/4 di parola:
// una pagina A4 di testo (~500 parole) ≈ 650 token; un libro di 300 pagine ≈ 200'000 token;
// una persona scrive circa 40 parole al minuto, cioè ~3'200 token l'ora.
const MISURE: Record<string, number> = { a4: 650, libri: 200000, ore: 3200, token: 1 }
const nomeMisura = (k: string) => (T.misure as any)[k] ?? T.misure.a4

// ---- numeri leggibili ----
const intero = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, T.migliaia)
const dec = (n: number, cifre: number) => n.toFixed(cifre).replace('.', T.decimale)
function breve(n: number): string {
  if (n >= 1e9) return dec(n / 1e9, n >= 1e10 ? 0 : 1) + ' ' + T.mld
  if (n >= 1e6) return dec(n / 1e6, n >= 1e7 ? 0 : 1) + ' ' + T.mln
  if (n >= 1e4) return Math.round(n / 1e3) + ' ' + T.mila
  return intero(n)
}
// un numero di token reali riportato alla misura scelta (1 Token = 1 pagina A4, 1 libro…), es. "17 mila"
function inMisura(n: number, m: string): string {
  const v = n / (MISURE[m] ?? MISURE.a4)
  return v >= 1e4 ? breve(v) : v >= 10 ? intero(v) : dec(v, 1).replace(T.decimale + '0', '')
}
// griglia di scelta (mesi, anni) disegnata come immagine: caselle uguali con angoli smussati come i pulsanti dei giorni
function grigliaSvg(voci: { nome: string; scelta: boolean; oggi?: boolean }[], colonne: number): string {
  const W = 300, cw = (W - (colonne - 1) * 6) / colonne, ch = 30, gap = 6, righe = Math.ceil(voci.length / colonne)
  const H = righe * ch + (righe - 1) * gap
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  let r = ''
  voci.forEach((v, i) => {
    const x = (i % colonne) * (cw + gap), y = Math.floor(i / colonne) * (ch + gap)
    // la scelta in bianco; oggi (giorno, mese o anno attuale) con il bordo blu
    r += `<rect x="${x + 1.5}" y="${y + 1.5}" width="${cw - 3}" height="${ch - 3}" rx="6" fill="${v.scelta ? '#ffffff' : '#2b2b2b'}"${v.oggi ? ` stroke="${BLU}" stroke-width="2.5"` : ''}/>`
    r += `<text x="${x + cw / 2}" y="${y + ch / 2 + 6}" font-size="16.5" text-anchor="middle" font-family="system-ui, sans-serif" fill="${v.scelta ? '#111111' : '#e5e5e5'}">${esc(v.nome)}</text>`
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" viewBox="0 0 ${W} ${H}">${r}</svg>`
}
const due = (n: number) => String(n).padStart(2, '0')
const chiave = (a: number, m: number, g: number) => `${a}-${due(m + 1)}-${due(g)}`
const giorniNelMese = (a: number, m: number) => new Date(a, m + 1, 0).getDate()
function quando(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso), oggi = new Date()
  const ora = `${due(d.getHours())}:${due(d.getMinutes())}`
  if (d.toDateString() === oggi.toDateString()) return T.oggi(ora)
  const domani = new Date(oggi.getTime() + 86400000)
  if (d.toDateString() === domani.toDateString()) return T.domani(ora)
  return T.giornoAlle(`${T.giorniBrevi[d.getDay()]} ${d.getDate()} ${T.mesi[d.getMonth()].slice(0, 3)}`, ora)
}
function fa(ms: number, ora: number): string {
  const s = Math.max(0, Math.round((ora - ms) / 1000))
  if (s < 90) return T.adesso
  if (s < 3600) return T.minFa(Math.round(s / 60))
  if (s < 86400) return T.hFa(Math.round(s / 3600))
  return T.gFa(Math.round(s / 86400))
}

// numeri di più strumenti insieme (scelta «Tutti»), nella stessa forma di conta.js
function unisci(elenco: Dati[]): Dati {
  const totali = { messaggi: 0, richieste: 0, token: 0, input: 0, output: 0, cacheScritta: 0, cacheLetta: 0, scritti: 0, sessioni: 0 }
  const giorni: Dati['giorni'] = {}
  for (const d of elenco) {
    for (const k of Object.keys(totali) as (keyof typeof totali)[]) totali[k] += (d.totali as any)[k] ?? 0
    for (const [g, v] of Object.entries(d.giorni)) {
      const x = giorni[g] ?? (giorni[g] = { token: 0, messaggi: 0, richieste: 0, input: 0, output: 0, cacheScritta: 0, cacheLetta: 0, scritti: 0 })
      for (const k of Object.keys(x) as (keyof typeof x)[]) (x as any)[k] += (v as any)[k] ?? 0
    }
  }
  const sessioni = elenco.flatMap(d => d.sessioni).sort((a, b) => b.ultimo - a.ultimo)
  return { aggiornato: Math.max(...elenco.map(d => d.aggiornato)), totali, sessioni, giorni }
}

// ---- scelta automatica del modello ----
// Testo fisso (uguale in ogni chat, quindi resta nella cache): regole per scegliere il modello dei subagenti.
const SCELTA_MODELLO = [
  '# Model routing (Pannello Utilizzo)',
  'To save usage, give each subagent (Agent tool, `model` parameter) the cheapest model that can do its job well:',
  '- haiku: searching, finding files, listing, reading and summarising, counting, renaming, translating, formatting, checking logs or status.',
  '- sonnet: ordinary code changes, bug fixes, pages and components, tests, data cleaning, reviews and QA, running prepared renders or builds.',
  '- opus (or inherit): design and architecture, 3D modelling and rendering work that needs judgement, new websites or apps with backend and frontend, hard debugging, security, migrations, anything long or open-ended.',
  'If a cheaper model fails or the result is weak, redo that piece once with a stronger model. Never downgrade the main conversation or a subagent whose definition fixes its model.',
  'For the API helper (agente.py) pass `--modello auto`: it picks Haiku, Sonnet or Opus by itself.',
].join('\n')

// ---- giri di loop e spesa massima per richiesta ----
const T_GIRI = {
  titolo: 'Loop per richiesta',
  colonne: 'semplice · media · difficile',
  nome: (n: number) => `${({ 1: 'Rapido', 2: 'Normale', 3: 'Accurato', 5: 'Preciso', 8: 'Massimo' } as Record<number, string>)[n] ?? ''} · ${n} ${n === 1 ? 'giro' : 'giri'}`,
  livelli: { leggero: 'semplice', medio: 'media', pesante: 'difficile' } as Record<string, string>,
  avviso: (l: string, m: string, g: number, giro: string, max: string) => `Richiesta ${l} (${m}): ${g} ${g === 1 ? 'giro' : 'giri'} × ~${giro} → al massimo ~${max}`,
  consigliato: 'consigliato',
  auto: 'Consigliato (automatico)',
  nota: '✓ = consigliato per costo e produttività. In bianco: la spesa massima per il livello riconosciuto nell’ultima richiesta (giri + revisione finale, prezzi API).',
}
// Livello della richiesta con le stesse regole dell'aiutante API (agente.py) e dell'estensione VS Code.
type Livello = 'leggero' | 'medio' | 'pesante'
const RE_PESANTE = /progett|architettur|design|\b3d\b|blender|render|modell|\bsito\b|siti\b|backend|frontend|app nuova|da zero|refactor|migra|sicurezza|debug difficil|ottimizz|\bplan\b|architect|from scratch|website|security|infrastruttur/i
const RE_LEGGERO = /\bcerca|\btrova|\belenca|\bleggi|riassum|\bcont(?:a|are|ami)\b|rinomin|tradu|formatt|\blog\b|\bstato\b|\bsearch|\bfind\b|\blist\b|\bread\b|summar|\bcount\b|rename|translat|\bformat\b|\bstatus\b/i
function livelloDi(t: string): Livello {
  if (RE_PESANTE.test(t) || t.length > 1500) return 'pesante'
  if (RE_LEGGERO.test(t) && t.length < 600) return 'leggero'
  return 'medio'
}
// costo stimato di UN giro ai prezzi API (lavoro + controllo); misurato: un giro 3D di Sinnay con Opus ≈ 2,5 $
const COSTO_GIRO: Record<Livello, number> = { leggero: 0.05, medio: 0.4, pesante: 2.5 }
const MODELLO_LIVELLO: Record<Livello, string> = { leggero: 'Haiku', medio: 'Sonnet', pesante: 'Opus' }
// le 5 scelte: giri massimi per richiesta
const OPZIONI_GIRI = [1, 2, 3, 5, 8]
// consigliato per costo e produttività: oltre questi giri ogni giro in più migliora poco e costa di più
const CONSIGLIATI: Record<Livello, number> = { leggero: 1, medio: 2, pesante: 3 }
const giriEffettivi = (scelta: number, l: Livello) => (scelta > 0 ? scelta : CONSIGLIATI[l])
// spesa massima: i giri più la revisione finale (mezzo giro)
const dollari = (n: number) => `${n.toFixed(2).replace(".", ",")} $`
const tetto = (g: number, l: Livello) => Math.round((g + 0.5) * COSTO_GIRO[l] * 100) / 100

// ---- passaggio automatico ai crediti API ----
// Dal 90% del piano (5 ore o settimana), se ci sono crediti API non scaduti, la chiave e l'aiutante agente.py,
// ogni messaggio porta a Claude l'indicazione di far fare il lavoro all'aiutante, che paga con i crediti API.
// Senza crediti, chiave o aiutante non cambia niente: si continua con il piano.
function crediti(ap: Api | null): number {
  const ora = Date.now()
  const attivi = (ap?.crediti ?? []).filter(c => !c.scadenza || Date.parse(c.scadenza + 'T00:00:00') > ora)
  return Math.max(0, attivi.reduce((x, c) => x + (Number(c.dollari) || 0), 0) - (ap?.speso ?? 0))
}
function passaggioApi(L: Limite[], ap: Api | null): { attivo: boolean; piano: number; rimasto: number; manca: string } {
  const piano = Math.max(0, ...L.map(l => l.percentUsed ?? 0)), rimasto = crediti(ap), soglia = ap?.soglia ?? 90
  const manca = !ap?.presente ? 'crediti' : ap.auto === false ? 'spento' : rimasto <= 0.5 ? 'crediti' : !ap.chiave ? 'chiave' : !ap.agente ? 'agente' : ''
  return { attivo: !manca && piano >= soglia, piano, rimasto, manca }
}

// ---- disegni (SVG) ----
function barra(percento: number, colore: string): string {
  const p = Math.max(0, Math.min(100, percento))
  return `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="10" viewBox="0 0 260 10"><rect width="260" height="10" rx="5" fill="#94a3b8" fill-opacity="0.25"/><rect width="${(260 * p) / 100}" height="10" rx="5" fill="${colore}"/></svg>`
}
const coloriCss: Record<string, string> = { promptBorder: '#94a3b8', inactive: '#64748b', permission: '#8b5cf6', claude: '#d97757', warning: '#f59e0b', success: '#22c55e', error: '#ef4444', suggestion: '#3b82f6', remember: '#06b6d4', autoAccept: '#a855f7', planMode: '#14b8a6', ide: '#eab308', bashBorder: '#ec4899', cyan_FOR_SUBAGENTS_ONLY: '#06b6d4' }
const colore = (c: string) => (c.startsWith('#') ? c : coloriCss[c] ?? BLU)
function strisce(cat: { tokens: number; colore: string }[], totale: number): string {
  let x = 0, r = ''
  for (const c of cat) { const w = (260 * c.tokens) / Math.max(1, totale); r += `<rect x="${x}" y="0" width="${Math.max(0, w)}" height="10" fill="${colore(c.colore)}"/>`; x += w }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="10" viewBox="0 0 260 10"><clipPath id="c"><rect width="260" height="10" rx="5"/></clipPath><g clip-path="url(#c)"><rect width="260" height="10" fill="#94a3b8" fill-opacity="0.25"/>${r}</g></svg>`
}
const coloreLimite = (p: number) => (p >= 90 ? '#ef4444' : p >= 70 ? '#f59e0b' : BLU)

function grafico(d: Dati, s: Scelta): string {
  const n = giorniNelMese(s.anno, s.mese), larg = 9, spazio = 3, alto = 120, base = alto - 16
  const valori = Array.from({ length: n }, (_, i) => d.giorni[chiave(s.anno, s.mese, i + 1)]?.token ?? 0)
  const massimo = Math.max(1, ...valori), W = n * (larg + spazio) + 4
  let barre = ''
  valori.forEach((v, i) => {
    const h = v ? Math.max(2, ((base - 4) * v) / massimo) : 0, x = 2 + i * (larg + spazio), sel = i + 1 === s.giorno
    const titolo = T.barra(i + 1, T.mesi[s.mese], breve(v), d.giorni[chiave(s.anno, s.mese, i + 1)]?.messaggi ?? 0)
    barre += `<g><title>${titolo}</title><rect x="${x}" y="0" width="${larg}" height="${base}" fill="transparent"/>`
    barre += `<rect x="${x}" y="${base - h}" width="${larg}" height="${h}" rx="2" fill="${sel ? BLU_SCURO : BLU}"${sel ? ' stroke="#93c5fd" stroke-width="1.5"' : ''}/></g>`
    if ((i + 1) % 5 === 0 || i === 0) barre += `<text x="${x + larg / 2}" y="${alto - 3}" font-size="9" text-anchor="middle" fill="${GRIGIO}" font-family="system-ui">${i + 1}</text>`
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${alto}" viewBox="0 0 ${W} ${alto}"><line x1="0" y1="${base + 0.5}" x2="${W}" y2="${base + 0.5}" stroke="${GRIGIO}" stroke-opacity="0.4"/>${barre}</svg>`
}

// ---- compressione: nell'app desktop un pannello non può comprimere direttamente, quindi manda /compact come un messaggio ----
// un errore resta visibile 6 secondi, poi la scritta sparisce
async function mostraErrore($: any, testo: string) {
  await update($, comprimi, () => testo)
  $.clock.after(6000, () => { void update($, comprimi, (v: string) => (v === testo ? '' : v)) })
}
async function comprimiChat($: any): Promise<string> {
  try {
    const r: any = await $.session.compact({ instructions: T.istruzioni })
    return r && r.skip ? 'Compressione annullata' : 'Chat compressa'
  } catch (x) {
    // /compact lanciato come comando, come se la persona lo scrivesse: parte appena Claude non sta lavorando
    await $.command.run({ command: 'compact', args: T.istruzioni })
    return 'Compressione avviata (/compact)'
  }
}

// ---- raccolta dei numeri ----
let inCorso = false
let linguaDa = ''
// ogni 2 secondi: il pannello è ancora aperto? (l'app non avvisa quando lo si chiude). Una volta per caricamento del modulo.
let controllo = false
function controllaPannello($: any) {
  if (controllo) return
  controllo = true
  $.clock.every(2000, () => {
    void (async () => {
      try {
        const su = (await $.ui.panes()).some((p: any) => p.id === PANNELLO && p.isShown)
        if ((await read($, chiuso)) === su) await update($, chiuso, () => !su)
      } catch (x) { /* si riprova */ }
    })()
  })
}
// icona del tasto «aggiorna spesa API»: due frecce in cerchio, tratto bianco sottile, sfondo trasparente
const ICONA_RICARICA = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">'
  + '<path d="M4 12a8 8 0 0 1 13.66-5.66L20 8.5"/><path d="M20 3.5v5h-5"/>'
  + '<path d="M20 12a8 8 0 0 1-13.66 5.66L4 15.5"/><path d="M4 20.5v-5h5"/></svg>'
async function ricaricaApi($: any) {
  const A = TESTI_API[(linguaDa || 'it') as Lingua] ?? TESTI_API.it
  const ok = await aggiornaApi($)
  $.ui.toast(ok ? A.aggiornato : A.nonAggiornato)
}
// rilegge solo crediti e spesa API (registro dei lavori): veloce, usata anche dall'icona «aggiorna»
async function aggiornaApi($: any): Promise<boolean> {
  try {
    const ra = await $.process.run(['node', '-e', API_JS], { timeoutMs: 20000 })
    if (ra.exitCode === 0 && ra.stdout) { const x = JSON.parse(ra.stdout) as Api; await update($, api, () => x); return true }
  } catch (e) { /* la sezione API resta com'era */ }
  return false
}
async function aggiorna($: any) {
  controllaPannello($)
  if (!linguaDa) {
    void update($, menu, () => '')   // una volta per caricamento: nessun menu rimasto aperto da prima
    const l = await rilevaLingua($)
    linguaDa = l
    if (TESTI[l] !== T) { T = TESTI[l]; $.ui.invalidate('ui.render') }
  }
  try {
    // "summary": la composizione della memoria stimata sul PC, senza chiamate in più
    const u = await $.session.usage({ breakdown: 'summary' })
    await update($, limiti, () => (u.rateLimits ?? []).map((r: Limite) => ({ kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt })))
    const categorie = (u.context.breakdown?.categories ?? []).filter((c: any) => !c.isDeferred && c.tokens > 0)
      .map((c: any) => ({ nome: String(c.name), tokens: Number(c.tokens), colore: String(c.color || GRIGIO) }))
    const [id, turni, modello] = await Promise.all([$.session.id(), $.session.turns(), $.session.model()])
    await update($, memoria, () => ({ tokens: u.context.tokens, window: u.context.window, percent: u.context.percent, categorie, id, inizio: u.startedAt, turni, modello }))
  } catch (e) { /* i limiti arrivano con la prossima risposta */ }
  await aggiornaApi($)
  if (inCorso) return
  inCorso = true
  try {
    const r = await $.process.run(['node', '-e', CONTA_JS], { timeoutMs: 300000 })
    if (r.exitCode === 0 && r.stdout) {
      const nuovi = JSON.parse(r.stdout) as Dati
      await update($, dati, () => nuovi)
      await update($, errore, () => '')
      await update($, scelta, (s: Scelta | null) => s ?? (() => { const o = new Date(nuovi.aggiornato); return { anno: o.getFullYear(), mese: o.getMonth(), giorno: o.getDate() } })())
    } else await update($, errore, () => (r.stderr || '?').slice(0, 200))
  } catch (e) {
    await update($, errore, () => String((e as Error)?.message ?? e).slice(0, 200))
  } finally { inCorso = false }
  try {
    const ra = await $.process.run(['node', '-'], { stdin: ALTRI_JS, timeoutMs: 300000 })
    if (ra.exitCode === 0 && ra.stdout) { const x = JSON.parse(ra.stdout) as Altri; await update($, altri, () => x) }
  } catch (e) { /* gli altri strumenti restano com'erano */ }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const avviata = await next(e)
    try { const v = Number(await $.store.get('giri')); if (v === 0 || OPZIONI_GIRI.includes(v)) await update($, giri, () => v) } catch (x) { /* resta consigliato */ }
    // la lingua prima di aprire il pannello, così anche il titolo è nella lingua giusta
    try { linguaDa = await rilevaLingua($); T = TESTI[linguaDa] } catch (x) { linguaDa = '' }
    await update($, comprimi, () => '')   // via le scritte rimaste dalle volte prima
    await update($, menu, () => '')       // e nessun menu rimasto aperto
    await $.command.register({ name: 'utilizzo', description: T.comando })
    void $.ui.open({ id: PANNELLO, title: T.titoloPannello })
    void aggiorna($)
    $.clock.every(60000, () => { void aggiorna($) })
    controllaPannello($)
    return avviata
  })

  on('command.run', { command: 'utilizzo' }, async $ => {
    await $.ui.open({ id: PANNELLO, title: T.titoloPannello })
    void aggiorna($)
    return { text: T.pannelloAperto }
  })

  // ogni messaggio della persona: se il piano è oltre la soglia e ci sono crediti API, il lavoro va all'aiutante API
  on('prompt.submit', async ($, e, next) => {
    if (e.command) return next(e)
    try {
      const testoPersona = String((e as any).text ?? '')
      const liv = livelloDi(testoPersona), g = giriEffettivi(await read($, giri), liv), max = tetto(g, liv)
      if (testoPersona.trim().length > 40) await update($, ultimoLivello, () => liv)
      const contesto: string[] = []
      // richieste vere (non le domande di una riga): avviso subito della stima e limiti per il loop
      if (testoPersona.trim().length > 40) {
        $.ui.toast(T_GIRI.avviso(T_GIRI.livelli[liv] ?? liv, MODELLO_LIVELLO[liv], g, dollari(COSTO_GIRO[liv]), dollari(max)))
        contesto.push(`[Pannello Utilizzo] Richiesta di livello ${liv} (modello ${MODELLO_LIVELLO[liv]}). Limiti scelti da Yannis: al massimo ${g} ${g === 1 ? 'giro' : 'giri'} di loop più la revisione finale, spesa massima circa ${max.toFixed(2)} $ ai prezzi API (circa ${COSTO_GIRO[liv].toFixed(2)} $ a giro). Scrivi all'inizio della risposta, in una riga, la stima: livello, giri, costo. Se il lavoro richiede più giri o più spesa, fermati al limite e di' cosa manca e quanto costerebbe continuare. Se il livello stimato è sbagliato, correggilo e dillo.`)
      }
      let L = await read($, limiti)
      try { const u = await $.session.usage(); L = (u.rateLimits ?? []).map((r: Limite) => ({ kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt })) } catch (x) { /* gli ultimi letti */ }
      const ap = await read($, api)
      const p = passaggioApi(L, ap)
      if (p.attivo && ap) {
        const budget = Math.max(0.5, Math.min(max || 5, Math.floor(p.rimasto * 100) / 100))
        contesto.push([
          `[Pannello Utilizzo] Il piano Claude è al ${Math.round(p.piano)}%: dal ${ap.soglia ?? 90}% il lavoro si fa con i crediti API (rimasti circa ${p.rimasto.toFixed(2)} $), non con il piano.`,
          `Non fare tu il lavoro di questo messaggio: scrivi il compito completo (con tutto il contesto che serve) in un file di testo temporaneo e fallo eseguire all'aiutante API con:`,
          `python -I "${ap.agente}" --cartella "<cartella del lavoro>" --titolo "<nome breve>" --budget ${budget} --giri ${g} --modello auto --file "<file del compito>"`,
          `Poi riporta alla persona il risultato e il costo che l'aiutante stampa. Usa meno passi possibile: ogni tuo passo consuma ancora il piano.`,
          `Domande brevi o di una riga puoi risponderle direttamente. Se l'aiutante fallisce per crediti finiti, continua con il piano e dillo.`,
        ].join('\n'))
      }
      return contesto.length ? next({ ...e, context: [...(e.context ?? []), ...contesto] }) : next(e)
    } catch (x) { return next(e) }
  })

  // scelta automatica del modello: una sezione fissa nel prompt di sistema (resta nella cache, costa quasi niente),
  // così Claude dà ai subagenti il modello adatto al lavoro. Si spegne con "scelta_modello": false in config.json.
  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    try {
      const ap = await read($, api)
      if (ap?.scelta === false) return r
      return { ...r, sections: [...r.sections, { id: 'utilizzo:scelta-modello', scope: 'session', text: SCELTA_MODELLO }] }
    } catch (x) { return r }
  })

  // dopo ogni risposta i limiti e la memoria cambiano: si rileggono subito
  let ultimaCompressione = 0
  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId !== undefined) return r
    void aggiorna($)
    // compressione automatica al 40%: solo a fine risposta, al massimo una volta ogni 5 minuti
    try {
      const u = await $.session.usage()
      const p = u.context.percent ?? (u.context.tokens ? (100 * u.context.tokens) / u.context.window : 0)
      const ora = await $.clock.now()
      if (p >= SOGLIA && ora - ultimaCompressione > 300000) {
        ultimaCompressione = ora
        $.clock.after(2000, () => {
          void (async () => {
            await update($, comprimi, () => 'in corso')
            try {
              await comprimiChat($)
              await update($, comprimi, () => '')
            } catch (x) { await mostraErrore($, T.autoFallita(String((x as Error)?.message ?? x).slice(0, 160))) }
            void aggiorna($)
          })()
        })
      }
    } catch (x) { /* si riprova alla prossima risposta */ }
    return r
  })

  // clic su un riquadro del Totale (da titolo-clic.tsx): apre la sua spiegazione, o la chiude se era già aperta
  on('ui.message', async ($, e, next) => {
    const nuovaMisura = (e.data as any)?.misura
    if (typeof nuovaMisura === 'string') { await update($, misura, () => nuovaMisura); await update($, menu, () => ''); return {} }
    // clic sull'icona delle due frecce accanto a ⓘ: rilegge subito la spesa API
    if ((e.data as any)?.ricaricaApi) { await ricaricaApi($); return {} }
    // mese o anno scelto nella griglia del menu (griglia-clic.tsx)
    const nuovoMese = (e.data as any)?.mese, nuovoAnno = (e.data as any)?.anno, nuovoGiorno = (e.data as any)?.giorno
    if (typeof nuovoMese === 'number' || typeof nuovoAnno === 'number' || typeof nuovoGiorno === 'number') {
      await update($, scelta, (v: Scelta | null) => {
        if (!v) return v
        const x = { ...v, ...(typeof nuovoMese === 'number' ? { mese: nuovoMese } : {}), ...(typeof nuovoAnno === 'number' ? { anno: nuovoAnno } : {}), ...(typeof nuovoGiorno === 'number' ? { giorno: nuovoGiorno } : {}) }
        return { ...x, giorno: Math.min(x.giorno, giorniNelMese(x.anno, x.mese)) }
      })
      await update($, menu, () => '')
      return {}
    }
    const id = (e.data as any)?.info
    if (typeof id !== 'string') return next(e)
    await update($, info, (v: string) => (v === id ? '' : id))
    return {}
  })
  // pannello chiuso: un piccolo pulsante sopra la casella dei messaggi per riaprirlo
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if ((e.props as any)?.hasSurvey || !(await read($, chiuso))) return next(e)
    const { Box, Button } = $.ui.resolve(e) as any
    return (
      <Box flexDirection="row" justifyContent="flex-end">
        <Button key="riapri-utilizzo" label={`▤ ${T.titoloPannello}`} onPress={() => {
          void $.ui.open({ id: PANNELLO, title: T.titoloPannello })
          void update($, chiuso, () => false)
          void aggiorna($)
        }} />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANNELLO }, async ($, e) => {
    const { Box, Text, Button, Select, Svg, Client, Link } = $.ui.resolve(e) as any
    const A = TESTI_API[(linguaDa || 'it') as Lingua] ?? TESTI_API.it
    const ap = await read($, api), apApert = await read($, apiAperto), apInfo = await read($, apiInfo)
    const X = TESTI_ALTRI[(linguaDa || 'it') as Lingua] ?? TESTI_ALTRI.en
    const alt = await read($, altri), str = await read($, strumento), przAperti = await read($, prezziAperti), forn = await read($, fornitore)
    const trovati = Object.keys(alt?.fonti ?? {})
    const d = await read($, dati), L = await read($, limiti), mem = await read($, memoria)
    const s = await read($, scelta), mostraTutte = await read($, tutte), err = await read($, errore), espanso = await read($, aperto), elencoAperto = await read($, chatAperte), statoComprimi = await read($, comprimi), menuAperto = await read($, menu), infoAperta = await read($, info), m = await read($, misura)
    const mis = (n: number) => inMisura(n, m)
    const ora = d?.aggiornato ?? Date.now()
    const disegno = (source: string, alt: string, w?: number, hh?: number, interattivo?: boolean) =>
      (Svg ? <Svg source={source} alt={alt} width={w} height={hh} isInteractive={interattivo ? true : undefined} /> : <Text dimColor>{alt}</Text>)
    const barraSvg = (p: number, c: string, alt: string) => disegno(barra(p, c), alt, 260, 10)
    type Cifre = { messaggi: number; richieste: number; token: number; input: number; output: number; cacheScritta: number; cacheLetta: number; scritti?: number }
    // riquadri due per riga. Le righe sono scritte dall'ultima alla prima e mostrate al contrario (column-reverse):
    // così ogni riga è disegnata DOPO quella sotto, e la finestrella che compare sotto un riquadro resta visibile sopra di essa
    const riquadri = (c: Cifre, gruppo: string) => {
      const voci: [string, string, string][] = [
        [T.messaggiInviati, intero(c.messaggi), T.quelliCheScrivi],
        [T.richieste, intero(c.richieste), T.passiClaude],
        [T.tokenTotale, mis(c.token), T.tuttoPassato],
        [T.tokenRiletti, mis(c.cacheLetta), T.rilettiCache],
        [T.perMessaggio, mis(c.messaggi ? c.token / c.messaggi : 0), T.tokenMedia],
        [T.scrittiDaTe, mis(c.scritti ?? 0), T.tokenTuoi],
        [T.scrittiClaude, mis(c.output), T.tokenRisposta],
        [T.nuoviEntrata, mis(c.input + c.cacheScritta), T.tokenPrimaVolta],
      ]
      const riquadro = ([nome, valore, nota]: [string, string, string], n: number) => (
        // titolo e numero disegnati da titolo-clic.tsx: un clic sul riquadro apre la spiegazione sotto, un altro la chiude
        // (niente Button: l'app desktop lo disegna come pulsante nativo e rovina il riquadro)
        <Box key={`${gruppo}-${n}`} position="relative" flexDirection="column" width="48%" borderStyle="round" borderDimColor paddingX={1}>
          {Client && !senzaClic
            ? <Client key={`${gruppo}-${n}-clic`} module="./titolo-clic.tsx" props={{ id: `${gruppo}-${n}`, nome, valore }} />
            : [<Text dimColor size="footnote">{nome}</Text>, <Text bold size="heading">{valore}</Text>]}
          <Box position="absolute" top={3} left={0} right={0} display={infoAperta === `${gruppo}-${n}` ? 'flex' : 'none'} borderStyle="bold" borderColor={BLU} backgroundColor="#1c1c1c" paddingX={1}
            hover={senzaClic ? { display: 'flex' } : undefined}>
            <Text size="caption" color="#e2e8f0">{nota}</Text>
          </Box>
        </Box>
      )
      const righe: any[] = []
      for (let i = 0; i < voci.length; i += 2)
        righe.push(<Box key={`${gruppo}-riga-${i}`} flexDirection="row" justifyContent="space-between">{voci.slice(i, i + 2).map((v, j) => riquadro(v, i + j))}</Box>)
      return <Box flexDirection="column-reverse" gap={1}>{righe.reverse()}</Box>
    }
    // column-reverse con l'elenco al contrario: stesso ordine a schermo, ma ogni elemento è disegnato dopo quelli sotto,
    // così le finestre che si aprono sotto un pulsante restano sopra al resto
    const sezione = (nome: string, ...righe: any[]) => <Box flexDirection="column-reverse" gap={0}>{[titolo(nome), ...righe].reverse()}</Box>
    const titolo = (t: string) => <Text weight="semibold" bold>{t}</Text>

    // limiti
    const nomeLimite = (k: string) => (k === 'five_hour' ? T.ultime5 : k === 'seven_day' ? T.settimanale : k === 'spend_limit' ? T.spesa : k)
    const righeLimiti = L.length
      ? L.map(l => (
          <Box flexDirection="column" key={l.kind}>
            <Text>{nomeLimite(l.kind)}: <Text bold>{l.percentUsed}%</Text></Text>
            {l.resetsAt ? <Text dimColor>{T.siAzzera(quando(l.resetsAt))}</Text> : null}
            {barraSvg(l.percentUsed, coloreLimite(l.percentUsed), `${nomeLimite(l.kind)} ${l.percentUsed}%`)}
          </Box>
        ))
      : [<Text dimColor>{T.limitiDopo}</Text>]
    for (const l of alt?.limiti ?? []) {
      const nome = `${alt?.fonti[l.fonte]?.breve ?? l.fonte} · ${l.minuti >= 1440 ? X.settimana : X.ore(Math.round(l.minuti / 60))}`
      righeLimiti.push(
        <Box flexDirection="column" key={`lim-${l.fonte}-${l.minuti}`}>
          <Text>{nome}: <Text bold>{Math.round(l.percento)}%</Text></Text>
          {l.azzera ? <Text dimColor>{T.siAzzera(quando(new Date(l.azzera).toISOString()))}</Text> : null}
          {barraSvg(l.percento, coloreLimite(l.percento), `${nome} ${Math.round(l.percento)}%`)}
        </Box>,
      )
    }

    // memoria della sessione
    const pMem = mem?.percent ?? (mem?.tokens && mem.window ? (100 * mem.tokens) / mem.window : 0)

    // ---- crediti API: rimasti, scadenza, quanto costerebbe questa chat, riquadro per ricaricare ----
    const soldi = (n: number) => `${dec(n, n >= 100 ? 0 : 2)} $`
    const prezzo: Prezzo = ap?.prezzi?.['claude-opus-5-5'] ?? OPUS
    const adessoMs = Date.now()
    const attivi = (ap?.crediti ?? []).filter(c => !c.scadenza || Date.parse(c.scadenza + 'T00:00:00') > adessoMs)
    const totCredito = attivi.reduce((x, c) => x + c.dollari, 0)
    const rimasto = Math.max(0, totCredito - (ap?.speso ?? 0))
    const dataBreve = (iso: string) => { const x = new Date(iso + 'T00:00:00'); return `${T.giorniBrevi[x.getDay()]} ${x.getDate()} ${T.mesi[x.getMonth()]}` }
    const righeCrediti: any[] = []
    if (!ap || !(ap.crediti ?? []).length) righeCrediti.push(<Text dimColor>{A.nessunCredito}</Text>)
    for (const c of ap?.crediti ?? []) {
      if (!c.scadenza) continue
      const ms = Date.parse(c.scadenza + 'T00:00:00') - adessoMs, gg = Math.ceil(ms / 86400000)
      righeCrediti.push(ms > 0
        ? <Text color={gg <= 7 ? '#f59e0b' : undefined}>{A.scade(dataBreve(c.scadenza), gg)} · {soldi(c.dollari)}</Text>
        : <Text dimColor>{A.scaduto(dataBreve(c.scadenza))}</Text>)
    }
    const dChat = d?.sessioni.find(x => x.id === mem?.id)
    const costoChat = dChat?.u ? costo(prezzo, dChat.u[0], dChat.u[1], dChat.u[2], dChat.u[3]) : 0
    const oggiK = (() => { const o = new Date(); return chiave(o.getFullYear(), o.getMonth(), o.getDate()) })()
    const costoGiorno = (k: string) => { const g = d?.giorni[k]; return g ? costo(prezzo, g.input ?? 0, g.output ?? 0, g.cacheScritta ?? 0, g.cacheLetta ?? 0) : 0 }
    const meseK = oggiK.slice(0, 7)
    const costoMese = Object.keys(d?.giorni ?? {}).filter(k => k.startsWith(meseK)).reduce((x, k) => x + costoGiorno(k), 0)
    const sezioneApi = sezione(A.sez,
      totCredito > 0 ? <Text>{A.rimasti(soldi(rimasto), soldi(totCredito))}</Text> : null,
      totCredito > 0 ? barraSvg(totCredito ? (100 * rimasto) / totCredito : 0, rimasto / Math.max(1, totCredito) < 0.2 ? '#ef4444' : '#22c55e', A.rimasti(soldi(rimasto), soldi(totCredito))) : null,
      // toccando ⓘ la spiegazione compare qui, sopra il box (dove prima c'era la scritta arancione)
      apInfo ? (
        <Box flexDirection="column" borderStyle="round" borderColor={BLU} paddingX={1} gap={1}>
          {/* tutto il testo dei crediti sta qui dentro: si vede solo toccando ⓘ */}
          <Box flexDirection="column">
            {righeCrediti}
            <Text dimColor>{A.lavori(ap?.lavori ?? 0, soldi(ap?.speso ?? 0))}</Text>
            {d ? <Text>{A.questaChat(soldi(costoChat))}</Text> : null}
            {d ? <Text dimColor>{A.oggiMese(soldi(costoGiorno(oggiK)), soldi(costoMese))}</Text> : null}
          </Box>
          {/* scelta automatica del modello: regole, lavori per modello, risparmio rispetto al modello di punta */}
          <Box flexDirection="column">
            <Text bold color={BLU}>{A.sceltaTitolo}: {ap?.scelta === false ? A.sceltaSpenta : A.sceltaAttiva}</Text>
            {ap?.scelta === false ? null : A.sceltaRegole.map((r, i) => <Text key={`regola-${i}`} size="caption">{r}</Text>)}
            {Object.entries(ap?.perModello ?? {}).map(([m, x]) => <Text key={`permod-${m}`} dimColor size="caption">{A.perModello(A.nomeModello[m] ?? m, x.lavori, soldi(x.costo))}</Text>)}
            {(ap?.risparmio ?? 0) > 0 ? <Text color="#22c55e" size="caption">{A.risparmio(soldi(ap?.risparmio ?? 0))}</Text> : null}
          </Box>
          {ap && !ap.chiave ? <Text color="#f59e0b" size="caption">{A.senzaChiave}</Text> : null}
          <Text size="caption">{A.nonClaudeCode}</Text>
          <Text dimColor size="caption">{A.stima}</Text>
        </Box>
      ) : null,
      // il box «Ricarica e quanto costa» con accanto la piccola icona ⓘ: la spiegazione compare solo toccandola
      <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1} gap={0}>
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Button key="api-ricarica" label={`${apApert ? '▾' : '▸'} ${A.apriRicarica}`} onPress={() => { void update($, apiAperto, (v: boolean) => !v) }} />
          <Button key="api-info" label="ⓘ" variant={apInfo ? 'primary' : undefined} onPress={() => { void update($, apiInfo, (v: boolean) => !v) }} />
          {/* 🔄 rilegge subito la spesa API, senza aspettare il minuto né riaprire Claude */}
          {/* due frecce bianche sottili, senza sfondo: il disegno con sopra uno strato invisibile che riceve il clic */}
          {Svg && Client
            ? <Box key="api-ricarica-dati" position="relative" flexShrink={0} flexGrow={0}>
                {disegno(ICONA_RICARICA, A.aggiorna, 22, 22)}
                <Box position="absolute" top={0} left={0} right={0} bottom={0}>
                  <Client key="clic-ricarica-api" module="./griglia-clic.tsx" width="100%" height="100%" props={{ dati: { ricaricaApi: 1 } }} />
                </Box>
              </Box>
            : <Button key="api-ricarica-dati" label="↻" plain onPress={() => { void ricaricaApi($) }} />}
        </Box>
        {apApert ? [
          // 1) quanto costa: etichetta corta a sinistra, prezzo a destra, una riga ciascuno
          <Text key="api-t1" bold color={BLU}>{A.costiTitolo}</Text>,
          ...A.costi.map(([nome, quanto]) => <Box key={`costo-${nome}`} flexDirection="row" justifyContent="space-between"><Text>{nome}</Text><Text bold>{quanto}</Text></Box>),
          <Text key="api-cento" dimColor>{A.conCento} {A.esempiCento.join(' · ')}</Text>,
          // 2) prezzi dei modelli: nome e due numeri, entrata · uscita
          <Box key="api-t2" flexDirection="row" justifyContent="space-between" marginTop={1}><Text bold color={BLU}>{A.prezziTitolo}</Text></Box>,
          <Box key="api-col" flexDirection="row" justifyContent="flex-end"><Text dimColor size="caption">{A.colonne}</Text></Box>,
          ...Object.entries(ap?.prezzi ?? { 'claude-opus-5-5': OPUS }).map(([m, p]) => (
            <Box key={`prezzo-${m}`} flexDirection="row" justifyContent="space-between">
              <Text>{A.nomeModello[m] ?? m}</Text>
              <Text bold>{dec(p.entrata, p.entrata < 1 ? 2 : 0)} $ · {dec(p.uscita, p.uscita < 1 ? 2 : 0)} $</Text>
            </Box>
          )),
          // 3) come ricaricare: tre passi numerati e il link
          <Box key="api-t3" marginTop={1}><Text bold color={BLU}>{A.ricaricaTitolo}</Text></Box>,
          ...A.passi.map((x, i) => <Text key={`passo-${i}`}>{i + 1}. {x}</Text>),
          Link ? <Link key="api-link" href={ap?.ricarica ?? 'https://console.anthropic.com/settings/billing'} label={A.vaiConsole} /> : <Text key="api-link">{ap?.ricarica}</Text>,
          ap?.ultimi?.length ? <Box key="api-t4" marginTop={1}><Text bold color={BLU}>{A.ultimi}</Text></Box> : null,
          ...(ap?.ultimi ?? []).map((l, i) => <Text key={`lav-${i}`} dimColor>{l.data.slice(5, 16).replace('T', ' ')} · {l.titolo} · {A.nomeModello[l.modello] ?? l.modello} · {soldi(l.costo)}</Text>),
        ] : null}
      </Box>,
    )

    // giri di loop per richiesta: si vede solo la scelta attiva (di solito quella consigliata) con il costo del livello
    // riconosciuto dall'IA nell'ultima richiesta, in bianco; toccandola si apre il box con le 5 scelte
    const gScelta = await read($, giri), gAperto = await read($, giriAperto)
    const livNow = ((await read($, ultimoLivello)) || 'medio') as Livello
    const gAttivi = giriEffettivi(gScelta, livNow), consigliato = CONSIGLIATI[livNow]
    const tre = (n: number, attiva: boolean) => (['leggero', 'medio', 'pesante'] as Livello[]).map((l, i) => [
      i ? <Text key={`sep-${n}-${l}`} dimColor> · </Text> : null,
      <Text key={`v-${n}-${l}`} bold={attiva && l === livNow} color={attiva && l === livNow ? '#ffffff' : undefined} dimColor={!(attiva && l === livNow)}>{soldi(tetto(n, l))}</Text>,
    ])
    const scegli = (n: number) => { void update($, giri, () => n); void $.store.set('giri', n); void update($, giriAperto, () => false) }
    const sezioneGiri = sezione(T_GIRI.titolo,
      <Box key="giri-chiuso" flexDirection="row" justifyContent="space-between" alignItems="center">
        <Button key="giri-apri" label={`${gAperto ? '▾' : '▸'} ${T_GIRI.nome(gAttivi)}${gAttivi === consigliato ? ' ✓' : ''}`} onPress={() => { void update($, giriAperto, (v: boolean) => !v) }} />
        <Text><Text dimColor>{T_GIRI.livelli[livNow]} </Text><Text bold color="#ffffff">{soldi(tetto(gAttivi, livNow))}</Text></Text>
      </Box>,
      gAperto ? (
        <Box key="giri-box" flexDirection="column" borderStyle="round" borderDimColor paddingX={1} gap={0}>
          <Box flexDirection="row" justifyContent="flex-end"><Text dimColor size="caption">{T_GIRI.colonne}</Text></Box>
          <Button key="giri-auto" label={`${gScelta === 0 ? '● ' : '○ '}${T_GIRI.auto}`} variant={gScelta === 0 ? 'primary' : undefined} onPress={() => scegli(0)} />
          {OPZIONI_GIRI.map(n => (
            <Box key={`giri-${n}`} flexDirection="row" justifyContent="space-between" alignItems="center">
              <Button key={`giri-scegli-${n}`} label={`${gScelta === n ? '● ' : '○ '}${T_GIRI.nome(n)}${n === consigliato ? ' ✓' : ''}`} variant={gScelta === n ? 'primary' : undefined} onPress={() => scegli(n)} />
              <Text>{tre(n, n === gAttivi)}</Text>
            </Box>
          ))}
          <Text dimColor size="caption">{T_GIRI.nota}</Text>
        </Box>
      ) : null,
    )

    const listino = alt?.listino
    const fornitori = Object.entries(listino?.fornitori ?? {})
    const fScelto = listino?.fornitori[forn] ? forn : fornitori[0]?.[0]
    const cifra = (n: number) => dec(n, n < 1 ? 2 : n < 10 && n % 1 ? 2 : 0)
    const sezionePrezzi = fornitori.length ? (
      <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1} gap={1}>
        <Button key="prezzi-tutti" label={`${przAperti ? '▾' : '▸'} ${X.prezzi(fornitori.length)}`} onPress={() => { void update($, prezziAperti, (v: boolean) => !v) }} />
        {przAperti ? [
          <Box key="prezzi-fornitori" flexDirection="row" flexWrap="wrap" gap={1}>
            {fornitori.map(([id, f]) => <Button key={`forn-${id}`} label={f.nome} variant={id === fScelto ? 'primary' : undefined} onPress={() => { void update($, fornitore, () => id) }} />)}
          </Box>,
          <Box key="prezzi-col" flexDirection="row" justifyContent="flex-end"><Text dimColor size="caption">{X.colonne}</Text></Box>,
          ...Object.entries(listino?.fornitori[fScelto ?? '']?.modelli ?? {}).map(([m, p]) => (
            <Box key={`listino-${m}`} flexDirection="column">
              <Box flexDirection="row" justifyContent="space-between"><Text>{m}</Text><Text bold>{cifra(p.entrata)} $ · {cifra(p.uscita)} $</Text></Box>
              {p.nota ? <Text dimColor size="caption">{p.nota}</Text> : null}
            </Box>
          )),
          <Text key="prezzi-nota" dimColor size="caption">{X.nota}</Text>,
          listino?.letto ? <Text key="prezzi-letto" dimColor size="caption">{X.letto(listino.letto)}</Text> : null,
          (() => {
            const f = listino?.fornitori[fScelto ?? ''], url = f && alt?.link?.[f.link]
            return url ? (Link ? <Link key="prezzi-link" href={url} label={X.pagina(f.nome)} /> : <Text key="prezzi-link">{url}</Text>) : null
          })(),
        ] : null}
      </Box>
    ) : null

    const parti: any[] = [
      // solo mentre conta la prima volta; poi la riga sparisce
      d ? null : <Text dimColor>{T.stoContando}</Text>,
      sezione(T.sezLimiti, <Box flexDirection="column" gap={1}>{righeLimiti}</Box>,
        (() => {
          if (!ap?.presente) return null
          const pa = passaggioApi(L, ap)
          const testo = pa.attivo ? X.apiAttivo(Math.round(pa.piano))
            : pa.manca === 'chiave' ? X.apiChiave : pa.manca === 'agente' ? X.apiAgente : pa.manca === 'crediti' ? X.apiFiniti
              : pa.manca === 'spento' ? X.apiSpento : X.apiPronto(ap.soglia ?? 90)
          return <Text size="caption" color={pa.attivo ? '#22c55e' : pa.manca && pa.manca !== 'spento' ? '#f59e0b' : undefined} dimColor={!pa.attivo && !pa.manca}>{testo}</Text>
        })()),
      (ap as any)?.presente ? sezioneApi : null,
      sezioneGiri,
      sezionePrezzi,
      sezione(T.sezMemoria,
        // comprimere adesso: Claude riassume la chat e libera memoria, senza aspettare il 97%. Chiede conferma.
        <Box flexDirection="row" justifyContent="space-between" alignItems="center">
          <Text><Text bold>{Math.round(pMem)}%</Text><Text dimColor>  {T.autoAl(SOGLIA)}</Text></Text>
          {statoComprimi === 'in corso'
            ? <Text dimColor>{T.comprimo}</Text>
            : statoComprimi === 'conferma'
              ? <Box flexDirection="row" gap={1}>
                  <Button key="comprimi-si" label={T.siComprimi} onPress={async () => {
                    await update($, comprimi, () => 'in corso')
                    try {
                      await comprimiChat($)
                      await update($, comprimi, () => '')
                    } catch (x) {
                      // si mostra il motivo vero per qualche secondo, poi sparisce
                      await mostraErrore($, T.nonRiuscita(String((x as Error)?.message ?? x).slice(0, 160)))
                    }
                    void aggiorna($)
                  }} />
                  <Button key="comprimi-no" label={T.annulla} onPress={() => { void update($, comprimi, () => '') }} />
                </Box>
              : <Button key="comprimi" label={T.comprimiOra} onPress={() => { void update($, comprimi, () => 'conferma') }} />}
        </Box>,
        statoComprimi === 'conferma' ? <Text dimColor>{T.spiegaComprimi}</Text>
          : statoComprimi && statoComprimi !== 'in corso' ? <Text dimColor>{statoComprimi}</Text> : null,
        <Text dimColor>{mem?.tokens ? T.diToken(breve(mem.tokens), breve(mem.window)) : '—'}</Text>,
        mem?.categorie?.length
          ? disegno(strisce(mem.categorie.filter(c => c.nome !== 'Free space'), mem.window), T.composizione, 260, 10)
          : barraSvg(pMem, pMem >= 85 ? '#f59e0b' : BLU, T.memoriaPct(Math.round(pMem)))),
      // il riquadro che spiega cosa c'è nella memoria di questa chat
      mem ? (
        <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1} gap={0}>
          <Button key="contenuto" label={`${espanso ? '▾' : '▸'} ${T.cosaContiene}`} onPress={() => { void update($, aperto, (v: boolean) => !v) }} />
          {espanso ? [
          (() => {
            const d0 = d?.sessioni.find(x => x.id === mem.id)
            return [
              <Text>{d0 && d0.titolo !== 'Senza titolo' ? d0.titolo : T.questaChat}</Text>,
              <Text dimColor>{T.iniziata(mem.inizio ? quando(new Date(mem.inizio).toISOString()) : '—', mem.turni, mem.modello)}</Text>,
            ]
          })(),
          mem.categorie.filter(c => c.nome !== 'Free space').sort((a, b) => b.tokens - a.tokens).map(c => (
            <Box flexDirection="column" key={c.nome}>
              <Text><Text color={colore(c.colore)}>● </Text>{T.memoria[c.nome] ?? c.nome}: <Text bold>{breve(c.tokens)}</Text></Text>
              <Text dimColor>{T.dellaMemoria(Math.round((100 * c.tokens) / Math.max(1, mem.window)))}</Text>
            </Box>
          )),
          mem.categorie.length === 0 ? <Text dimColor>{T.composizioneArriva}</Text> : null,
          (() => { const libero = mem.categorie.find(c => c.nome === 'Free space'); return libero ? <Text dimColor>{T.spazioLibero(breve(libero.tokens))}</Text> : null })(),
          ] : null}
        </Box>
      ) : null,
    ]
    if (err) parti.push(<Text color="red">{T.erroreConteggio(err)}</Text>)
    if (!d) return <Box flexDirection="column" gap={1}>{parti}</Box>
    const scelto = str === 'tutti' && trovati.length ? 'tutti' : str !== 'claude' && alt?.fonti[str] ? str : 'claude'
    const dv: Dati = scelto === 'claude' ? d : scelto === 'tutti' ? unisci([d, ...trovati.map(k => alt!.fonti[k]!.dati)]) : alt!.fonti[scelto]!.dati
    // pulsanti per scegliere lo strumento: solo se sul PC c'è almeno un altro strumento oltre a Claude Code
    const sceltaStrumento = trovati.length ? (
      <Box flexDirection="column" gap={0}>
        <Text dimColor size="footnote">{X.strumento}</Text>
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {[['claude', 'Claude'], ...trovati.map(k => [k, alt!.fonti[k]!.breve]), ['tutti', X.tutti]].map(([k, nome]) => (
            <Button key={`strumento-${k}`} label={nome} variant={k === scelto ? 'primary' : undefined} onPress={() => { void update($, strumento, () => k!) }} />
          ))}
        </Box>
      </Box>
    ) : null
    const nonTrovati = (alt?.cercati ?? []).filter(c => !c.trovato).map(c => c.nome)
    const erroriAltri = (alt?.cercati ?? []).filter(c => c.errore).map(c => <Text color="#f59e0b" size="caption">{X.errore(c.nome, c.errore)}</Text>)

    // sessioni e totali
    const conta = (st: string) => dv.sessioni.filter(x => x.stato === st).length
    const t = dv.totali
    parti.push(
      sceltaStrumento,
      sezione(T.sessioni,
        <Text><Text color={BLU} bold>{conta('al lavoro')}</Text> {T.alLavoro} · <Text bold>{conta('ferma')}</Text> {T.ferme} · <Text color="#ef4444" bold>{conta('bloccata')}</Text> {T.bloccate}</Text>,
        <Text dimColor>{T.suTot(t.sessioni)}</Text>,
        !trovati.length && alt ? <Text dimColor size="caption">{X.nessuno(nonTrovati.join(', '))}</Text> : null,
        ...erroriAltri),
      sezione(T.totale,
        // la misura in cui mostrare i token: un pulsante, e solo quando lo premi compare l'elenco delle scelte.
        // L'elenco si apre SOPRA i box sottostanti: il blocco del pulsante è scritto dopo i riquadri e mostrato prima (column-reverse),
        // così è disegnato per ultimo e la finestra resta in primo piano
        <Box flexDirection="column-reverse" gap={1}>
        {riquadri(t, 'tot')}
        <Box position="relative" flexDirection="column">
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Button key="scegli-misura" label={nomeMisura(m).nome} onPress={() => { void update($, menu, (x: string) => (x === 'misura' ? '' : 'misura')) }} />
          <Text>{T.ugualeToken}</Text>
        </Box>
        {menuAperto === 'misura' ? (
          <Box position="absolute" top={3} left={0} right={0} flexDirection="column" gap={1} borderStyle="round" borderColor={BLU} backgroundColor="#1c1c1c" padding={1}>
            <Box flexDirection="column" alignItems="stretch" gap={1}>
              {Object.keys(MISURE).map(k => (
                <Button key={`misura-${k}`} label={nomeMisura(k).nome.replace(/^1 /, '')} variant={k === m ? 'primary' : undefined} onPress={() => { void update($, misura, () => k); void update($, menu, () => '') }} />
              ))}
            </Box>
            <Text dimColor size="caption">{nomeMisura(m).spiega}</Text>
          </Box>
        ) : null}
        </Box>
        </Box>),
    )

    // grafico del mese
    if (s) {
      const anni = Array.from(new Set(Object.keys(dv.giorni).map(k => Number(k.slice(0, 4))).concat(new Date().getFullYear()))).sort()
      const cambia = (nuova: Partial<Scelta>) => update($, scelta, (v: Scelta | null) => {
        const x = { ...(v ?? s), ...nuova }
        return { ...x, giorno: Math.min(x.giorno, giorniNelMese(x.anno, x.mese)) }
      })
      const adesso = new Date()
      // griglia di scelta: immagine con le caselle (angoli smussati) e sopra, nella stessa disposizione,
      // una zona invisibile per ogni casella che riceve il clic (griglia-clic.tsx)
      const grigliaScelta = (chiave: string, voci: { v: number; nome: string; scelta: boolean; oggi?: boolean }[], colonne: number) => (
        <Box position="relative" flexDirection="column">
          {disegno(grigliaSvg(voci, colonne), chiave === 'giorno' ? T.giorno : chiave === 'mese' ? T.mese : T.anno)}
          {Client && !senzaClic
            ? <Box position="absolute" top={0} left={0} right={0} bottom={0} flexDirection="column">
                {Array.from({ length: Math.ceil(voci.length / colonne) }, (_, r) => (
                  <Box key={`riga-${chiave}-${r}`} flexDirection="row" flexGrow={1}>
                    {Array.from({ length: colonne }, (_, c) => {
                      const x = voci[r * colonne + c]
                      return (
                        <Box key={`zona-${chiave}-${r}-${c}`} width={`${Math.floor(100 / colonne)}%`} flexGrow={1}>
                          {x ? <Client key={`clic-${chiave}-${x.v}`} module="./griglia-clic.tsx" width="100%" height="100%" props={{ dati: { [chiave]: x.v } }} /> : null}
                        </Box>
                      )
                    })}
                  </Box>
                ))}
              </Box>
            : null}
        </Box>
      )
      const sposta = (passi: number) => { const m = s.mese + passi; void cambia({ anno: s.anno + Math.floor(m / 12), mese: ((m % 12) + 12) % 12 }) }
      const g = dv.giorni[chiave(s.anno, s.mese, s.giorno)]
      const mese: Cifre = { messaggi: 0, richieste: 0, token: 0, input: 0, output: 0, cacheScritta: 0, cacheLetta: 0, scritti: 0 }
      for (let i = 1; i <= giorniNelMese(s.anno, s.mese); i++) {
        const x = dv.giorni[chiave(s.anno, s.mese, i)]
        if (x) { mese.token += x.token; mese.messaggi += x.messaggi; mese.richieste += x.richieste ?? 0; mese.input += x.input ?? 0; mese.output += x.output ?? 0; mese.cacheScritta += x.cacheScritta ?? 0; mese.cacheLetta += x.cacheLetta ?? 0; mese.scritti = (mese.scritti ?? 0) + (x.scritti ?? 0) }
      }
      parti.push(sezione(T.perGiorno,
        // giorno, mese e anno al centro, ognuno con il titolo sopra la sua scelta; le frecce dei mesi ai lati
        // frecce dei mesi ai due lati; giorno, mese e anno interi in mezzo (nessuno si restringe, così il testo non si taglia)
        <Box position="relative" flexDirection="row" justifyContent="space-between" alignItems="flex-end" width="100%">
          <Box flexShrink={0}><Button key="mese-prima" label="◀" onPress={() => sposta(-1)} /></Box>
          {([
            [T.giorno, 'giorno', String(s.giorno), Array.from({ length: giorniNelMese(s.anno, s.mese) }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })), (v: string) => cambia({ giorno: Number(v) })],
            [T.mese, 'mese', String(s.mese), T.mesi.map((m, i) => ({ value: String(i), label: m })), (v: string) => cambia({ mese: Number(v) })],
            [T.anno, 'anno', String(s.anno), anni.map(a => ({ value: String(a), label: String(a) })), (v: string) => cambia({ anno: Number(v) })],
          ] as [string, string, string, { value: string; label: string }[], (v: string) => unknown][]).map(([nome, k, valore, opzioni, scegli]) => (
            <Box key={k} position="relative" flexDirection="column" alignItems="center" gap={0} flexShrink={0} marginX={1}>
              <Text dimColor size="footnote">{nome}</Text>
              {/* un pulsante senza frecce: toccandolo si apre sotto una finestra con le scelte una sotto l'altra */}
              <Button key={`scegli-${k}`} label={opzioni.find(o => o.value === valore)?.label ?? valore} onPress={() => { void update($, menu, (m: string) => (m === k ? '' : k)) }} />
              {k === 'anno' && menuAperto === 'anno' && anni.length === 1 ? (
                // senza larghezza fissa: la finestra prende la misura del suo contenuto, così l'anno si legge intero
                <Box position="absolute" top={3} right={0} flexDirection="column" alignItems="center" borderStyle="round" borderColor={BLU} backgroundColor="#1c1c1c" padding={1}>
                  <Button key={`op-anno-${anni[0]}`} label={String(anni[0])} variant="primary" onPress={() => { void cambia({ anno: anni[0] }); void update($, menu, () => '') }} />
                </Box>
              ) : null}
            </Box>
          ))}
          <Box flexShrink={0}><Button key="mese-dopo" label="▶" onPress={() => sposta(1)} /></Box>
          {/* mese e anno: finestra larga quanto tutto il riquadro, le voci una sotto l'altra, sopra il grafico */}
          {menuAperto === 'mese' || (menuAperto === 'anno' && anni.length > 1) ? (
            // griglia disegnata (angoli smussati) con sopra uno strato invisibile che riceve il clic (griglia-clic.tsx)
            <Box position="absolute" top={3} right={0} width={menuAperto === 'anno' && anni.length < 3 ? `${anni.length * 33}%` : '100%'} flexDirection="column" borderStyle="round" borderColor={BLU} backgroundColor="#1c1c1c" padding={1}>
              {grigliaScelta(menuAperto, menuAperto === 'mese'
                ? T.mesi.map((nome, i) => ({ v: i, nome, scelta: i === s.mese, oggi: i === adesso.getMonth() && s.anno === adesso.getFullYear() }))
                : anni.map(a => ({ v: a, nome: String(a), scelta: a === s.anno, oggi: a === adesso.getFullYear() })), menuAperto === 'anno' ? Math.min(3, anni.length) : 3)}
            </Box>
          ) : null}
          {/* giorni: finestra larga quanto tutto il riquadro, numeri in colonne allineate (7 per riga), sopra il grafico */}
          {menuAperto === 'giorno' ? (
            <Box position="absolute" top={3} left={0} right={0} flexDirection="column" borderStyle="round" borderColor={BLU} backgroundColor="#1c1c1c" padding={1}>
              {grigliaScelta('giorno', Array.from({ length: giorniNelMese(s.anno, s.mese) }, (_, i) => ({
                v: i + 1, nome: String(i + 1), scelta: i + 1 === s.giorno,
                oggi: i + 1 === adesso.getDate() && s.mese === adesso.getMonth() && s.anno === adesso.getFullYear(),
              })), 7)}
            </Box>
          ) : null}
        </Box>,
        disegno(grafico(dv, s), T.tokenPerGiorno(T.mesi[s.mese], s.anno), undefined, 120, true),
        <Box flexDirection="column" alignItems="flex-start">
          <Text bold>{s.giorno} {T.mesi[s.mese]} {s.anno}</Text>
          <Text dimColor>{T.rigaGiorno(mis(g?.token ?? 0), g?.messaggi ?? 0)}</Text>
        </Box>,
      ), sezione(T.totaleDi(T.mesi[s.mese], s.anno), riquadri(mese, 'mese')))
    }

    // per chat
    // le chat del mese scelto raggruppate per giorno: i giorni più recenti in cima, e in ogni giorno le chat più recenti
    const km = s ? `${s.anno}-${due(s.mese + 1)}` : ''
    const delMese = dv.sessioni.filter(x => (x.mesi?.[km]?.[0] ?? 0) > 0 || (x.mesi?.[km]?.[1] ?? 0) > 0)
    const giorniMese = Array.from(new Set(delMese.flatMap(x => Object.keys(x.giorni ?? {}).filter(k => k.startsWith(km))))).sort().reverse()
    const elenco = mostraTutte ? giorniMese : giorniMese.slice(0, 7)
    const chat: any[] = []
    for (const g of elenco) {
      const [aa, mm, gg] = g.split('-').map(Number)
      const qui = delMese.map(x => { const v = x.giorni?.[g]; return v && (v[0] > 0 || v[1] > 0) ? { ...x, token: v[0], messaggi: v[1], richieste: v[2] } : null })
        .filter((x): x is NonNullable<typeof x> => !!x).sort((a, b) => b.ultimo - a.ultimo)
      chat.push(
        <Box key={g} flexDirection="column" gap={1}>
          <Text bold color={BLU}>{T.giorni[new Date(aa, mm - 1, gg).getDay()]} {gg} {T.mesi[mm - 1]}</Text>
          {qui.map(x => (
            <Box flexDirection="column" key={`${g}-${x.id}`}>
              <Text bold>{x.stato === 'al lavoro' ? '● ' : x.stato === 'bloccata' ? '■ ' : ''}{(x.titolo === 'Senza titolo' ? T.senzaTitolo : x.titolo).slice(0, 48)}</Text>
              <Text>{T.rigaChat(intero(x.messaggi), mis(x.token), mis(x.richieste ? x.token / x.richieste : 0))}</Text>
              <Text dimColor>{x.progetto} · {T.ultimaAttivita(fa(x.ultimo, Date.now()))}</Text>
            </Box>
          ))}
        </Box>,
      )
    }
    // le singole chat in un riquadro che si apre solo quando lo si vuole guardare
    parti.push(
      <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1} gap={1}>
        <Button key="per-chat" label={`${elencoAperto ? '▾' : '▸'} ${T.perChat(s ? T.mesi[s.mese] + ' ' + s.anno : '', delMese.length)}`} onPress={() => { void update($, chatAperte, (v: boolean) => !v) }} />
        {elencoAperto ? chat : null}
        {elencoAperto && giorniMese.length > 7
          ? <Button key="tutte" label={mostraTutte ? T.mostraMeno : T.mostraTutti(giorniMese.length)} onPress={() => { void update($, tutte, (v: boolean) => !v) }} />
          : null}
      </Box>,
    )
    parti.push(<Text dimColor>{T.notaStati}</Text>)
    parti.push(<Text dimColor size="footnote">{T.creatoDa}</Text>)   // firma dell'autore

    return <Box flexDirection="column-reverse" gap={1}>{[...parti].reverse()}</Box>
  })
}
