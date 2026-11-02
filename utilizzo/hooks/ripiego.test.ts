import { expect, test } from 'claude-code/testing'
import { modoTetto, aggiungiACoda, budgetRipiego, daYannisOrigine, dividiCoda, leggiCoda, MAX_CODA, statoRimasto, testoDaCoda, deveRipiegare, eErroreLimite, limiteFino, limitiSalvati, nonDeviare, pesoDi, pianoMassimo, uniscFinestre, scriviSeCambia, stessiDati, attendiQuiete } from './ripiego'

const NL = String.fromCharCode(10)
const futuro = new Date(Date.now() + 3 * 86400000).toISOString()

test('5 ore al 24% e settimanale al 100%: il piano è al 100% e il ripiego scatta (soglia 95%)', () => {
  const L = [{ kind: 'five_hour', percentUsed: 24 }, { kind: 'seven_day', percentUsed: 100, resetsAt: futuro }]
  const pm = pianoMassimo(L, 'claude-opus-5-5')
  expect(pm.piano).toBe(100)
  expect(pm.kind).toBe('seven_day')
  expect(pm.piano >= 95).toBe(true)
})

test('una lettura con solo le 5 ore non fa sparire il settimanale ancora valido', () => {
  const L = uniscFinestre([{ kind: 'five_hour', percentUsed: 24 }], [{ kind: 'seven_day', percentUsed: 100, resetsAt: futuro }])
  expect(pianoMassimo(L).piano).toBe(100)
  const scaduto = uniscFinestre([{ kind: 'five_hour', percentUsed: 24 }], [{ kind: 'seven_day', percentUsed: 100, resetsAt: '2020-01-01T00:00:00Z' }])
  expect(pianoMassimo(scaduto).piano).toBe(24)
})

test('il settimanale di un modello conta solo per quel modello', () => {
  const L = [{ kind: 'five_hour', percentUsed: 10 }, { kind: 'seven_day_opus', percentUsed: 97 }]
  expect(pianoMassimo(L, 'claude-opus-5-5').piano).toBe(97)
  expect(pianoMassimo(L, 'claude-sonnet-5-5').piano).toBe(10)
})

test('messaggio breve: budget 0,3 $; medio 1 $; da altre sessioni 0,3 $', () => {
  expect(budgetRipiego(pesoDi('quanto costa?', 'medio', true), 8.75, 40)).toBe(0.3)
  const medio = 'Correggi il pulsante del pannello che non si chiude.\nDeve chiudersi al clic fuori e con Esc, come il menu Tetto.'
  expect(budgetRipiego(pesoDi(medio, 'medio', true), 8.75, 40)).toBe(1)
  expect(budgetRipiego(pesoDi('x'.repeat(2000), 'pesante', false), 8.75, 40)).toBe(0.3)
  expect(budgetRipiego(pesoDi('progetta\n' + 'x'.repeat(300), 'pesante', true), 15, 40)).toBe(15)
})

// ---- collaudo 0.9.2: i 15 casi di Yannis (quelli che si provano senza l'interfaccia) ----
const ora = Date.now(), fra2h = new Date(ora + 2 * 3600000).toISOString()
const scatta = (L: any[], soglia = 95, acceso = true, limite = false, modello = 'claude-opus-5-5') => deveRipiegare(acceso, pianoMassimo(L, modello).piano, soglia, limite)

