// Testi del pannello in 5 lingue. La lingua si prende dall'impostazione "language" di Claude Code,
// altrimenti dalla lingua del computer; se non è una di queste, inglese.
export type Lingua = 'it' | 'en' | 'de' | 'fr' | 'es'

// la lingua se il testo ne indica davvero una, altrimenti null (es. "auto", "default", vuoto)
export function linguaNota(v: string): Lingua | null {
  const x = String(v || '').toLowerCase().trim()
  if (/^en([-_]|$)|english|ingl/.test(x)) return 'en'
  const c = codiceLingua(x)
  return c === 'en' ? null : c
}

export function codiceLingua(v: string): Lingua {
  const x = String(v || '').toLowerCase().trim()
  if (/^it([-_]|$)|ital/.test(x)) return 'it'
  if (/^de([-_]|$)|deutsch|german|tedesc/.test(x)) return 'de'
  if (/^fr([-_]|$)|fran|french/.test(x)) return 'fr'
  if (/^es([-_]|$)|espa|spanish|spagn|castell/.test(x)) return 'es'
  return 'en'
}

type Misura = { nome: string; spiega: string }
export type Testi = {
  mesi: string[]; giorni: string[]; giorniBrevi: string[]
  mld: string; mln: string; mila: string; migliaia: string; decimale: string
  oggi: (ora: string) => string; domani: (ora: string) => string; giornoAlle: (g: string, ora: string) => string
  adesso: string; minFa: (n: number) => string; hFa: (n: number) => string; gFa: (n: number) => string
  memoria: Record<string, string>
  istruzioni: string
  misure: { a4: Misura; libri: Misura; ore: Misura; token: Misura }
  comando: string; titoloPannello: string; pannelloAperto: string
  autoFallita: (m: string) => string; nonRiuscita: (m: string) => string
  messaggiInviati: string; quelliCheScrivi: string; richieste: string; passiClaude: string
  tokenTotale: string; tuttoPassato: string; tokenRiletti: string; rilettiCache: string
  perMessaggio: string; perRichiesta: string; tokenMedia: string
  scrittiClaude: string; tokenRisposta: string; scrittiDaTe: string; tokenTuoi: string; nuoviEntrata: string; tokenPrimaVolta: string
  ultime5: string; settimanale: string; spesa: string; siAzzera: (q: string) => string; limitiDopo: string
  aggiornato: (f: string) => string; stoContando: string
  sezLimiti: string; sezMemoria: string; autoAl: (n: number) => string
  comprimo: string; siComprimi: string; annulla: string; comprimiOra: string; spiegaComprimi: string
  diToken: (a: string, b: string) => string; composizione: string; memoriaPct: (n: number) => string
  cosaContiene: string; questaChat: string; iniziata: (q: string, turni: number, modello: string) => string
  dellaMemoria: (n: number) => string; composizioneArriva: string; spazioLibero: (n: string) => string
  erroreConteggio: (e: string) => string
  sessioni: string; alLavoro: string; ferme: string; bloccate: string; suTot: (n: number) => string
  totale: string; ugualeToken: string
  perGiorno: string; giorno: string; mese: string; anno: string
  tokenPerGiorno: (m: string, a: number) => string; rigaGiorno: (tok: string, msg: number) => string
  totaleDi: (m: string, a: number) => string; barra: (g: number, m: string, tok: string, msg: number) => string
  rigaChat: (msg: string, tok: string, req: string) => string; ultimaAttivita: (f: string) => string
  perChat: (m: string, n: number) => string; mostraMeno: string; mostraTutti: (n: number) => string
  notaStati: string; senzaTitolo: string
}

