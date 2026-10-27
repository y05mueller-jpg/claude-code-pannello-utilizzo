// Regole del ripiego sui crediti API (0.9.1-0.9.2), senza dipendenze: le usa register.tsx e le prova ripiego.test.ts.
import type { Limite } from '../types'

// Le finestre ancora valide: quelle nuove per tipo, più quelle già lette di un tipo che manca adesso
// (la lettura può portare solo le 5 ore) finché non è passato il loro azzeramento.
export function uniscFinestre(nuove: Limite[], vecchie: Limite[], ora = Date.now()): Limite[] {
  const valida = (l: Limite) => !!l.resetsAt && Date.parse(l.resetsAt) > ora   // senza azzeramento noto non si tiene
  const tipi = new Set(nuove.map(l => l.kind))
  return [...nuove, ...vecchie.filter(l => !tipi.has(l.kind) && valida(l))]
}

// Percentuale del piano = la finestra più piena: 5 ore, settimanale (tutti i modelli) e settimanale del modello in uso
// (seven_day_opus, seven_day_sonnet… contano solo se il modello in uso è quello).
export function pianoMassimo(L: Limite[], modello = ''): { piano: number; kind: string } {
  let piano = 0, kind = ''
  for (const l of L) {
    const perModello = /^seven_day_(\w+)$/.exec(l.kind)?.[1]
    if (perModello && !modello.toLowerCase().includes(perModello.toLowerCase())) continue
    const p = Number(l.percentUsed) || 0
    if (p > piano) { piano = p; kind = l.kind }
  }
  return { piano, kind }
}

// Budget del ripiego proporzionato al messaggio: domande brevi o di una riga 0,3 $, lavori medi 1 $,
// lavori pesanti il tetto scelto (o quello calcolato). Messaggi non scritti da Yannis (altre sessioni, plugin): 0,3 $.
export const BUDGET_BREVE = 0.3
export const BUDGET_MEDIO = 1
export type Peso = 'breve' | 'medio' | 'pesante'
export function pesoDi(testo: string, livello: 'leggero' | 'medio' | 'pesante', daYannis: boolean): Peso {
  const t = testo.trim()
  if (!daYannis || livello === 'leggero' || (!t.includes('\n') && t.length <= 200)) return 'breve'
  return livello === 'pesante' ? 'pesante' : 'medio'
}
export function budgetRipiego(peso: Peso, tettoPesante: number, rimasto: number): number {
  const b = peso === 'breve' ? BUDGET_BREVE : peso === 'medio' ? BUDGET_MEDIO : tettoPesante
  return Math.max(BUDGET_BREVE, Math.min(b, Math.floor(rimasto * 100) / 100))
}

// ---- 0.9.2: decisioni del ripiego, separate per poterle provare ----
// L'errore di limite in qualsiasi forma: «You've hit your weekly limit», «5-hour limit reached», «usage limit», «out of extra usage»…
export const RE_LIMITE = /hit your .{0,30}limit|reached your .{0,30}limit|(?:usage|weekly|5-hour|five.hour|session|opus|sonnet) limit|limit (?:reached|exceeded)|rate.?limit|out of (?:extra )?usage|limite/i
// le forme sicure: valgono anche se il turno non è segnato come errore, purché la risposta sia corta (il solo avviso)
const RE_LIMITE_FORTE = /hit your .{0,30}limit|reached your .{0,30}limit|limit reached|out of (?:extra )?usage/i
export function eErroreLimite(reason: string, answer: string): boolean {
  const a = String(answer ?? '')
  return (reason === 'error' && RE_LIMITE.test(a)) || (reason !== 'refusal' && a.trim().length <= 300 && RE_LIMITE_FORTE.test(a))
}
// fin quando vale il limite raggiunto: l'azzeramento della finestra piena più lontana; se non è nota, 5 ore
export function limiteFino(L: Limite[], soglia: number, ora = Date.now()): number {
  const fine = L.filter(l => (Number(l.percentUsed) || 0) >= soglia && l.resetsAt).map(l => Date.parse(l.resetsAt!)).filter(t => t > ora)
  return fine.length ? Math.max(...fine) : ora + 5 * 3600000
}
// il messaggio va all'aiutante? interruttore acceso e: piano oltre la soglia, o limite raggiunto ancora valido, o rilancio dopo l'errore
export function deveRipiegare(acceso: boolean, piano: number, soglia: number, limiteAttivo: boolean, forza = false): boolean {
  return acceso && (forza || piano >= soglia || limiteAttivo)
}
// comandi (/utilizzo, /compact…), comandi di shell (!…) e messaggi interni non si deviano mai
export function nonDeviare(e: { text?: string; command?: unknown; isMeta?: boolean }): boolean {
  return !!e.command || !!e.isMeta || /^\s*[/!]/.test(String(e.text ?? ''))
}
// scritto da Yannis: terminale, telefono (bridge) o app desktop (sdk); il resto (altre sessioni, plugin, notifiche) no
export const daYannisOrigine = (kind?: string) => !kind || kind === 'composer' || kind === 'bridge' || kind === 'sdk'