test('caso 2: 5 ore al 96% e settimanale al 10% -> scatta', () => {
  expect(scatta([{ kind: 'five_hour', percentUsed: 96 }, { kind: 'seven_day', percentUsed: 10 }])).toBe(true)
})
test('caso 3: settimanale Opus al 100% con Opus in uso -> scatta; con Sonnet no', () => {
  const L = [{ kind: 'five_hour', percentUsed: 5 }, { kind: 'seven_day', percentUsed: 40 }, { kind: 'seven_day_opus', percentUsed: 100 }]
  expect(scatta(L)).toBe(true)
  expect(scatta(L, 95, true, false, 'claude-sonnet-5-5')).toBe(false)
})
test('caso 4: tutto sotto il 95% -> non scatta, il messaggio va al modello', () => {
  expect(scatta([{ kind: 'five_hour', percentUsed: 94.9 }, { kind: 'seven_day', percentUsed: 80 }, { kind: 'seven_day_opus', percentUsed: 90 }])).toBe(false)
})
test('caso 5: soglia 90% scelta nel pannello -> rispettata', () => {
  const L = [{ kind: 'five_hour', percentUsed: 91 }]
  expect(scatta(L, 90)).toBe(true)
  expect(scatta(L, 95)).toBe(false)
  expect(scatta([{ kind: 'five_hour', percentUsed: 89 }], 90)).toBe(false)
})
test('caso 6: interruttore spento -> non scatta, nemmeno dopo l\'errore di limite', () => {
  expect(scatta([{ kind: 'seven_day', percentUsed: 100 }], 95, false)).toBe(false)
  expect(deveRipiegare(false, 100, 95, true, true)).toBe(false)
})
test('caso 7: dati non disponibili o lettura parziale -> resta l\'ultimo valore noto', () => {
  const vecchie = [{ kind: 'five_hour', percentUsed: 97, resetsAt: fra2h }, { kind: 'seven_day', percentUsed: 100, resetsAt: futuro }]
  expect(pianoMassimo(uniscFinestre([], vecchie)).piano).toBe(100)                                       // lettura vuota
  expect(scatta(uniscFinestre([{ kind: 'five_hour', percentUsed: 24 }], vecchie))).toBe(true)          // solo le 5 ore
  expect(scatta(uniscFinestre([], [{ kind: 'five_hour', percentUsed: 97, resetsAt: fra2h }]))).toBe(true)
})
test('caso 8: l\'errore di limite in ogni forma fa ripiegare il messaggio dopo e il ritento', () => {
  for (const t of ["You've hit your weekly limit · resets Oct 30", "You've hit your limit · resets 3pm", '5-hour limit reached ∙ resets 3pm',
    'Claude usage limit reached. Your limit will reset at 3pm', 'Weekly limit reached', "You've reached your Opus limit", "You're out of extra usage",
    'API Error: 429 rate_limit_error', 'Hai raggiunto il limite settimanale'])
    expect(eErroreLimite('error', t)).toBe(true)
  expect(eErroreLimite('answer', "You've hit your weekly limit · resets Oct 30")).toBe(true)   // avviso arrivato come risposta
  expect(eErroreLimite('error', 'API Error: 500 overloaded')).toBe(false)
  expect(eErroreLimite('answer', 'Ecco il codice. ' + 'x'.repeat(400) + ' usage limit')).toBe(false)   // una risposta normale non conta
  // il limite resta valido fino all'azzeramento della finestra piena (anche se una lettura dopo dice 24%)
  const fino = limiteFino([{ kind: 'five_hour', percentUsed: 24 }, { kind: 'seven_day', percentUsed: 100, resetsAt: futuro }], 95, ora)
  expect(fino).toBe(Date.parse(futuro))
  expect(deveRipiegare(true, 24, 95, fino > ora)).toBe(true)
  expect(limiteFino([], 95, ora)).toBe(ora + 5 * 3600000)   // azzeramento non noto: 5 ore
})
test('caso 9: tetto scelto rispettato; budget limitato dai crediti rimasti; mai sotto 0,3 $', () => {
  const pesante = 'progetta\n' + 'x'.repeat(300)
  expect(budgetRipiego(pesoDi(pesante, 'pesante', true), 4, 40)).toBe(4)
  expect(budgetRipiego(pesoDi(pesante, 'pesante', true), 25, 12.345)).toBe(12.34)
  expect(budgetRipiego(pesoDi('ok', 'leggero', true), 25, 40)).toBe(0.3)
  expect(budgetRipiego(pesoDi('riga\naltra riga con la richiesta da fare', 'leggero', true), 25, 40)).toBe(0.3)
})
test('caso 10: messaggi da altre sessioni, plugin e notifiche -> non di Yannis (0,3 $, sotto la soglia del banner)', () => {
  for (const k of ['peer', 'task-notification', 'scheduled-trigger', 'plugin']) expect(daYannisOrigine(k)).toBe(false)
  for (const k of [undefined, 'composer', 'bridge', 'sdk']) expect(daYannisOrigine(k)).toBe(true)
  expect(budgetRipiego(pesoDi('progetta\n' + 'x'.repeat(3000), 'pesante', daYannisOrigine('peer')), 25, 40) <= 1.5).toBe(true)
})
test('caso 11: comandi slash, comandi di shell e messaggi interni non si deviano', () => {
  expect(nonDeviare({ text: '/utilizzo' })).toBe(true)
  expect(nonDeviare({ text: '  /compact tieni il ripiego' })).toBe(true)
  expect(nonDeviare({ text: 'x', command: { name: 'compact' } })).toBe(true)
  expect(nonDeviare({ text: '!git status' })).toBe(true)
  expect(nonDeviare({ text: 'interno', isMeta: true })).toBe(true)
  expect(nonDeviare({ text: 'Correggi il pannello' })).toBe(false)
})