const it: Testi = {
  mesi: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
  giorni: ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'],
  giorniBrevi: ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'],
  mld: 'mld', mln: 'mln', mila: 'mila', migliaia: "'", decimale: ',',
  oggi: o => `oggi alle ${o}`, domani: o => `domani alle ${o}`, giornoAlle: (g, o) => `${g} alle ${o}`,
  adesso: 'adesso', minFa: n => `${n} min fa`, hFa: n => `${n} h fa`, gFa: n => `${n} g fa`,
  memoria: {
    'Messages': 'Messaggi della chat', 'System prompt': 'Istruzioni di base', 'System tools': 'Strumenti di Claude', 'MCP tools': 'Strumenti collegati (MCP)',
    'Custom agents': 'Agenti', 'Memory files': 'File di memoria (CLAUDE.md)', 'Skills': 'Competenze (skill)', 'Free space': 'Spazio libero',
    'Autocompact buffer': 'Riserva per il riassunto automatico', 'Slash commands': 'Comandi', 'MCP server instructions': 'Istruzioni degli strumenti collegati',
  },
  istruzioni: 'Tieni le decisioni prese, i lavori in corso e le cose ancora da fare.',
  misure: {
    a4: { nome: '1 pagina A4', spiega: '1 Token = 1 pagina A4 di testo (≈ 650 token reali)' },
    libri: { nome: '1 libro', spiega: '1 Token = 1 libro di 300 pagine (≈ 200 mila token reali)' },
    ore: { nome: '1 ora di scrittura', spiega: "1 Token = 1 ora di una persona che scrive (≈ 3'200 token reali)" },
    token: { nome: '1 token reale', spiega: 'Token reali: i pezzetti di testo che Claude legge e scrive' },
  },
  comando: 'Apre il pannello Utilizzo (limiti, sessioni, messaggi e token)', titoloPannello: 'Utilizzo', pannelloAperto: 'Pannello Utilizzo aperto.',
  autoFallita: m => `Compressione automatica non riuscita: ${m}`, nonRiuscita: m => `Non riuscita: ${m}`,
  messaggiInviati: 'Messaggi inviati', quelliCheScrivi: 'quelli che scrivi tu', richieste: 'Richieste', passiClaude: 'i passi di lavoro di Claude',
  tokenTotale: 'Token in totale', tuttoPassato: 'tutto ciò che è passato', tokenRiletti: 'Token riletti', rilettiCache: 'riletti dalla cache: costano molto meno',
  perMessaggio: 'Per messaggio', perRichiesta: 'Per richiesta', tokenMedia: 'Token in media',
  scrittiDaTe: 'Scritti da te', tokenTuoi: 'Token dei messaggi che hai scritto (stima)', scrittiClaude: 'Scritti da Claude', tokenRisposta: 'Token di risposta', nuoviEntrata: 'Nuovi in entrata', tokenPrimaVolta: 'Token letti la prima volta',
  ultime5: 'Ultime 5 ore', settimanale: 'Settimanale', spesa: 'Spesa', siAzzera: q => `si azzera ${q}`, limitiDopo: 'I limiti compaiono dopo la prossima risposta di Claude.',
  aggiornato: f => `Aggiornato ${f}`, stoContando: 'Sto contando…',
  sezLimiti: 'Limiti', sezMemoria: 'Memoria di questa chat', autoAl: n => `auto al ${n}%`,
  comprimo: 'Comprimo…', siComprimi: 'Sì, comprimi', annulla: 'Annulla', comprimiOra: 'Comprimi ora',
  spiegaComprimi: 'Claude riassume la chat per liberare memoria: i dettagli più vecchi diventano un riassunto.',
  diToken: (a, b) => `${a} di ${b} token (reali)`, composizione: 'Composizione della memoria', memoriaPct: n => `Memoria ${n}%`,
  cosaContiene: 'Cosa contiene la chat', questaChat: 'Questa chat', iniziata: (q, t, m) => `iniziata ${q} · ${t} tuoi messaggi · modello ${m}`,
  dellaMemoria: n => `${n}% della memoria`, composizioneArriva: 'La composizione arriva al prossimo aggiornamento.',
  spazioLibero: n => `Spazio ancora libero: ${n} token. Al 97% Claude riassume da solo la chat per fare posto.`,
  erroreConteggio: e => `Errore nel conteggio: ${e}`,
  sessioni: 'Sessioni', alLavoro: 'al lavoro', ferme: 'ferme', bloccate: 'bloccate', suTot: n => `su ${n} in tutto`,
  totale: 'Totale complessivo', ugualeToken: '= 1 Token',
  perGiorno: 'Utilizzo giorno per giorno', giorno: 'Giorno', mese: 'Mese', anno: 'Anno',
  tokenPerGiorno: (m, a) => `Token per giorno di ${m} ${a}`, rigaGiorno: (t, n) => `${t} Token, ${n} messaggi`,
  totaleDi: (m, a) => `Totale di ${m} ${a}`, barra: (g, m, t, n) => `${g} ${m}: ${t} token, ${n} messaggi`,
  rigaChat: (n, t, r) => `${n} messaggi · ${t} Token · ${r} per richiesta`, ultimaAttivita: f => `ultima attività ${f}`,
  perChat: (m, n) => `Per chat · ${m} (${n})`, mostraMeno: 'Mostra meno', mostraTutti: n => `Mostra tutti i giorni (${n})`,
  notaStati: 'Gli stati «al lavoro / ferma / bloccata» sono stimati dai file delle chat; i limiti sono quelli dell\'ultima risposta.',
  senzaTitolo: 'Senza titolo',
}

