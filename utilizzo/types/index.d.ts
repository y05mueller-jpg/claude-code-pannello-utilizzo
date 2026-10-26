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
  // passaggio automatico: file della chiave presente (mai letto), percorso dell'aiutante, acceso o spento, soglia del piano in %
  presente?: boolean
  chiave: boolean
  agente?: string
  auto?: boolean
  soglia?: number
  // scelta automatica del modello: accesa o spenta, lavori e spesa per modello, risparmio stimato rispetto al modello di punta
  scelta?: boolean
  perModello?: Record<string, { lavori: number; costo: number }>
  risparmio?: number
  ultimi: { data: string; titolo: string; modello: string; costo: number; minuti?: number; esito?: string; livello?: string }[]
}

// altri strumenti (strumenti/altri.js): i loro numeri nella stessa forma di Dati, i limiti di Codex e i prezzi di tutti i fornitori
export type PrezzoListino = { entrata: number; uscita: number; cache_letta: number | null; cache_scritta: number | null; valuta: string; nota: string }
export type Altri = {
  aggiornato: number
  fonti: Record<string, { nome: string; breve: string; colore: string; fornitore: string; dati: Dati }>
  limiti: { fonte: string; minuti: number; percento: number; azzera: number }[]
  cercati: { id: string; nome: string; trovato: boolean; errore: string }[]
  listino: { letto: string; fornitori: Record<string, { nome: string; link: string; ricarica?: string; modelli: Record<string, PrezzoListino> }> }
  link: Record<string, string>
}

declare module 'claude-code' {
  interface PluginState {
    utilizzo: { dati: Dati | null; limiti: Limite[]; memoria: Memoria | null; scelta: Scelta | null; tutte: boolean; errore: string; aperto: boolean; chatAperte: boolean; comprimi: string; menu: string; info: string; misura: string; chiuso: boolean; api: Api | null; apiAperto: boolean; apiInfo: boolean; altri: Altri | null; strumento: string; prezziAperti: boolean; fornitore: string; giri: number; giriAperto: boolean; ultimoLivello: string }
  }
}
