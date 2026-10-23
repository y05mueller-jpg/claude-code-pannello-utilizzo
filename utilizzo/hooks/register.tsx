// Pannello «Utilizzo» accanto alla chat: limiti delle 5 ore e settimanale, memoria della sessione, sessioni al lavoro,
// ferme o bloccate, messaggi e token (in totale, per chat, per richiesta) e un grafico a barre blu, una per giorno, del
// mese scelto. I numeri delle chat li conta strumenti/conta.js dai file delle conversazioni su questo PC (solo numeri).
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Dati, Limite, Memoria, Scelta } from '../types'

const PANNELLO = 'utilizzo'
// compressione automatica: alla fine di una risposta, se la memoria della chat supera questa soglia
const SOGLIA = 40
let senzaClic = false
// il contatore (strumenti/conta.js) viaggia dentro il modulo e gira con `node -e`: così funziona in qualsiasi cartella
const CONTA_JS = "// Conta messaggi e token di tutte le conversazioni di Claude Code salvate su questo PC (~/.claude/projects).\n// Legge solo i numeri: messaggi dell'utente, token di ogni risposta, data e titolo della chat. Nessun testo esce da qui.\n// Legge ogni file una volta sola e poi solo le righe nuove (cache in ~/.claude/utilizzo-cache.json).\n// Uscita (stdout): JSON { aggiornato, totali, sessioni: [...], giorni: { \"2026-10-23\": { token, messaggi } } }\n'use strict';\nconst fs = require('fs'), path = require('path'), os = require('os');\nconst RADICE = path.join(os.homedir(), '.claude', 'projects');\nconst CACHE = path.join(os.homedir(), '.claude', 'utilizzo-cache.json');\nconst VERSIONE = 4;   // 4: per ogni giorno anche richieste e tipi di token\n\nlet cache = { v: VERSIONE, file: {}, sessioni: {} };\ntry { const c = JSON.parse(fs.readFileSync(CACHE, 'utf8')); if (c.v === VERSIONE) cache = c; } catch (e) {}\n\nfunction fileJsonl(dir, out = []) {\n  let voci; try { voci = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }\n  for (const v of voci) {\n    const p = path.join(dir, v.name);\n    if (v.isDirectory()) fileJsonl(p, out);\n    else if (v.name.endsWith('.jsonl')) out.push(p);\n  }\n  return out;\n}\nconst giorno = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };\nfunction sessione(id) {\n  return cache.sessioni[id] || (cache.sessioni[id] = { messaggi: 0, richieste: 0, token: 0, input: 0, output: 0, cacheScritta: 0, cacheLetta: 0, titolo: '', progetto: '', primo: 0, ultimo: 0, giorni: {}, bloccata: false });\n}\n// un messaggio scritto dalla persona (non i risultati degli strumenti, non gli avvisi del sistema)\nfunction testoUtente(m) {\n  if (!m || m.role !== 'user') return null;\n  if (typeof m.content === 'string') return m.content;\n  if (!Array.isArray(m.content) || m.content.some(b => b && b.type === 'tool_result')) return null;\n  const t = m.content.find(b => b && b.type === 'text');\n  return t ? t.text : null;\n}\n\nfunction leggiRighe(file, da) {\n  const fd = fs.openSync(file, 'r'), dim = fs.fstatSync(fd).size, pezzi = [];\n  let pos = da;\n  const buf = Buffer.alloc(4 * 1024 * 1024);\n  while (pos < dim) { const n = fs.readSync(fd, buf, 0, Math.min(buf.length, dim - pos), pos); if (!n) break; pezzi.push(Buffer.from(buf.subarray(0, n))); pos += n; }\n  fs.closeSync(fd);\n  const tutto = Buffer.concat(pezzi), fine = tutto.lastIndexOf(10);   // solo righe complete\n  if (fine < 0) return { righe: [], nuovoInizio: da };\n  return { righe: tutto.subarray(0, fine).toString('utf8').split('\\n'), nuovoInizio: da + fine + 1 };\n}\n\nconst ora = Date.now(), visti = new Set();\nfor (const file of fileJsonl(RADICE)) {\n  visti.add(file);\n  let st; try { st = fs.statSync(file); } catch (e) { continue; }\n  const f = cache.file[file] || (cache.file[file] = { inizio: 0, richieste: [], mtime: 0 });\n  f.mtime = st.mtimeMs;\n  if (st.size < f.inizio) { f.inizio = 0; f.richieste = []; }   // file riscritto: si ricomincia\n  if (st.size === f.inizio) continue;\n  const secondario = file.includes(`${path.sep}subagents${path.sep}`);\n  const giaContate = new Set(f.richieste);\n  const { righe, nuovoInizio } = leggiRighe(file, f.inizio);\n  for (const r of righe) {\n    if (!r) continue;\n    let j; try { j = JSON.parse(r); } catch (e) { continue; }\n    if (!j.sessionId) continue;\n    const s = sessione(j.sessionId);\n    if (!s.progetto) s.progetto = path.basename(secondario ? path.dirname(path.dirname(path.dirname(file))) : path.dirname(file));\n    if (j.type === 'custom-title' && j.customTitle) { s.titolo = j.customTitle; continue; }\n    const ts = j.timestamp ? Date.parse(j.timestamp) : NaN;\n    if (!isNaN(ts)) { if (!s.primo || ts < s.primo) s.primo = ts; if (ts > s.ultimo) s.ultimo = ts; }\n    if (j.type === 'assistant' && j.message && j.message.usage) {\n      const id = j.requestId || j.message.id;\n      if (id && giaContate.has(id)) continue;   // la stessa risposta \u00e8 scritta su pi\u00f9 righe\n      if (id) { giaContate.add(id); f.richieste.push(id); }\n      const u = j.message.usage, tot = (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);\n      s.richieste++; s.token += tot; s.input += u.input_tokens || 0; s.output += u.output_tokens || 0;\n      s.cacheScritta += u.cache_creation_input_tokens || 0; s.cacheLetta += u.cache_read_input_tokens || 0;\n      if (!isNaN(ts)) {\n        const g = s.giorni[giorno(ts)] || (s.giorni[giorno(ts)] = [0, 0, 0, 0, 0, 0, 0]);\n        g[0] += tot; g[2] = (g[2] || 0) + 1; g[3] = (g[3] || 0) + (u.input_tokens || 0); g[4] = (g[4] || 0) + (u.output_tokens || 0);\n        g[5] = (g[5] || 0) + (u.cache_creation_input_tokens || 0); g[6] = (g[6] || 0) + (u.cache_read_input_tokens || 0);\n      }\n      s.bloccata = false;\n      if (f.richieste.length > 50000) f.richieste = f.richieste.slice(-20000);\n    } else if (j.type === 'assistant' && j.isApiErrorMessage) {\n      const t = JSON.stringify(j.message || '').toLowerCase();\n      s.bloccata = /limit|limite|quota|rate/.test(t);\n    } else if (!secondario && j.type === 'user' && !j.isMeta && !j.isCompactSummary) {\n      const t = testoUtente(j.message);\n      if (t == null || /^\\s*</.test(t)) continue;   // avvisi e comandi interni, non messaggi della persona\n      s.messaggi++;\n      if (!s.titolo && !s.primoTesto) s.primoTesto = t.replace(/\\s+/g, ' ').slice(0, 60);\n      if (!isNaN(ts)) { const g = s.giorni[giorno(ts)] || (s.giorni[giorno(ts)] = [0, 0, 0, 0, 0, 0, 0]); g[1]++; }\n    }\n  }\n  f.inizio = nuovoInizio;\n}\nfor (const k of Object.keys(cache.file)) if (!visti.has(k)) delete cache.file[k];\ntry { fs.writeFileSync(CACHE, JSON.stringify(cache)); } catch (e) {}\n\n// ---- riepilogo ----\nconst ultimoFile = {};\nfor (const [p, f] of Object.entries(cache.file)) { const id = path.basename(p, '.jsonl'); ultimoFile[id] = Math.max(ultimoFile[id] || 0, f.mtime); }\n// per ogni mese \"2026-10\": [token, messaggi, richieste] della chat\nfunction perMese(g) { const m = {}; for (const [k, v] of Object.entries(g)) { const x = m[k.slice(0, 7)] || (m[k.slice(0, 7)] = [0, 0, 0]); x[0] += v[0] || 0; x[1] += v[1] || 0; x[2] += v[2] || 0; } return m; }\nconst totali = { messaggi: 0, richieste: 0, token: 0, input: 0, output: 0, cacheScritta: 0, cacheLetta: 0, sessioni: 0 };\nconst giorni = {}, sessioni = [];\nfor (const [id, s] of Object.entries(cache.sessioni)) {\n  if (!s.richieste && !s.messaggi) continue;\n  for (const k of ['messaggi', 'richieste', 'token', 'input', 'output', 'cacheScritta', 'cacheLetta']) totali[k] += s[k];\n  totali.sessioni++;\n  for (const [g, v] of Object.entries(s.giorni)) {\n    const x = giorni[g] || (giorni[g] = { token: 0, messaggi: 0, richieste: 0, input: 0, output: 0, cacheScritta: 0, cacheLetta: 0 });\n    x.token += v[0] || 0; x.messaggi += v[1] || 0; x.richieste += v[2] || 0; x.input += v[3] || 0; x.output += v[4] || 0; x.cacheScritta += v[5] || 0; x.cacheLetta += v[6] || 0;\n  }\n  const attivita = Math.max(s.ultimo, ultimoFile[id] || 0);\n  const stato = ora - attivita < 120000 ? 'al lavoro' : s.bloccata ? 'bloccata' : 'ferma';\n  sessioni.push({ id, titolo: s.titolo || s.primoTesto || 'Senza titolo', progetto: s.progetto.replace(/^C--Users-[^-]+-(Documents-)?/, '').replace(/-/g, ' '),\n    messaggi: s.messaggi, richieste: s.richieste, token: s.token, ultimo: attivita, stato, mesi: perMese(s.giorni), giorni: Object.fromEntries(Object.entries(s.giorni).map(([k, v]) => [k, [v[0] || 0, v[1] || 0, v[2] || 0]])) });\n}\nsessioni.sort((a, b) => b.ultimo - a.ultimo);\nprocess.stdout.write(JSON.stringify({ aggiornato: ora, totali, sessioni, giorni }));\n"
const BLU = '#3b82f6', BLU_SCURO = '#1d4ed8', GRIGIO = '#94a3b8'
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']

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