// 0.9.3: dopo il riavvio del PC la sessione nuova non ha ancora letto i limiti (rateLimits vuoto fino alla prima risposta)
test('sessione appena avviata, nessun dato nuovo, ultimo valore salvato 100% con reset futuro: il ripiego scatta', () => {
  const salvati = JSON.parse(JSON.stringify([{ kind: 'five_hour', percentUsed: 24, resetsAt: futuro }, { kind: 'seven_day', percentUsed: 100, resetsAt: futuro }]))
  const L = uniscFinestre([], limitiSalvati(salvati))   // sessione nuova: lettura vuota, solo i salvati in $.store
  const pm = pianoMassimo(L, 'claude-opus-5-5')
  expect(pm.piano).toBe(100)
  expect(pm.kind).toBe('seven_day')
  expect(deveRipiegare(true, pm.piano, 95, false)).toBe(true)
  // la prima lettura vera con le sole 5 ore non toglie il settimanale salvato
  expect(pianoMassimo(uniscFinestre([{ kind: 'five_hour', percentUsed: 25 }], L)).piano).toBe(100)
})

test('salvati con azzeramento passato, senza azzeramento o rovinati: non contano', () => {
  const passato = [{ kind: 'seven_day', percentUsed: 100, resetsAt: '2020-01-01T00:00:00Z' }]
  expect(deveRipiegare(true, pianoMassimo(limitiSalvati(passato)).piano, 95, false)).toBe(false)
  expect(limitiSalvati([{ kind: 'seven_day', percentUsed: 100 }]).length).toBe(0)
  expect(limitiSalvati(null).length).toBe(0)
  expect(limitiSalvati([null, 3, { kind: 'seven_day', percentUsed: 'x', resetsAt: futuro }]).length).toBe(0)
})

test('lo stesso tipo da sessione e store vale una volta sola: il più recente', () => {
  // stessa finestra: la più piena, in qualsiasi ordine (un'altra sessione con un valore più vecchio non lo abbassa)
  const L = uniscFinestre([], [{ kind: 'seven_day', percentUsed: 90, resetsAt: futuro }, { kind: 'seven_day', percentUsed: 100, resetsAt: futuro }])
  expect(L.length).toBe(1)
  expect(pianoMassimo(L).piano).toBe(100)
  // finestra nuova (azzeramento più lontano di giorni): vale quella, anche se più vuota
  const dopo = new Date(Date.parse(futuro) + 7 * 86400000).toISOString()
  expect(pianoMassimo(uniscFinestre([], [{ kind: 'seven_day', percentUsed: 100, resetsAt: futuro }, { kind: 'seven_day', percentUsed: 3, resetsAt: dopo }])).piano).toBe(3)
  // la lettura di adesso vince sempre sulle vecchie
  expect(pianoMassimo(uniscFinestre([{ kind: 'seven_day', percentUsed: 50, resetsAt: futuro }], L)).piano).toBe(50)
})