const en: Testi = {
  mesi: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  giorni: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  giorniBrevi: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  mld: 'bn', mln: 'M', mila: 'k', migliaia: ',', decimale: '.',
  oggi: o => `today at ${o}`, domani: o => `tomorrow at ${o}`, giornoAlle: (g, o) => `${g} at ${o}`,
  adesso: 'just now', minFa: n => `${n} min ago`, hFa: n => `${n} h ago`, gFa: n => `${n} d ago`,
  memoria: {
    'Messages': 'Chat messages', 'System prompt': 'Base instructions', 'System tools': "Claude's tools", 'MCP tools': 'Connected tools (MCP)',
    'Custom agents': 'Agents', 'Memory files': 'Memory files (CLAUDE.md)', 'Skills': 'Skills', 'Free space': 'Free space',
    'Autocompact buffer': 'Reserve for automatic summary', 'Slash commands': 'Commands', 'MCP server instructions': 'Connected tool instructions',
  },
  istruzioni: 'Keep the decisions made, the work in progress and what is still to do.',
  misure: {
    a4: { nome: '1 A4 page', spiega: '1 Token = 1 A4 page of text (≈ 650 real tokens)' },
    libri: { nome: '1 book', spiega: '1 Token = 1 book of 300 pages (≈ 200k real tokens)' },
    ore: { nome: '1 hour of writing', spiega: '1 Token = 1 hour of a person writing (≈ 3,200 real tokens)' },
    token: { nome: '1 real token', spiega: 'Real tokens: the small pieces of text Claude reads and writes' },
  },
  comando: 'Opens the Usage panel (limits, sessions, messages and tokens)', titoloPannello: 'Usage', pannelloAperto: 'Usage panel opened.',
  autoFallita: m => `Automatic compaction failed: ${m}`, nonRiuscita: m => `Failed: ${m}`,
  messaggiInviati: 'Messages sent', quelliCheScrivi: 'the ones you write', richieste: 'Requests', passiClaude: "Claude's work steps",
  tokenTotale: 'Tokens in total', tuttoPassato: 'everything that went through', tokenRiletti: 'Tokens re-read', rilettiCache: 're-read from cache: much cheaper',
  perMessaggio: 'Per message', perRichiesta: 'Per request', tokenMedia: 'Tokens on average',
  scrittiDaTe: 'Written by you', tokenTuoi: 'Tokens of the messages you wrote (estimate)', scrittiClaude: 'Written by Claude', tokenRisposta: 'Reply tokens', nuoviEntrata: 'New input', tokenPrimaVolta: 'Tokens read for the first time',
  ultime5: 'Last 5 hours', settimanale: 'Weekly', spesa: 'Spend', siAzzera: q => `resets ${q}`, limitiDopo: "Limits appear after Claude's next reply.",
  aggiornato: f => `Updated ${f}`, stoContando: 'Counting…',
  sezLimiti: 'Limits', sezMemoria: 'Memory of this chat', autoAl: n => `auto at ${n}%`,
  comprimo: 'Compacting…', siComprimi: 'Yes, compact', annulla: 'Cancel', comprimiOra: 'Compact now',
  spiegaComprimi: 'Claude summarizes the chat to free memory: older details become a summary.',
  diToken: (a, b) => `${a} of ${b} tokens (real)`, composizione: 'Memory composition', memoriaPct: n => `Memory ${n}%`,
  cosaContiene: 'What the chat contains', questaChat: 'This chat', iniziata: (q, t, m) => `started ${q} · ${t} of your messages · model ${m}`,
  dellaMemoria: n => `${n}% of memory`, composizioneArriva: 'The composition arrives with the next update.',
  spazioLibero: n => `Free space left: ${n} tokens. At 97% Claude summarizes the chat by itself to make room.`,
  erroreConteggio: e => `Counting error: ${e}`,
  sessioni: 'Sessions', alLavoro: 'working', ferme: 'idle', bloccate: 'blocked', suTot: n => `of ${n} in total`,
  totale: 'Overall total', ugualeToken: '= 1 Token',
  perGiorno: 'Usage day by day', giorno: 'Day', mese: 'Month', anno: 'Year',
  tokenPerGiorno: (m, a) => `Tokens per day in ${m} ${a}`, rigaGiorno: (t, n) => `${t} Tokens, ${n} messages`,
  totaleDi: (m, a) => `Total for ${m} ${a}`, barra: (g, m, t, n) => `${m} ${g}: ${t} tokens, ${n} messages`,
  rigaChat: (n, t, r) => `${n} messages · ${t} Tokens · ${r} per request`, ultimaAttivita: f => `last activity ${f}`,
  perChat: (m, n) => `Per chat · ${m} (${n})`, mostraMeno: 'Show less', mostraTutti: n => `Show all days (${n})`,
  notaStati: 'The states "working / idle / blocked" are estimated from the chat files; limits are from the last reply.',
  senzaTitolo: 'Untitled',
}