// ---- numeri leggibili ----
const intero = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'")
function breve(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace('.', ',') + ' mld'
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',') + ' mln'
  if (n >= 1e4) return Math.round(n / 1e3) + ' mila'
  return intero(n)
}
const due = (n: number) => String(n).padStart(2, '0')
const chiave = (a: number, m: number, g: number) => `${a}-${due(m + 1)}-${due(g)}`
const giorniNelMese = (a: number, m: number) => new Date(a, m + 1, 0).getDate()
function quando(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso), oggi = new Date()
  const ora = `${due(d.getHours())}:${due(d.getMinutes())}`
  if (d.toDateString() === oggi.toDateString()) return `oggi alle ${ora}`
  const domani = new Date(oggi.getTime() + 86400000)
  if (d.toDateString() === domani.toDateString()) return `domani alle ${ora}`
  return `${['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'][d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()].slice(0, 3)} alle ${ora}`
}
function fa(ms: number, ora: number): string {
  const s = Math.max(0, Math.round((ora - ms) / 1000))
  if (s < 90) return 'adesso'
  if (s < 3600) return `${Math.round(s / 60)} min fa`
  if (s < 86400) return `${Math.round(s / 3600)} h fa`
  return `${Math.round(s / 86400)} g fa`
}

// ---- disegni (SVG) ----
function barra(percento: number, colore: string): string {
  const p = Math.max(0, Math.min(100, percento))
  return `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="10" viewBox="0 0 260 10"><rect width="260" height="10" rx="5" fill="#94a3b8" fill-opacity="0.25"/><rect width="${(260 * p) / 100}" height="10" rx="5" fill="${colore}"/></svg>`
}
// nomi italiani delle parti della memoria (come le elenca /context)
const NOMI_MEMORIA: Record<string, string> = {
  'Messages': 'Messaggi della chat', 'System prompt': 'Istruzioni di base', 'System tools': 'Strumenti di Claude', 'MCP tools': 'Strumenti collegati (MCP)',
  'Custom agents': 'Agenti', 'Memory files': 'File di memoria (CLAUDE.md)', 'Skills': 'Competenze (skill)', 'Free space': 'Spazio libero',
  'Autocompact buffer': 'Riserva per il riassunto automatico', 'Slash commands': 'Comandi', 'MCP server instructions': 'Istruzioni degli strumenti collegati',
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
    const titolo = `${i + 1} ${MESI[s.mese]}: ${breve(v)} token, ${d.giorni[chiave(s.anno, s.mese, i + 1)]?.messaggi ?? 0} messaggi`
    barre += `<g><title>${titolo}</title><rect x="${x}" y="0" width="${larg}" height="${base}" fill="transparent"/>`
    barre += `<rect x="${x}" y="${base - h}" width="${larg}" height="${h}" rx="2" fill="${sel ? BLU_SCURO : BLU}"${sel ? ' stroke="#93c5fd" stroke-width="1.5"' : ''}/></g>`
    if ((i + 1) % 5 === 0 || i === 0) barre += `<text x="${x + larg / 2}" y="${alto - 3}" font-size="9" text-anchor="middle" fill="${GRIGIO}" font-family="system-ui">${i + 1}</text>`
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${alto}" viewBox="0 0 ${W} ${alto}"><line x1="0" y1="${base + 0.5}" x2="${W}" y2="${base + 0.5}" stroke="${GRIGIO}" stroke-opacity="0.4"/>${barre}</svg>`
}

