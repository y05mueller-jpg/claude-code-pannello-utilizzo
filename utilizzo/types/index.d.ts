export type Sessione = { id: string; titolo: string; progetto: string; messaggi: number; richieste: number; token: number; ultimo: number; stato: string; mesi?: Record<string, [number, number, number]>; giorni?: Record<string, [number, number, number]> }
export type Giorno = { token: number; messaggi: number; richieste?: number; input?: number; output?: number; cacheScritta?: number; cacheLetta?: number }
export type Dati = {
  aggiornato: number
  totali: { messaggi: number; richieste: number; token: number; input: number; output: number; cacheScritta: number; cacheLetta: number; sessioni: number }
  sessioni: Sessione[]
  giorni: Record<string, Giorno>
}
export type Limite = { kind: string; percentUsed: number; resetsAt?: string }
export type Categoria = { nome: string; tokens: number; colore: string }
export type Memoria = { tokens?: number; window: number; percent?: number; categorie: Categoria[]; id: string; inizio: number; turni: number; modello: string }
export type Scelta = { anno: number; mese: number; giorno: number }

declare module 'claude-code' {
  interface PluginState {
    utilizzo: { dati: Dati | null; limiti: Limite[]; memoria: Memoria | null; scelta: Scelta | null; tutte: boolean; errore: string; aperto: boolean; chatAperte: boolean; comprimi: string; menu: string; info: string; misura: string }
  }
}