const de: Testi = {
  mesi: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  giorni: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
  giorniBrevi: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
  mld: 'Mrd.', mln: 'Mio.', mila: 'Tsd.', migliaia: "'", decimale: ',',
  oggi: o => `heute um ${o}`, domani: o => `morgen um ${o}`, giornoAlle: (g, o) => `${g} um ${o}`,
  adesso: 'gerade eben', minFa: n => `vor ${n} Min.`, hFa: n => `vor ${n} Std.`, gFa: n => `vor ${n} T.`,
  memoria: {
    'Messages': 'Chat-Nachrichten', 'System prompt': 'Grundanweisungen', 'System tools': 'Werkzeuge von Claude', 'MCP tools': 'Verbundene Werkzeuge (MCP)',
    'Custom agents': 'Agenten', 'Memory files': 'Speicherdateien (CLAUDE.md)', 'Skills': 'Skills', 'Free space': 'Freier Platz',
    'Autocompact buffer': 'Reserve für die automatische Zusammenfassung', 'Slash commands': 'Befehle', 'MCP server instructions': 'Anweisungen der verbundenen Werkzeuge',
  },
  istruzioni: 'Behalte die getroffenen Entscheidungen, die laufenden Arbeiten und die offenen Aufgaben.',
  misure: {
    a4: { nome: '1 A4-Seite', spiega: '1 Token = 1 A4-Seite Text (≈ 650 echte Token)' },
    libri: { nome: '1 Buch', spiega: '1 Token = 1 Buch mit 300 Seiten (≈ 200 Tsd. echte Token)' },
    ore: { nome: '1 Stunde Schreiben', spiega: "1 Token = 1 Stunde, in der ein Mensch schreibt (≈ 3'200 echte Token)" },
    token: { nome: '1 echter Token', spiega: 'Echte Token: die Textstückchen, die Claude liest und schreibt' },
  },
  comando: 'Öffnet das Panel Nutzung (Limits, Sitzungen, Nachrichten und Token)', titoloPannello: 'Nutzung', pannelloAperto: 'Panel Nutzung geöffnet.',
  autoFallita: m => `Automatische Komprimierung fehlgeschlagen: ${m}`, nonRiuscita: m => `Fehlgeschlagen: ${m}`,
  messaggiInviati: 'Gesendete Nachrichten', quelliCheScrivi: 'die du schreibst', richieste: 'Anfragen', passiClaude: 'die Arbeitsschritte von Claude',
  tokenTotale: 'Token insgesamt', tuttoPassato: 'alles, was durchgelaufen ist', tokenRiletti: 'Erneut gelesene Token', rilettiCache: 'aus dem Cache erneut gelesen: viel günstiger',
  perMessaggio: 'Pro Nachricht', perRichiesta: 'Pro Anfrage', tokenMedia: 'Token im Durchschnitt',
  scrittiDaTe: 'Von dir geschrieben', tokenTuoi: 'Token deiner geschriebenen Nachrichten (Schätzung)', scrittiClaude: 'Von Claude geschrieben', tokenRisposta: 'Antwort-Token', nuoviEntrata: 'Neu eingehend', tokenPrimaVolta: 'Zum ersten Mal gelesene Token',
  ultime5: 'Letzte 5 Stunden', settimanale: 'Wöchentlich', spesa: 'Ausgaben', siAzzera: q => `wird zurückgesetzt ${q}`, limitiDopo: 'Die Limits erscheinen nach der nächsten Antwort von Claude.',
  aggiornato: f => `Aktualisiert ${f}`, stoContando: 'Zähle…',
  sezLimiti: 'Limits', sezMemoria: 'Speicher dieses Chats', autoAl: n => `auto bei ${n}%`,
  comprimo: 'Komprimiere…', siComprimi: 'Ja, komprimieren', annulla: 'Abbrechen', comprimiOra: 'Jetzt komprimieren',
  spiegaComprimi: 'Claude fasst den Chat zusammen, um Speicher freizugeben: ältere Details werden zu einer Zusammenfassung.',
  diToken: (a, b) => `${a} von ${b} Token (echte)`, composizione: 'Zusammensetzung des Speichers', memoriaPct: n => `Speicher ${n}%`,
  cosaContiene: 'Was der Chat enthält', questaChat: 'Dieser Chat', iniziata: (q, t, m) => `begonnen ${q} · ${t} Nachrichten von dir · Modell ${m}`,
  dellaMemoria: n => `${n}% des Speichers`, composizioneArriva: 'Die Zusammensetzung kommt mit der nächsten Aktualisierung.',
  spazioLibero: n => `Noch freier Platz: ${n} Token. Bei 97% fasst Claude den Chat selbst zusammen, um Platz zu schaffen.`,
  erroreConteggio: e => `Fehler beim Zählen: ${e}`,
  sessioni: 'Sitzungen', alLavoro: 'aktiv', ferme: 'ruhend', bloccate: 'blockiert', suTot: n => `von ${n} insgesamt`,
  totale: 'Gesamtsumme', ugualeToken: '= 1 Token',
  perGiorno: 'Nutzung Tag für Tag', giorno: 'Tag', mese: 'Monat', anno: 'Jahr',
  tokenPerGiorno: (m, a) => `Token pro Tag im ${m} ${a}`, rigaGiorno: (t, n) => `${t} Token, ${n} Nachrichten`,
  totaleDi: (m, a) => `Gesamt ${m} ${a}`, barra: (g, m, t, n) => `${g}. ${m}: ${t} Token, ${n} Nachrichten`,
  rigaChat: (n, t, r) => `${n} Nachrichten · ${t} Token · ${r} pro Anfrage`, ultimaAttivita: f => `zuletzt aktiv ${f}`,
  perChat: (m, n) => `Pro Chat · ${m} (${n})`, mostraMeno: 'Weniger anzeigen', mostraTutti: n => `Alle Tage anzeigen (${n})`,
  notaStati: 'Die Zustände «aktiv / ruhend / blockiert» werden aus den Chat-Dateien geschätzt; die Limits stammen aus der letzten Antwort.',
  senzaTitolo: 'Ohne Titel',
}