// ---- compressione: nell'app desktop un pannello non può comprimere direttamente, quindi manda /compact come un messaggio ----
const ISTRUZIONI = 'Tieni le decisioni prese, i lavori in corso e le cose ancora da fare.'
// un errore resta visibile 6 secondi, poi la scritta sparisce
async function mostraErrore($: any, testo: string) {
  await update($, comprimi, () => testo)
  $.clock.after(6000, () => { void update($, comprimi, (v: string) => (v === testo ? '' : v)) })
}
async function comprimiChat($: any): Promise<string> {
  try {
    const r: any = await $.session.compact({ instructions: ISTRUZIONI })
    return r && r.skip ? 'Compressione annullata' : 'Chat compressa'
  } catch (x) {
    // /compact lanciato come comando, come se la persona lo scrivesse: parte appena Claude non sta lavorando
    await $.command.run({ command: 'compact', args: ISTRUZIONI })
    return 'Compressione avviata (/compact)'
  }
}

// ---- raccolta dei numeri ----
let inCorso = false
async function aggiorna($: any) {
  try {
    // "summary": la composizione della memoria stimata sul PC, senza chiamate in più
    const u = await $.session.usage({ breakdown: 'summary' })
    await update($, limiti, () => (u.rateLimits ?? []).map((r: Limite) => ({ kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt })))
    const categorie = (u.context.breakdown?.categories ?? []).filter((c: any) => !c.isDeferred && c.tokens > 0)
      .map((c: any) => ({ nome: String(c.name), tokens: Number(c.tokens), colore: String(c.color || GRIGIO) }))
    const [id, turni, modello] = await Promise.all([$.session.id(), $.session.turns(), $.session.model()])
    await update($, memoria, () => ({ tokens: u.context.tokens, window: u.context.window, percent: u.context.percent, categorie, id, inizio: u.startedAt, turni, modello }))
  } catch (e) { /* i limiti arrivano con la prossima risposta */ }
  if (inCorso) return
  inCorso = true
  try {
    const r = await $.process.run(['node', '-e', CONTA_JS], { timeoutMs: 300000 })
    if (r.exitCode === 0 && r.stdout) {
      const nuovi = JSON.parse(r.stdout) as Dati
      await update($, dati, () => nuovi)
      await update($, errore, () => '')
      await update($, scelta, (s: Scelta | null) => s ?? (() => { const o = new Date(nuovi.aggiornato); return { anno: o.getFullYear(), mese: o.getMonth(), giorno: o.getDate() } })())
    } else await update($, errore, () => (r.stderr || 'conteggio non riuscito').slice(0, 200))
  } catch (e) {
    await update($, errore, () => String((e as Error)?.message ?? e).slice(0, 200))
  } finally { inCorso = false }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const avviata = await next(e)
    await update($, comprimi, () => '')   // via le scritte rimaste dalle volte prima
    await $.command.register({ name: 'utilizzo', description: 'Apre il pannello Utilizzo (limiti, sessioni, messaggi e token)' })
    void $.ui.open({ id: PANNELLO, title: 'Utilizzo' })
    void aggiorna($)
    $.clock.every(60000, () => { void aggiorna($) })
    return avviata
  })

  on('command.run', { command: 'utilizzo' }, async $ => {
    await $.ui.open({ id: PANNELLO, title: 'Utilizzo' })
    void aggiorna($)
    return { text: 'Pannello Utilizzo aperto.' }
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
            } catch (x) { await mostraErrore($, `Compressione automatica non riuscita: ${String((x as Error)?.message ?? x).slice(0, 160)}`) }
            void aggiorna($)
          })()
        })
      }
    } catch (x) { /* si riprova alla prossima risposta */ }
    return r
  })

  // clic su un riquadro del Totale (da titolo-clic.tsx): apre la sua spiegazione, o la chiude se era già aperta
  on('ui.message', async ($, e, next) => {
    const id = (e.data as any)?.info
    if (typeof id !== 'string') return next(e)
    await update($, info, (v: string) => (v === id ? '' : id))
    return {}
  })
  on('ui.render', { component: 'Pane', requestId: PANNELLO }, async ($, e) => {
    const { Box, Text, Button, Select, Svg, Client } = $.ui.resolve(e) as any
    const d = await read($, dati), L = await read($, limiti), mem = await read($, memoria)
    const s = await read($, scelta), mostraTutte = await read($, tutte), err = await read($, errore), espanso = await read($, aperto), elencoAperto = await read($, chatAperte), statoComprimi = await read($, comprimi), menuAperto = await read($, menu), infoAperta = await read($, info)
    const ora = d?.aggiornato ?? Date.now()
    const disegno = (source: string, alt: string, w?: number, hh?: number, interattivo?: boolean) =>
      (Svg ? <Svg source={source} alt={alt} width={w} height={hh} isInteractive={interattivo ? true : undefined} /> : <Text dimColor>{alt}</Text>)
    const barraSvg = (p: number, c: string, alt: string) => disegno(barra(p, c), alt, 260, 10)
    type Cifre = { messaggi: number; richieste: number; token: number; input: number; output: number; cacheScritta: number; cacheLetta: number }
    // riquadri due per riga. Le righe sono scritte dall'ultima alla prima e mostrate al contrario (column-reverse):
    // così ogni riga è disegnata DOPO quella sotto, e la finestrella che compare sotto un riquadro resta visibile sopra di essa
    const riquadri = (c: Cifre, gruppo: string) => {
      const voci: [string, string, string][] = [
        ['Messaggi inviati', intero(c.messaggi), 'quelli che scrivi tu'],
        ['Richieste', intero(c.richieste), 'i passi di lavoro di Claude'],
        ['Token in totale', breve(c.token), 'tutto ciò che è passato'],
        ['Token riletti', breve(c.cacheLetta), 'riletti dalla cache: costano molto meno'],
        ['Per messaggio', breve(c.messaggi ? c.token / c.messaggi : 0), 'token in media'],
        ['Per richiesta', breve(c.richieste ? c.token / c.richieste : 0), 'token in media'],
        ['Scritti da Claude', breve(c.output), 'token di risposta'],
        ['Nuovi in entrata', breve(c.input + c.cacheScritta), 'token letti la prima volta'],
      ]
      const riquadro = ([nome, valore, nota]: [string, string, string]) => (
        // titolo e numero disegnati da titolo-clic.tsx: un clic sul riquadro apre la spiegazione sotto, un altro la chiude
        // (niente Button: l'app desktop lo disegna come pulsante nativo e rovina il riquadro)
        <Box key={`${gruppo}-${nome}`} position="relative" flexDirection="column" width="48%" borderStyle="round" borderDimColor paddingX={1}>
          {Client && !senzaClic
            ? <Client key={`${gruppo}-${nome}-clic`} module="./titolo-clic.tsx" props={{ id: `${gruppo}-${nome}`, nome, valore }} />
            : [<Text dimColor size="footnote">{nome}</Text>, <Text bold size="heading">{valore}</Text>]}
          <Box position="absolute" top={3} left={0} right={0} display={infoAperta === `${gruppo}-${nome}` ? 'flex' : 'none'} borderStyle="bold" borderColor={BLU} backgroundColor="#1c1c1c" paddingX={1}
            hover={senzaClic ? { display: 'flex' } : undefined}>
            <Text size="caption" color="#e2e8f0">{nota}</Text>
          </Box>
        </Box>
      )
      const righe: any[] = []
      for (let i = 0; i < voci.length; i += 2)
        righe.push(<Box key={`${gruppo}-riga-${i}`} flexDirection="row" justifyContent="space-between">{voci.slice(i, i + 2).map(riquadro)}</Box>)
      return <Box flexDirection="column-reverse" gap={1}>{righe.reverse()}</Box>
    }
    const sezione = (nome: string, ...righe: any[]) => <Box flexDirection="column" gap={0}>{titolo(nome)}{righe}</Box>
    const titolo = (t: string) => <Text weight="semibold" bold>{t}</Text>

    // limiti
    const nomeLimite = (k: string) => (k === 'five_hour' ? 'Ultime 5 ore' : k === 'seven_day' ? 'Settimanale' : k === 'spend_limit' ? 'Spesa' : k)
    const righeLimiti = L.length
      ? L.map(l => (
          <Box flexDirection="column" key={l.kind}>
            <Text>{nomeLimite(l.kind)}: <Text bold>{l.percentUsed}%</Text></Text>
            {l.resetsAt ? <Text dimColor>si azzera {quando(l.resetsAt)}</Text> : null}
            {barraSvg(l.percentUsed, coloreLimite(l.percentUsed), `${nomeLimite(l.kind)} ${l.percentUsed}%`)}
          </Box>
        ))
      : [<Text dimColor>I limiti compaiono dopo la prossima risposta di Claude.</Text>]

    // memoria della sessione
    const pMem = mem?.percent ?? (mem?.tokens && mem.window ? (100 * mem.tokens) / mem.window : 0)

    const parti: any[] = [
      <Box flexDirection="row" justifyContent="space-between" alignItems="center">
        <Text dimColor>{d ? `Aggiornato ${fa(ora, Date.now())}` : 'Sto contando…'}</Text>
      </Box>,
      sezione('Limiti', <Box flexDirection="column" gap={1}>{righeLimiti}</Box>),
      sezione('Memoria di questa chat',
        // comprimere adesso: Claude riassume la chat e libera memoria, senza aspettare il 97%. Chiede conferma.
        <Box flexDirection="row" justifyContent="space-between" alignItems="center">
          <Text><Text bold>{Math.round(pMem)}%</Text><Text dimColor>  auto al {SOGLIA}%</Text></Text>
          {statoComprimi === 'in corso'
            ? <Text dimColor>Comprimo…</Text>
            : statoComprimi === 'conferma'
              ? <Box flexDirection="row" gap={1}>
                  <Button key="comprimi-si" label="Sì, comprimi" onPress={async () => {
                    await update($, comprimi, () => 'in corso')
                    try {
                      await comprimiChat($)
                      await update($, comprimi, () => '')
                    } catch (x) {
                      // si mostra il motivo vero per qualche secondo, poi sparisce
                      await mostraErrore($, `Non riuscita: ${String((x as Error)?.message ?? x).slice(0, 160)}`)
                    }
                    void aggiorna($)
                  }} />
                  <Button key="comprimi-no" label="Annulla" onPress={() => { void update($, comprimi, () => '') }} />
                </Box>
              : <Button key="comprimi" label="Comprimi ora" onPress={() => { void update($, comprimi, () => 'conferma') }} />}
        </Box>,
        statoComprimi === 'conferma' ? <Text dimColor>Claude riassume la chat per liberare memoria: i dettagli più vecchi diventano un riassunto.</Text>
          : statoComprimi && /non riuscita/i.test(statoComprimi) ? <Text dimColor>{statoComprimi}</Text> : null,
        <Text dimColor>{mem?.tokens ? `${breve(mem.tokens)} di ${breve(mem.window)} token` : '—'}</Text>,
        mem?.categorie?.length
          ? disegno(strisce(mem.categorie.filter(c => c.nome !== 'Free space'), mem.window), 'Composizione della memoria', 260, 10)
          : barraSvg(pMem, pMem >= 85 ? '#f59e0b' : BLU, `Memoria ${Math.round(pMem)}%`)),
      // il riquadro che spiega cosa c'è nella memoria di questa chat
      mem ? (
        <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1} gap={0}>
          <Button key="contenuto" label={`${espanso ? '▾' : '▸'} Cosa contiene la chat`} onPress={() => { void update($, aperto, (v: boolean) => !v) }} />
          {espanso ? [
          (() => {
            const d0 = d?.sessioni.find(x => x.id === mem.id)
            return [
              <Text>{d0?.titolo ?? 'Questa chat'}</Text>,
              <Text dimColor>iniziata {mem.inizio ? quando(new Date(mem.inizio).toISOString()).replace('alle', 'alle') : '—'} · {mem.turni} tuoi messaggi · modello {mem.modello}</Text>,
            ]
          })(),
          mem.categorie.filter(c => c.nome !== 'Free space').sort((a, b) => b.tokens - a.tokens).map(c => (
            <Box flexDirection="column" key={c.nome}>
              <Text><Text color={colore(c.colore)}>● </Text>{NOMI_MEMORIA[c.nome] ?? c.nome}: <Text bold>{breve(c.tokens)}</Text></Text>
              <Text dimColor>{Math.round((100 * c.tokens) / Math.max(1, mem.window))}% della memoria</Text>
            </Box>
          )),
          mem.categorie.length === 0 ? <Text dimColor>La composizione arriva al prossimo aggiornamento.</Text> : null,
          (() => { const libero = mem.categorie.find(c => c.nome === 'Free space'); return libero ? <Text dimColor>Spazio ancora libero: {breve(libero.tokens)} token. Al 97% Claude riassume da solo la chat per fare posto.</Text> : null })(),
          ] : null}
        </Box>
      ) : null,
    ]
    if (err) parti.push(<Text color="red">Errore nel conteggio: {err}</Text>)
    if (!d) return <Box flexDirection="column" gap={1}>{parti}</Box>

    // sessioni e totali
    const conta = (st: string) => d.sessioni.filter(x => x.stato === st).length
    const t = d.totali
    parti.push(
      sezione('Sessioni',
        <Text><Text color={BLU} bold>{conta('al lavoro')}</Text> al lavoro · <Text bold>{conta('ferma')}</Text> ferme · <Text color="#ef4444" bold>{conta('bloccata')}</Text> bloccate</Text>,
        <Text dimColor>su {t.sessioni} in tutto</Text>),
      sezione('Totale', riquadri(t, 'tot')),
    )

    // grafico del mese
    if (s) {
      const anni = Array.from(new Set(Object.keys(d.giorni).map(k => Number(k.slice(0, 4))).concat(new Date().getFullYear()))).sort()
      const cambia = (nuova: Partial<Scelta>) => update($, scelta, (v: Scelta | null) => {
        const x = { ...(v ?? s), ...nuova }
        return { ...x, giorno: Math.min(x.giorno, giorniNelMese(x.anno, x.mese)) }
      })
      const sposta = (passi: number) => { const m = s.mese + passi; void cambia({ anno: s.anno + Math.floor(m / 12), mese: ((m % 12) + 12) % 12 }) }
      const g = d.giorni[chiave(s.anno, s.mese, s.giorno)]
      const mese: Cifre = { messaggi: 0, richieste: 0, token: 0, input: 0, output: 0, cacheScritta: 0, cacheLetta: 0 }
      for (let i = 1; i <= giorniNelMese(s.anno, s.mese); i++) {
        const x = d.giorni[chiave(s.anno, s.mese, i)]
        if (x) { mese.token += x.token; mese.messaggi += x.messaggi; mese.richieste += x.richieste ?? 0; mese.input += x.input ?? 0; mese.output += x.output ?? 0; mese.cacheScritta += x.cacheScritta ?? 0; mese.cacheLetta += x.cacheLetta ?? 0 }
      }
      parti.push(sezione('Utilizzo giorno per giorno',
        // giorno, mese e anno al centro, ognuno con il titolo sopra la sua scelta; le frecce dei mesi ai lati
        // frecce dei mesi ai due lati; giorno, mese e anno interi in mezzo (nessuno si restringe, così il testo non si taglia)
        <Box flexDirection="row" justifyContent="space-between" alignItems="flex-end" width="100%">
          <Box flexShrink={0}><Button key="mese-prima" label="◀" onPress={() => sposta(-1)} /></Box>
          {([
            ['Giorno', 'giorno', String(s.giorno), Array.from({ length: giorniNelMese(s.anno, s.mese) }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })), (v: string) => cambia({ giorno: Number(v) })],
            ['Mese', 'mese', String(s.mese), MESI.map((m, i) => ({ value: String(i), label: m })), (v: string) => cambia({ mese: Number(v) })],
            ['Anno', 'anno', String(s.anno), anni.map(a => ({ value: String(a), label: String(a) })), (v: string) => cambia({ anno: Number(v) })],
          ] as [string, string, string, { value: string; label: string }[], (v: string) => unknown][]).map(([nome, k, valore, opzioni, scegli]) => (
            <Box key={k} flexDirection="column" alignItems="center" gap={0} flexShrink={0} marginX={1}>
              <Text dimColor size="footnote">{nome}</Text>
              {/* un pulsante senza frecce: toccandolo si apre sotto l'elenco delle scelte */}
              <Button key={`scegli-${k}`} label={opzioni.find(o => o.value === valore)?.label ?? valore} onPress={() => { void update($, menu, (m: string) => (m === k ? '' : k)) }} />
            </Box>
          ))}
          <Box flexShrink={0}><Button key="mese-dopo" label="▶" onPress={() => sposta(1)} /></Box>
        </Box>,
        menuAperto ? (
          <Box flexDirection="row" flexWrap="wrap" gap={1} justifyContent="center" borderStyle="round" borderDimColor padding={1}>
            {(menuAperto === 'giorno' ? Array.from({ length: giorniNelMese(s.anno, s.mese) }, (_, i) => [String(i + 1), String(i + 1)])
              : menuAperto === 'mese' ? MESI.map((m, i) => [String(i), m])
              : anni.map(a => [String(a), String(a)])).map(([v, nome]) => (
              <Button key={`op-${menuAperto}-${v}`} label={nome} onPress={() => {
                void (menuAperto === 'giorno' ? cambia({ giorno: Number(v) }) : menuAperto === 'mese' ? cambia({ mese: Number(v) }) : cambia({ anno: Number(v) }))
                void update($, menu, () => '')
              }} />
            ))}
          </Box>
        ) : null,
        disegno(grafico(d, s), `Token per giorno di ${MESI[s.mese]} ${s.anno}`, undefined, 120, true),
        <Box flexDirection="column" alignItems="flex-start">
          <Text bold>{s.giorno} {MESI[s.mese]} {s.anno}</Text>
          <Text dimColor>{breve(g?.token ?? 0)} token, {g?.messaggi ?? 0} messaggi</Text>
        </Box>,
      ), sezione(`Totale di ${MESI[s.mese]} ${s.anno}`, riquadri(mese, 'mese')))
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
          <Text bold color={BLU}>{['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'][new Date(aa, mm - 1, gg).getDay()]} {gg} {MESI[mm - 1]}</Text>
          {qui.map(x => (
            <Box flexDirection="column" key={`${g}-${x.id}`}>
              <Text bold>{x.stato === 'al lavoro' ? '● ' : x.stato === 'bloccata' ? '■ ' : ''}{x.titolo.slice(0, 48)}</Text>
              <Text>{intero(x.messaggi)} messaggi · <Text bold>{breve(x.token)}</Text> token · {breve(x.richieste ? x.token / x.richieste : 0)} per richiesta</Text>
              <Text dimColor>{x.progetto} · ultima attività {fa(x.ultimo, Date.now())}</Text>
            </Box>
          ))}
        </Box>,
      )
    }
    // le singole chat in un riquadro che si apre solo quando lo si vuole guardare
    parti.push(
      <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1} gap={1}>
        <Button key="per-chat" label={`${elencoAperto ? '▾' : '▸'} Per chat · ${s ? MESI[s.mese] + ' ' + s.anno : ''} (${delMese.length})`} onPress={() => { void update($, chatAperte, (v: boolean) => !v) }} />
        {elencoAperto ? chat : null}
        {elencoAperto && giorniMese.length > 7
          ? <Button key="tutte" label={mostraTutte ? 'Mostra meno' : `Mostra tutti i giorni (${giorniMese.length})`} onPress={() => { void update($, tutte, (v: boolean) => !v) }} />
          : null}
      </Box>,
    )
    parti.push(<Text dimColor>Gli stati «al lavoro / ferma / bloccata» sono stimati dai file delle chat; i limiti sono quelli dell'ultima risposta.</Text>)

    return <Box flexDirection="column" gap={1}>{parti}</Box>
  })
}
