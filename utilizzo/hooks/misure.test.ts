import { expect, test } from 'claude-code/testing'
import { MISURE, valoreMisura } from './misure'
import { TESTI } from './testi'

test('le tre nuove unità: riga di chat 8, verso 11, strofa 44 token reali', () => {
  expect(MISURE.chat).toBe(8)
  expect(MISURE.verso).toBe(11)
  expect(MISURE.strofa).toBe(44)
  expect(MISURE.strofa).toBe(4 * MISURE.verso)
  expect(MISURE.chat < MISURE.verso).toBe(true)
})

test('conversioni: 440 token = 10 strofe = 40 versi = 55 righe di chat', () => {
  expect(valoreMisura(440, 'strofa')).toBe(10)
  expect(valoreMisura(440, 'verso')).toBe(40)
  expect(valoreMisura(440, 'chat')).toBe(55)
})

test('conversioni delle unità esistenti invariate e misura sconosciuta = pagina A4', () => {
  expect(valoreMisura(650, 'a4')).toBe(1)
  expect(valoreMisura(200000, 'libri')).toBe(1)
  expect(valoreMisura(3200, 'ore')).toBe(1)
  expect(valoreMisura(123, 'token')).toBe(123)
  expect(valoreMisura(1300, 'boh')).toBe(2)
})

test('ogni lingua ha nome e definizione per ogni misura, con il fattore giusto', () => {
  for (const l of Object.keys(TESTI) as (keyof typeof TESTI)[]) {
    for (const k of Object.keys(MISURE)) {
      const mm = (TESTI[l].misure as any)[k]
      expect(typeof mm.nome).toBe('string')
      expect(mm.spiega.length > 10).toBe(true)
    }
    expect(TESTI[l].misure.verso.spiega.includes('12')).toBe(true)
    expect(TESTI[l].misure.verso.spiega.includes('11')).toBe(true)
    expect(TESTI[l].misure.strofa.spiega.includes('44')).toBe(true)
    expect(TESTI[l].misure.chat.spiega.includes('8')).toBe(true)
  }
  expect(TESTI.it.misure.verso.spiega).toBe('1 Token = 1 verso di 12 sillabe (≈ 11 token reali)')
})