const fr: Testi = {
  mesi: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  giorni: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
  giorniBrevi: ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'],
  mld: 'Md', mln: 'M', mila: 'k', migliaia: ' ', decimale: ',',
  oggi: o => `aujourd'hui à ${o}`, domani: o => `demain à ${o}`, giornoAlle: (g, o) => `${g} à ${o}`,
  adesso: "à l'instant", minFa: n => `il y a ${n} min`, hFa: n => `il y a ${n} h`, gFa: n => `il y a ${n} j`,
  memoria: {
    'Messages': 'Messages du chat', 'System prompt': 'Instructions de base', 'System tools': 'Outils de Claude', 'MCP tools': 'Outils connectés (MCP)',
    'Custom agents': 'Agents', 'Memory files': 'Fichiers de mémoire (CLAUDE.md)', 'Skills': 'Compétences (skills)', 'Free space': 'Espace libre',
    'Autocompact buffer': 'Réserve pour le résumé automatique', 'Slash commands': 'Commandes', 'MCP server instructions': 'Instructions des outils connectés',
  },
  istruzioni: 'Garde les décisions prises, les travaux en cours et ce qui reste à faire.',
  misure: {
    a4: { nome: '1 page A4', spiega: '1 Token = 1 page A4 de texte (≈ 650 vrais tokens)' },
    libri: { nome: '1 livre', spiega: '1 Token = 1 livre de 300 pages (≈ 200 k vrais tokens)' },
    ore: { nome: "1 heure d'écriture", spiega: "1 Token = 1 heure d'une personne qui écrit (≈ 3 200 vrais tokens)" },
    token: { nome: '1 vrai token', spiega: 'Vrais tokens : les petits morceaux de texte que Claude lit et écrit' },
  },
  comando: "Ouvre le panneau Utilisation (limites, sessions, messages et tokens)", titoloPannello: 'Utilisation', pannelloAperto: 'Panneau Utilisation ouvert.',
  autoFallita: m => `Compression automatique échouée : ${m}`, nonRiuscita: m => `Échec : ${m}`,
  messaggiInviati: 'Messages envoyés', quelliCheScrivi: 'ceux que tu écris', richieste: 'Requêtes', passiClaude: 'les étapes de travail de Claude',
  tokenTotale: 'Tokens au total', tuttoPassato: 'tout ce qui est passé', tokenRiletti: 'Tokens relus', rilettiCache: 'relus depuis le cache : bien moins chers',
  perMessaggio: 'Par message', perRichiesta: 'Par requête', tokenMedia: 'Tokens en moyenne',
  scrittiDaTe: 'Écrits par toi', tokenTuoi: 'Tokens des messages que tu as écrits (estimation)', scrittiClaude: 'Écrits par Claude', tokenRisposta: 'Tokens de réponse', nuoviEntrata: 'Nouveaux en entrée', tokenPrimaVolta: 'Tokens lus pour la première fois',
  ultime5: 'Dernières 5 heures', settimanale: 'Hebdomadaire', spesa: 'Dépenses', siAzzera: q => `remise à zéro ${q}`, limitiDopo: 'Les limites apparaissent après la prochaine réponse de Claude.',
  aggiornato: f => `Mis à jour ${f}`, stoContando: 'Comptage…',
  sezLimiti: 'Limites', sezMemoria: 'Mémoire de ce chat', autoAl: n => `auto à ${n} %`,
  comprimo: 'Compression…', siComprimi: 'Oui, compresser', annulla: 'Annuler', comprimiOra: 'Compresser',
  spiegaComprimi: 'Claude résume le chat pour libérer de la mémoire : les détails plus anciens deviennent un résumé.',
  diToken: (a, b) => `${a} sur ${b} tokens (réels)`, composizione: 'Composition de la mémoire', memoriaPct: n => `Mémoire ${n} %`,
  cosaContiene: 'Ce que contient le chat', questaChat: 'Ce chat', iniziata: (q, t, m) => `commencé ${q} · ${t} de tes messages · modèle ${m}`,
  dellaMemoria: n => `${n} % de la mémoire`, composizioneArriva: 'La composition arrive à la prochaine mise à jour.',
  spazioLibero: n => `Espace encore libre : ${n} tokens. À 97 %, Claude résume le chat tout seul pour faire de la place.`,
  erroreConteggio: e => `Erreur de comptage : ${e}`,
  sessioni: 'Sessions', alLavoro: 'au travail', ferme: 'arrêtées', bloccate: 'bloquées', suTot: n => `sur ${n} au total`,
  totale: 'Total général', ugualeToken: '= 1 Token',
  perGiorno: 'Utilisation jour par jour', giorno: 'Jour', mese: 'Mois', anno: 'Année',
  tokenPerGiorno: (m, a) => `Tokens par jour en ${m} ${a}`, rigaGiorno: (t, n) => `${t} Tokens, ${n} messages`,
  totaleDi: (m, a) => `Total de ${m} ${a}`, barra: (g, m, t, n) => `${g} ${m} : ${t} tokens, ${n} messages`,
  rigaChat: (n, t, r) => `${n} messages · ${t} Tokens · ${r} par requête`, ultimaAttivita: f => `dernière activité ${f}`,
  perChat: (m, n) => `Par chat · ${m} (${n})`, mostraMeno: 'Afficher moins', mostraTutti: n => `Afficher tous les jours (${n})`,
  notaStati: 'Les états « au travail / arrêtée / bloquée » sont estimés à partir des fichiers des chats ; les limites sont celles de la dernière réponse.',
  senzaTitolo: 'Sans titre',
}

