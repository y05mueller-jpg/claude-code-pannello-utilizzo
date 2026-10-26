// Pannello «Utilizzo» accanto alla chat: limiti delle 5 ore e settimanale, memoria della sessione, sessioni al lavoro,
// ferme o bloccate, messaggi e token (in totale, per chat, per richiesta) e un grafico a barre blu, una per giorno, del
// mese scelto. I numeri delle chat li conta strumenti/conta.js dai file delle conversazioni su questo PC (solo numeri).
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Api, Dati, Limite, Memoria, Prezzo, Scelta } from '../types'
import { TESTI, TESTI_API, codiceLingua, linguaNota, type Lingua } from './testi'

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
const API_JS = "// Crediti API per il pannello \u00abUtilizzo\u00bb (facoltativo): legge ~/.claude/utilizzo-api/config.json (crediti, scadenze, prezzi)\n// e, se c'\u00e8, uso.jsonl (una riga per lavoro: { data, titolo, modello, costo }). Solo numeri. Senza config.json la sezione non compare.\n// Uscita (stdout): JSON { crediti, speso, lavori, prezzi, ricarica, ultimi }\n'use strict';\nconst fs = require('fs'), path = require('path'), os = require('os');\nconst CARTELLA = path.join(os.homedir(), '.claude', 'utilizzo-api');\nlet config = { crediti: [], prezzi_per_milione: {}, ricarica: 'https://console.anthropic.com/settings/billing' };\nlet presente = false;\ntry { config = { ...config, ...JSON.parse(fs.readFileSync(path.join(CARTELLA, 'config.json'), 'utf8')) }; presente = true; } catch (e) {}\nconst lavori = [];\ntry {\n  for (const r of fs.readFileSync(path.join(CARTELLA, 'uso.jsonl'), 'utf8').split('\\n')) {\n    if (!r.trim()) continue;\n    try { const j = JSON.parse(r); lavori.push({ data: j.data, titolo: j.titolo, modello: j.modello, costo: Number(j.costo) || 0, minuti: j.minuti, esito: j.esito }); } catch (e) {}\n  }\n} catch (e) {}\nconst speso = lavori.reduce((s, l) => s + l.costo, 0);\nprocess.stdout.write(JSON.stringify({\n  crediti: config.crediti, speso, lavori: lavori.length, prezzi: config.prezzi_per_milione, ricarica: config.ricarica,\n  presente, chiave: true, ultimi: lavori.slice(-5).reverse(),\n}));\n"
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
  try {
    const ra = await $.process.run(['node', '-e', API_JS], { timeoutMs: 20000 })
    if (ra.exitCode === 0 && ra.stdout) { const x = JSON.parse(ra.stdout) as Api; await update($, api, () => x) }
  } catch (e) { /* la sezione API resta com'era */ }
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
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const avviata = await next(e)
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
          ...(ap?.ultimi ?? []).map((l, i) => <Text key={`lav-${i}`} dimColor>{l.data.slice(5, 16).replace('T', ' ')} · {l.titolo} · {soldi(l.costo)}</Text>),
        ] : null}
      </Box>,
    )

    const parti: any[] = [
      // solo mentre conta la prima volta; poi la riga sparisce
      d ? null : <Text dimColor>{T.stoContando}</Text>,
      sezione(T.sezLimiti, <Box flexDirection="column" gap={1}>{righeLimiti}</Box>),
      (ap as any)?.presente ? sezioneApi : null,
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

    // sessioni e totali
    const conta = (st: string) => d.sessioni.filter(x => x.stato === st).length
    const t = d.totali
    parti.push(
      sezione(T.sessioni,
        <Text><Text color={BLU} bold>{conta('al lavoro')}</Text> {T.alLavoro} · <Text bold>{conta('ferma')}</Text> {T.ferme} · <Text color="#ef4444" bold>{conta('bloccata')}</Text> {T.bloccate}</Text>,
        <Text dimColor>{T.suTot(t.sessioni)}</Text>),
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
      const anni = Array.from(new Set(Object.keys(d.giorni).map(k => Number(k.slice(0, 4))).concat(new Date().getFullYear()))).sort()
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
      const g = d.giorni[chiave(s.anno, s.mese, s.giorno)]
      const mese: Cifre = { messaggi: 0, richieste: 0, token: 0, input: 0, output: 0, cacheScritta: 0, cacheLetta: 0, scritti: 0 }
      for (let i = 1; i <= giorniNelMese(s.anno, s.mese); i++) {
        const x = d.giorni[chiave(s.anno, s.mese, i)]
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
        disegno(grafico(d, s), T.tokenPerGiorno(T.mesi[s.mese], s.anno), undefined, 120, true),
        <Box flexDirection="column" alignItems="flex-start">
          <Text bold>{s.giorno} {T.mesi[s.mese]} {s.anno}</Text>
          <Text dimColor>{T.rigaGiorno(mis(g?.token ?? 0), g?.messaggi ?? 0)}</Text>
        </Box>,
      ), sezione(T.totaleDi(T.mesi[s.mese], s.anno), riquadri(mese, 'mese')))
    }

    // per chat
    // le chat del mese scelto raggruppate per giorno: i giorni più recenti in cima, e in ogni giorno le chat più recenti
    const km = s ? `${s.anno}-${due(s.mese + 1)}` : ''
    const delMese = d.sessioni.filter(x => (x.mesi?.[km]?.[0] ?? 0) > 0 || (x.mesi?.[km]?.[1] ?? 0) > 0)
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

    return <Box flexDirection="column-reverse" gap={1}>{[...parti].reverse()}</Box>
  })
}
