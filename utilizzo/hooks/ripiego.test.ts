import { expect, test } from 'claude-code/testing'
import { budgetRipiego, daYannisOrigine, deveRipiegare, eErroreLimite, limiteFino, limitiSalvati, nonDeviare, pesoDi, pianoMassimo, uniscFinestre } from './ripiego'

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