test('0.9.4: con l’aiutante occupato i messaggi vanno in coda, nell’ordine, senza doppioni', () => {
  let c = aggiungiACoda([], 'primo', 'A', 1)
  c = aggiungiACoda(c, 'secondo', 'A', 2)
  c = aggiungiACoda(c, ' secondo ', 'A', 3)   // doppio invio
  c = aggiungiACoda(c, 'di un’altra chat', 'B', 4)
  c = aggiungiACoda(c, '   ', 'A', 5)
  expect(c.length).toBe(3)
  const { miei, altri } = dividiCoda(c, 'A')
  expect(miei.map(x => x.testo)).toEqual(['primo', 'secondo'])
  expect(altri.length).toBe(1)
  expect(testoDaCoda(miei)).toBe('1. primo' + NL + NL + '2. secondo')
  expect(testoDaCoda(miei.slice(0, 1))).toBe('primo')
})

test('0.9.4: la coda letta dallo store scarta le voci rotte e non supera il massimo', () => {
  expect(leggiCoda(null)).toEqual([])
  expect(leggiCoda([{ testo: 'ok', ora: 1, sessione: 'A' }, { testo: '', ora: 1 }, { ora: 2 }, 'x']).length).toBe(1)
  let c: ReturnType<typeof leggiCoda> = []
  for (let i = 0; i < MAX_CODA + 5; i++) c = aggiungiACoda(c, 'm' + i, 'A', i)
  expect(c.length).toBe(MAX_CODA)
  expect(c[0]?.testo).toBe('m5')
})

test('0.9.4: «in corso» rimasto da un ricaricamento non blocca; con l’aiutante vivo sì', () => {
  expect(statoRimasto('in corso', false)).toBe(true)
  expect(statoRimasto('in corso', true)).toBe(false)
  expect(statoRimasto('finito', false)).toBe(false)
  expect(statoRimasto(undefined, false)).toBe(false)
})

// ---- 0.9.6: «Tetto» con o senza costo ----
const base = { apiAttivo: false, inUso: false, servePiano: false, creditiOk: true, finiti: false }

test('Tetto caso 1: API non in uso (piano sotto la soglia) → solo giri, niente costo né ⚠', () => {
  expect(modoTetto(base)).toBe('giri')
})
test('Tetto caso 1b: crediti finiti ma il piano è sotto la soglia e nessun lavoro API → solo giri, niente ⚠', () => {
  expect(modoTetto({ ...base, creditiOk: false, finiti: true })).toBe('giri')
})
test('Tetto caso 1c: aiutante mancante o chiave mancante (crediti non utilizzabili) → solo giri anche se il piano è pieno', () => {
  expect(modoTetto({ ...base, creditiOk: false, servePiano: true })).toBe('giri')
})
test('Tetto caso 2: ripiego attivo con crediti disponibili → giri e costo', () => {
  expect(modoTetto({ ...base, apiAttivo: true, servePiano: true })).toBe('costo')
})
test('Tetto caso 2b: lavoro lanciato con agente.py o ripiego in corso, crediti disponibili → giri e costo', () => {
  expect(modoTetto({ ...base, inUso: true })).toBe('costo')
})
test('Tetto caso 3: l’API serve (piano pieno) ma crediti finiti → solo giri e ⚠', () => {
  expect(modoTetto({ ...base, servePiano: true, creditiOk: false, finiti: true })).toBe('finiti')
})
test('Tetto caso 3b: errore di credito durante il lavoro API → ⚠, mai costo', () => {
  expect(modoTetto({ ...base, inUso: true, creditiOk: false, finiti: true })).toBe('finiti')
})

// ---- 0.9.7: saldo = stima; errore di credito dell'aiutante -> 0 $ e «finiti secondo Anthropic» ----
import { SALDO_URL, eErroreCredito, finitiSecondoAnthropic, leggiSegno, segnoDopoLavoro, stimaSaldo, testoLimiti } from './ripiego'

test('0.9.7: il saldo è una stima: caricati meno registrati (il caso del 27.10: 100 $ - 84,74 $ ≈ 15,26 $)', () => {
  expect(Math.round(stimaSaldo(100, 84.74, null) * 100) / 100).toBe(15.26)
  expect(stimaSaldo(100, 120, null)).toBe(0)
  expect(SALDO_URL).toBe('https://platform.claude.com/settings/billing')
})

