import { expect, test } from 'claude-code/testing'
import { budgetRipiego, pesoDi, pianoMassimo, uniscFinestre } from './ripiego'

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