const es: Testi = {
  mesi: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  giorni: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
  giorniBrevi: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
  mld: 'mil M', mln: 'M', mila: 'mil', migliaia: '.', decimale: ',',
  oggi: o => `hoy a las ${o}`, domani: o => `mañana a las ${o}`, giornoAlle: (g, o) => `${g} a las ${o}`,
  adesso: 'ahora', minFa: n => `hace ${n} min`, hFa: n => `hace ${n} h`, gFa: n => `hace ${n} d`,
  memoria: {
    'Messages': 'Mensajes del chat', 'System prompt': 'Instrucciones básicas', 'System tools': 'Herramientas de Claude', 'MCP tools': 'Herramientas conectadas (MCP)',
    'Custom agents': 'Agentes', 'Memory files': 'Archivos de memoria (CLAUDE.md)', 'Skills': 'Habilidades (skills)', 'Free space': 'Espacio libre',
    'Autocompact buffer': 'Reserva para el resumen automático', 'Slash commands': 'Comandos', 'MCP server instructions': 'Instrucciones de las herramientas conectadas',
  },
  istruzioni: 'Conserva las decisiones tomadas, los trabajos en curso y lo que queda por hacer.',
  misure: {
    a4: { nome: '1 página A4', spiega: '1 Token = 1 página A4 de texto (≈ 650 tokens reales)' },
    libri: { nome: '1 libro', spiega: '1 Token = 1 libro de 300 páginas (≈ 200 mil tokens reales)' },
    ore: { nome: '1 hora de escritura', spiega: '1 Token = 1 hora de una persona escribiendo (≈ 3.200 tokens reales)' },
    token: { nome: '1 token real', spiega: 'Tokens reales: los trocitos de texto que Claude lee y escribe' },
  },
  comando: 'Abre el panel Uso (límites, sesiones, mensajes y tokens)', titoloPannello: 'Uso', pannelloAperto: 'Panel Uso abierto.',
  autoFallita: m => `La compresión automática falló: ${m}`, nonRiuscita: m => `Falló: ${m}`,
  messaggiInviati: 'Mensajes enviados', quelliCheScrivi: 'los que escribes tú', richieste: 'Solicitudes', passiClaude: 'los pasos de trabajo de Claude',
  tokenTotale: 'Tokens en total', tuttoPassato: 'todo lo que ha pasado', tokenRiletti: 'Tokens releídos', rilettiCache: 'releídos de la caché: cuestan mucho menos',
  perMessaggio: 'Por mensaje', perRichiesta: 'Por solicitud', tokenMedia: 'Tokens de media',
  scrittiDaTe: 'Escritos por ti', tokenTuoi: 'Tokens de los mensajes que escribiste (estimación)', scrittiClaude: 'Escritos por Claude', tokenRisposta: 'Tokens de respuesta', nuoviEntrata: 'Nuevos de entrada', tokenPrimaVolta: 'Tokens leídos por primera vez',
  ultime5: 'Últimas 5 horas', settimanale: 'Semanal', spesa: 'Gasto', siAzzera: q => `se reinicia ${q}`, limitiDopo: 'Los límites aparecen tras la próxima respuesta de Claude.',
  aggiornato: f => `Actualizado ${f}`, stoContando: 'Contando…',
  sezLimiti: 'Límites', sezMemoria: 'Memoria de este chat', autoAl: n => `auto al ${n}%`,
  comprimo: 'Comprimiendo…', siComprimi: 'Sí, comprimir', annulla: 'Cancelar', comprimiOra: 'Comprimir ahora',
  spiegaComprimi: 'Claude resume el chat para liberar memoria: los detalles más antiguos se convierten en un resumen.',
  diToken: (a, b) => `${a} de ${b} tokens (reales)`, composizione: 'Composición de la memoria', memoriaPct: n => `Memoria ${n}%`,
  cosaContiene: 'Qué contiene el chat', questaChat: 'Este chat', iniziata: (q, t, m) => `iniciado ${q} · ${t} mensajes tuyos · modelo ${m}`,
  dellaMemoria: n => `${n}% de la memoria`, composizioneArriva: 'La composición llega con la próxima actualización.',
  spazioLibero: n => `Espacio aún libre: ${n} tokens. Al 97% Claude resume el chat por sí solo para hacer sitio.`,
  erroreConteggio: e => `Error en el recuento: ${e}`,
  sessioni: 'Sesiones', alLavoro: 'trabajando', ferme: 'paradas', bloccate: 'bloqueadas', suTot: n => `de ${n} en total`,
  totale: 'Total general', ugualeToken: '= 1 Token',
  perGiorno: 'Uso día a día', giorno: 'Día', mese: 'Mes', anno: 'Año',
  tokenPerGiorno: (m, a) => `Tokens por día en ${m} ${a}`, rigaGiorno: (t, n) => `${t} Tokens, ${n} mensajes`,
  totaleDi: (m, a) => `Total de ${m} ${a}`, barra: (g, m, t, n) => `${g} ${m}: ${t} tokens, ${n} mensajes`,
  rigaChat: (n, t, r) => `${n} mensajes · ${t} Tokens · ${r} por solicitud`, ultimaAttivita: f => `última actividad ${f}`,
  perChat: (m, n) => `Por chat · ${m} (${n})`, mostraMeno: 'Mostrar menos', mostraTutti: n => `Mostrar todos los días (${n})`,
  notaStati: 'Los estados «trabajando / parada / bloqueada» se estiman a partir de los archivos de los chats; los límites son los de la última respuesta.',
  senzaTitolo: 'Sin título',
}

export const TESTI: Record<Lingua, Testi> = { it, en, de, fr, es }