test('0.9.7: errori di credito riconosciuti in ogni forma; il limite del piano no', () => {
  expect(eErroreCredito('Credit balance is too low')).toBe(true)
  expect(eErroreCredito('Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing')).toBe(true)
  expect(eErroreCredito("You're out of usage credits")).toBe(true)
  expect(eErroreCredito('API Error: 400 {"type":"invalid_request_error","message":"credit balance is low"}')).toBe(true)
  expect(eErroreCredito('HTTP 402 Payment Required: billing issue')).toBe(true)
  expect(eErroreCredito('crediti finiti')).toBe(true)
  expect(eErroreCredito("You've hit your weekly limit")).toBe(false)
  expect(eErroreCredito('out of extra usage')).toBe(false)
  expect(eErroreCredito('Lavoro finito: tutto a posto')).toBe(false)
})

test('0.9.7: errore di credito -> stima subito a 0 $; vale finché un lavoro successivo non riesce', () => {
  const caricati = 100, speso = 84.74
  const segno = segnoDopoLavoro(null, false, 'Credit balance is too low', caricati, 1000)
  expect(segno).toEqual({ caricati: 100, ora: 1000 })
  expect(stimaSaldo(caricati, speso, segno)).toBe(0)
  expect(finitiSecondoAnthropic(segno, caricati)).toBe(true)
  // un altro errore (rete, limite) non cambia niente
  expect(segnoDopoLavoro(segno, false, 'timeout di rete', caricati, 2000)).toEqual(segno)
  // un lavoro successivo riesce: il segno si toglie e la stima torna a quella calcolata
  const dopo = segnoDopoLavoro(segno, true, '', caricati, 3000)
  expect(dopo).toBe(null)
  expect(Math.round(stimaSaldo(caricati, speso, dopo) * 100) / 100).toBe(15.26)
  // oppure c'è una riga «ok» in uso.jsonl più recente (lavoro lanciato a mano)
  expect(finitiSecondoAnthropic(segno, caricati, 5000)).toBe(false)
  expect(finitiSecondoAnthropic(segno, caricati, 500)).toBe(true)
})

test('0.9.7: una ricarica (crediti caricati in più) toglie il «finiti»; il segno si salva e si rilegge', () => {
  const segno = { caricati: 100, ora: 1000 }
  expect(finitiSecondoAnthropic(segno, 100)).toBe(true)
  expect(finitiSecondoAnthropic(segno, 150)).toBe(false)
  expect(Math.round(stimaSaldo(150, 84.74, segno) * 100) / 100).toBe(65.26)
  expect(leggiSegno(JSON.parse(JSON.stringify(segno)))).toEqual(segno)
  expect(leggiSegno('x')).toBe(null)
  expect(leggiSegno(null)).toBe(null)
})

test('0.9.7: testo ai messaggi, lavoro NON sui crediti API: solo livello e giri, niente costo né «ai prezzi API»', () => {
  const t = testoLimiti({ liv: 'medio', modello: 'Sonnet', g: 2, max: 1, costoGiro: 0.4, suApi: false })
  expect(t).toContain('al massimo 2 giri')
  expect(t).toContain('la stima: livello e giri')
  expect(t).not.toContain('costo')
  expect(t).not.toContain('prezzi API')
  expect(t).not.toContain('spesa massima')
  expect(t).not.toContain('$')
  expect(t).not.toContain('agente.py')
  const alzato = testoLimiti({ liv: 'pesante', modello: 'Opus', g: 12, max: 15, costoGiro: 2.5, suApi: false, alzato: 'tetto scelto' })
  expect(alzato).toContain('al massimo 12 giri')
  expect(alzato).not.toContain('$')
  expect(alzato).not.toContain('--budget')
})

test('0.9.7: testo ai messaggi, lavoro sui crediti API: livello, giri e costo con la spesa massima ai prezzi API', () => {
  const t = testoLimiti({ liv: 'pesante', modello: 'Opus', g: 3, max: 8.75, costoGiro: 2.5, suApi: true })
  expect(t).toContain('al massimo 3 giri')
  expect(t).toContain('spesa massima circa 8.75 $ ai prezzi API')
  expect(t).toContain('la stima: livello, giri, costo')
  expect(t).not.toContain('--budget')
  const alzato = testoLimiti({ liv: 'pesante', modello: 'Opus', g: 12, max: 15, costoGiro: 2.5, suApi: true, alzato: 'tetto scelto' })
  expect(alzato).toContain('--budget fino a 15 e --giri 12')
  expect(testoLimiti({ liv: 'leggero', modello: 'Haiku', g: 1, max: 0.08, costoGiro: 0.05, suApi: true })).toContain('al massimo 1 giro ')
})

