export type Sessione = { id: string; titolo: string; progetto: string; messaggi: number; richieste: number; token: number; u?: [number, number, number, number]; ultimo: number; stato: string; mesi?: Record<string, [number, number, number]>; giorni?: Record<string, [number, number, number]> }
export type Giorno = { token: number; messaggi: number; richieste?: number; input?: number; output?: number; cacheScritta?: number; cacheLetta?: number; scritti?: number }
export type Dati = {
  aggiornato: number
  totali: { messaggi: number; richieste: number; token: number; input: number; output: number; cacheScritta: number; cacheLetta: number; scritti?: number; sessioni: number }
  sessioni: Sessione[]
  giorni: Record<string, Giorno>
}
export type Limite = { kind: string; percentUsed: number; resetsAt?: string }
export type Categoria = { nome: string; tokens: number; colore: string }
export type Memoria = { tokens?: number; window: number; percent?: number; categorie: Categoria[]; id: string; inizio: number; turni: number; modello: string }
export type Scelta = { anno: number; mese: number; giorno: number }
export type Prezzo = { entrata: number; uscita: number; cache_scritta: number; cache_letta: number }
export type Api = {
  crediti: { dollari: number; arrivo?: string; scadenza?: string; nota?: string }[]
  speso: number
  lavori: number
  prezzi: Record<string, Prezzo>
  ricarica: string
  chiave: boolean
  ultimi: { data: string; titolo: string; modello: string; costo: number; minuti?: number; esito?: string }[]
}

declare module 'claude-code' {
  interface PluginState {
    utilizzo: { dati: Dati | null; limiti: Limite[]; memoria: Memoria | null; scelta: Scelta | null; tutte: boolean; errore: string; aperto: boolean; chatAperte: boolean; comprimi: string; menu: string; info: string; misura: string; chiuso: boolean; api: Api | null; apiAperto: boolean; apiInfo: boolean }
  }
}