// ---- 0.9.8: ridisegni del pannello ----
// motore finto: ogni scrittura di un atom letto dal pannello = un ridisegno (come nel motore vero, anche a valore uguale)
function motoreFinto(iniziali: Record<string, unknown>) {
  const atom: Record<string, unknown> = { ...iniziali }
  let ridisegni = 0
  const metti = (k: string, v: unknown) => scriviSeCambia(async () => atom[k], async x => { atom[k] = x; ridisegni++ }, v)
  return { atom, metti, ridisegni: () => ridisegni }
}
const letture = () => ({   // quello che arriva a ogni lettura (ogni 60 s), con dati invariati: oggetti nuovi, ora di lettura nuova
  dati: { aggiornato: Date.now() + Math.random(), totali: { token: 5 }, sessioni: [{ id: 'a', token: 5 }], giorni: { '2026-11-02': { token: 5 } } },
  api: { presente: true, crediti: [{ dollari: 10, scadenza: '2027-01-01' }] },
  memoria: { tokens: 1200, window: 200000, percent: 0.6, categorie: [], id: 'a', turni: 3 },
  limiti: [{ kind: 'five_hour', percentUsed: 24, resetsAt: futuro }],
  costoSessione: 1.25, errore: '',
  altri: { fonti: { codex: { breve: 'Codex', dati: { aggiornato: Math.random(), giorni: {} } } }, cercati: [] },
})

test('60 s di pannello fermo, dati invariati: nessun ridisegno (prima: 7 per minuto)', async () => {
  const m = motoreFinto({ ...letture(), chiuso: false })
  for (let t = 2000; t <= 60000; t += 2000) {   // controllo del pannello ogni 2 s: scrive solo se cambia
    const su = true
    await m.metti('chiuso', !su)   // come controllaPannello: scrive solo se cambia
    if (t % 60000 === 0) for (const [k, v] of Object.entries(letture())) await m.metti(k, v)   // lettura di ogni minuto
  }
  expect(m.ridisegni()).toBe(0)
})

test('dieci minuti fermi: al massimo un ridisegno, e solo se un dato cambia davvero', async () => {
  const m = motoreFinto(letture())
  for (let i = 0; i < 10; i++) for (const [k, v] of Object.entries(letture())) await m.metti(k, v)
  expect(m.ridisegni()).toBe(0)
  await m.metti('costoSessione', 1.3)
  expect(m.ridisegni()).toBe(1)
  await m.metti('costoSessione', 1.3)
  expect(m.ridisegni()).toBe(1)
})

test("stessiDati: l'ora di lettura non conta, il resto sì", () => {
  expect(stessiDati({ aggiornato: 1, a: [1, 2] }, { aggiornato: 2, a: [1, 2] })).toBe(true)
  expect(stessiDati({ a: [1, 2] }, { a: [1, 3] })).toBe(false)
  expect(stessiDati(null, undefined)).toBe(true)
  expect(stessiDati('', 'x')).toBe(false)
})

test('mentre si scorre i dati nuovi aspettano: scritti solo dopo 1,5 s di quiete', async () => {
  let ora = 0, ultimo = 0, scritto = -1
  const pausa = async (ms: number) => { ora += ms; if (ora < 3000) ultimo = ora - 200 }   // la persona continua a scorrere per 3 s
  let v = 1
  await scriviSeCambia(async () => v, async x => { v = x; scritto = ora }, 2, () => attendiQuiete(() => ultimo, pausa, 1500, 15000, () => ora))
  expect(v).toBe(2)
  expect(scritto >= 3000 + 1000).toBe(true)
})

test('scorrimento senza fine: i dati arrivano comunque dopo al massimo 15 s', async () => {
  let ora = 0
  await attendiQuiete(() => ora, async (ms: number) => { ora += ms }, 1500, 15000, () => ora)
  expect(ora >= 15000 && ora < 17000).toBe(true)
})
