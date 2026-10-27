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
  creatoDa: string
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
  creatoDa: "Creato da Yannis Müller · Fondatore di YouppyApps",
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
  creatoDa: "Created by Yannis Müller · Founder of YouppyApps",
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
  creatoDa: "Erstellt von Yannis Müller · Gründer von YouppyApps",
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
  creatoDa: "Créé par Yannis Müller · Fondateur de YouppyApps",
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
  creatoDa: "Creado por Yannis Müller · Fundador de YouppyApps",
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

// ---- sezione «Crediti API» ----
export type TestiApi = {
  sez: string; rimasti: (r: string, tot: string) => string; scade: (q: string, giorni: number) => string; scaduto: (q: string) => string
  nessunCredito: string; lavori: (n: number, speso: string) => string
  questaChat: (c: string) => string; oggiMese: (o: string, m: string) => string; stima: string
  apriRicarica: string; costiTitolo: string; costi: [string, string][]; prezzi: (mod: string, e: string, u: string, l: string) => string
  comeRicaricare: string; vaiConsole: string; senzaChiave: string; ultimi: string; nonClaudeCode: string; aggiorna: string; aggiornato: string; nonAggiornato: string
  sceltaTitolo: string; sceltaAttiva: string; sceltaSpenta: string; sceltaRegole: string[]; perModello: (m: string, n: number, c: string) => string; risparmio: (s: string) => string
  conCento: string; esempiCento: string[]; prezziTitolo: string; colonne: string; nomeModello: Record<string, string>; ricaricaTitolo: string; passi: string[]
}
const apiIt: TestiApi = {
  sez: 'Crediti API',
  rimasti: (r, tot) => `Rimasti ${r} di ${tot}`,
  scade: (q, g) => `Scade ${q} (tra ${g} ${g === 1 ? 'giorno' : 'giorni'})`,
  scaduto: q => `Scaduto ${q}`,
  nessunCredito: 'Nessun credito API attivo.',
  lavori: (n, s) => `Lavori fatti con l'API: ${n} · spesi ${s}`,
  questaChat: c => `Questa chat, se pagata con l'API: circa ${c}`,
  oggiMese: (o, m) => `Oggi circa ${o} · questo mese circa ${m}`,
  stima: 'I costi sono stime con i prezzi di Opus 5.5. La memoria riletta (cache) costa molto meno: 0,20 $ per milione di token.',
  apriRicarica: 'Ricarica e quanto costa',
  costiTitolo: 'Quanto costa un lavoro',
  costi: [
    ['Domanda breve', '0,02–0,10 $'],
    ['Correggere un file', '0,20–1 $'],
    ['Pagina o app piccola', '1–5 $'],
    ['Lavoro lungo con agente', '3–15 $'],
    ['Giornata intensa', '20–100+ $'],
  ],
  conCento: 'Con 100 $ fai circa:',
  esempiCento: ['1000 domande brevi', 'oppure 10 lavori lunghi', 'oppure 1–3 giornate intense'],
  prezziTitolo: 'Prezzo per 1 milione di token',
  colonne: 'entrata · uscita',
  nomeModello: { 'claude-opus-5-5': 'Opus 5.5', 'claude-sonnet-5-5': 'Sonnet 5.5', 'claude-haiku-5-5': 'Haiku 5.5' },
  ricaricaTitolo: 'Come ricaricare',
  passi: ['Apri la console (link sotto)', 'Billing → Add credits', 'Imposta un limite di spesa mensile'],
  prezzi: (m, e, u, l) => `${m}: ${e} $ entrata · ${u} $ uscita · ${l} $ riletti, per milione di token`,
  comeRicaricare: 'Per ricaricare: console → Billing → Add credits. Imposta anche un limite di spesa mensile, così non paghi mai più di quanto vuoi.',
  vaiConsole: 'Apri la console per ricaricare',
  senzaChiave: '',
  ultimi: 'Ultimi lavori',
  nonClaudeCode: "I crediti API valgono per l'API, non per Claude Code con un piano.",
  aggiorna: 'Aggiorna la spesa API',
  sceltaTitolo: 'Scelta del modello',
  sceltaAttiva: 'automatica',
  sceltaSpenta: 'spenta',
  sceltaRegole: ['Haiku: cercare, leggere, riassumere', 'Sonnet: modifiche normali, correzioni, controlli', 'Opus: progettazione, 3D e render, siti nuovi'],
  perModello: (m, n, c) => `${m}: ${n} ${n === 1 ? 'lavoro' : 'lavori'} · ${c}`,
  risparmio: s => `Risparmiati circa ${s} rispetto a usare sempre Opus`,
  aggiornato: 'Spesa API aggiornata',
  nonAggiornato: 'Non riesco a leggere la spesa API',
}
const apiEn: TestiApi = {
  sez: 'API credits',
  rimasti: (r, tot) => `${r} left of ${tot}`,
  scade: (q, g) => `Expires ${q} (in ${g} ${g === 1 ? 'day' : 'days'})`,
  scaduto: q => `Expired ${q}`,
  nessunCredito: 'No active API credit.',
  lavori: (n, s) => `Jobs done with the API: ${n} · spent ${s}`,
  questaChat: c => `This chat, if paid with the API: about ${c}`,
  oggiMese: (o, m) => `Today about ${o} · this month about ${m}`,
  stima: 'Estimate at Opus 5.5 prices: input, output and re-read memory (cache) counted separately.',
  apriRicarica: 'Top up and what it costs',
  costiTitolo: 'What a job costs',
  costi: [
    ['Short question', '$0.02–0.10'],
    ['Fix a file', '$0.20–1'],
    ['Small page or app', '$1–5'],
    ['Long agent job', '$3–15'],
    ['Heavy day', '$20–100+'],
  ],
  conCento: 'With $100 you get about:',
  esempiCento: ['1000 short questions', 'or 10 long jobs', 'or 1–3 heavy days'],
  prezziTitolo: 'Price per 1 million tokens',
  colonne: 'input · output',
  nomeModello: { 'claude-opus-5-5': 'Opus 5.5', 'claude-sonnet-5-5': 'Sonnet 5.5', 'claude-haiku-5-5': 'Haiku 5.5' },
  ricaricaTitolo: 'How to top up',
  passi: ['Open the console (link below)', 'Billing → Add credits', 'Set a monthly spend limit'],
  prezzi: (m, e, u, l) => `${m}: $${e} input · $${u} output · $${l} re-read, per million tokens`,
  comeRicaricare: 'To top up: console → Billing → Add credits. Also set a monthly spend limit.',
  vaiConsole: 'Open the console to top up',
  senzaChiave: '',
  ultimi: 'Latest jobs',
  nonClaudeCode: 'API credits work for the API, not for Claude Code on a plan.',
  aggiorna: 'Refresh API spending',
  sceltaTitolo: 'Model choice',
  sceltaAttiva: 'automatic',
  sceltaSpenta: 'off',
  sceltaRegole: ['Haiku: search, read, summarise', 'Sonnet: ordinary changes, fixes, checks', 'Opus: design, 3D and rendering, new sites'],
  perModello: (m, n, c) => `${m}: ${n} ${n === 1 ? 'job' : 'jobs'} · ${c}`,
  risparmio: s => `About ${s} saved compared with always using Opus`,
  aggiornato: 'API spending updated',
  nonAggiornato: 'Could not read API spending',
}
export const TESTI_API: Record<Lingua, TestiApi> = { it: apiIt, en: apiEn, de: apiEn, fr: apiEn, es: apiEn }

// ---- banner di approvazione spesa sopra la chat (lavori API oltre la soglia) ----
export type TestiSpesa = {
  etichetta: string; approva: string; no: string
  inAttesa: (budget: string) => string
  ok: (budget: string, titolo: string) => string
  rifiuto: (budget: string, titolo: string) => string
  senzaTitolo: string
}
const spesaIt: TestiSpesa = {
  etichetta: 'Spesa da approvare', approva: 'Approva', no: 'No',
  inAttesa: b => `In attesa dell'ok di Yannis nel banner sopra la chat (spesa ${b} $). Non riprovare finché non arriva la sua risposta.`,
  ok: (b, t) => `Ok, approvo la spesa di ${b} $ per «${t}»: procedi con lo stesso comando.`,
  rifiuto: (b, t) => `No, non approvo la spesa di ${b} $ per «${t}». Fermati e proponi un'alternativa più economica.`,
  senzaTitolo: 'lavoro API',
}
const spesaEn: TestiSpesa = {
  etichetta: 'Spend to approve', approva: 'Approve', no: 'No',
  inAttesa: b => `Waiting for the user's OK in the banner above the chat (spend $${b}). Do not retry until the answer arrives.`,
  ok: (b, t) => `OK, I approve the $${b} spend for "${t}": go ahead with the same command.`,
  rifiuto: (b, t) => `No, I do not approve the $${b} spend for "${t}". Stop and suggest a cheaper alternative.`,
  senzaTitolo: 'API job',
}
export const TESTI_SPESA: Record<Lingua, TestiSpesa> = { it: spesaIt, en: spesaEn, de: spesaEn, fr: spesaEn, es: spesaEn }

// ---- tetto per il lavoro in corso, accanto al pulsante Utilizzo ----
export type TestiTetto = {
  etichetta: string; auto: string; altro: string; alzato: string; digita: string; nonValido: (max: number) => string
  nGiri: (g: number) => string; elenco: (usd: number, giri: number) => string; previsto: (usd: number, tetto: number) => string; oltre: string
}
// numeri con la virgola in italiano, il punto in inglese; «corto» toglie gli zeri inutili (15, 7,5)
const numIt = (n: number, d: number) => n.toFixed(d).replace('.', ',')
const cortoIt = (n: number) => String(Number(n.toFixed(2))).replace('.', ',')
const cortoEn = (n: number) => String(Number(n.toFixed(2)))
const uguali = (a: number, b: number) => Math.abs(a - b) < 0.005
const tettoIt: TestiTetto = {
  etichetta: 'Tetto', auto: 'auto', altro: 'Altro…', nGiri: g => `${g} ${g === 1 ? 'giro' : 'giri'}`, elenco: (u, g) => `${cortoIt(u)} $ · ${tettoIt.nGiri(g)}`,
  alzato: 'tetto alzato da Yannis per questo lavoro',
  digita: 'es. 7,5', nonValido: m => `non valido: 0,5–${m} $`,
  previsto: (u, t) => uguali(u, t) ? `≈${cortoIt(u)} $` : `≈${numIt(u, 2)} $`, oltre: '⚠',
}
const tettoEn: TestiTetto = {
  etichetta: 'Cap', auto: 'auto', altro: 'Other…', nGiri: g => `${g} ${g === 1 ? 'round' : 'rounds'}`, elenco: (u, g) => `$${cortoEn(u)} · ${tettoEn.nGiri(g)}`,
  alzato: 'cap raised by Yannis for this job',
  digita: 'e.g. 7.5', nonValido: m => `invalid: 0.5–${m} $`,
  previsto: (u, t) => uguali(u, t) ? `≈$${cortoEn(u)}` : `≈$${u.toFixed(2)}`, oltre: '⚠',
}
export const TESTI_TETTO: Record<Lingua, TestiTetto> = { it: tettoIt, en: tettoEn, de: tettoEn, fr: tettoEn, es: tettoEn }

// ---- altri strumenti (Codex, Gemini, Qwen…) e prezzi API di tutti i fornitori ----
export type TestiAltri = {
  strumento: string; tutti: string; nessuno: (nomi: string) => string; errore: (nome: string, e: string) => string
  ore: (h: number) => string; settimana: string
  prezzi: (n: number) => string; colonne: string; letto: (q: string) => string; pagina: (f: string) => string; nota: string
  apiAttivo: (p: number) => string; apiPronto: (s: number) => string; apiChiave: string; apiAgente: string; apiFiniti: string; apiSpento: string
}
const altriIt: TestiAltri = {
  apiAttivo: p => `Piano al ${p}%: i lavori passano ai crediti API`, apiPronto: s => `Dal ${s}% del piano i lavori passano da soli ai crediti API`,
  apiChiave: 'Passaggio ai crediti API dal 90%: manca il file della chiave (chiave.txt)', apiAgente: 'Passaggio ai crediti API dal 90%: manca l’aiutante agente.py',
  apiFiniti: 'Crediti API finiti o scaduti: si continua con il piano', apiSpento: 'Passaggio automatico ai crediti API spento',
  strumento: 'Strumento', tutti: 'Tutti',
  nessuno: n => `Altri strumenti: nessuno trovato su questo PC. Compaiono qui da soli appena li usi: ${n}.`,
  errore: (n, e) => `${n}: non riesco a contarlo (${e})`,
  ore: h => `ultime ${h} ore`, settimana: 'settimanale',
  prezzi: n => `Prezzi API di tutti i fornitori (${n})`, colonne: 'entrata · uscita, $ per milione di token',
  letto: q => `Prezzi ufficiali letti il ${q}`, pagina: f => `Pagina dei prezzi di ${f}`,
  nota: 'Il costo vero dipende anche dalla memoria riletta (cache), che costa molto meno.',
}
const altriEn: TestiAltri = {
  apiAttivo: p => `Plan at ${p}%: jobs now use API credits`, apiPronto: s => `From ${s}% of the plan, jobs switch to API credits by themselves`,
  apiChiave: 'Switch to API credits at 90%: the key file (chiave.txt) is missing', apiAgente: 'Switch to API credits at 90%: the agente.py helper is missing',
  apiFiniti: 'API credits used up or expired: the plan is used', apiSpento: 'Automatic switch to API credits is off',
  strumento: 'Tool', tutti: 'All',
  nessuno: n => `Other tools: none found on this computer. They show up here by themselves as soon as you use them: ${n}.`,
  errore: (n, e) => `${n}: cannot count it (${e})`,
  ore: h => `last ${h} hours`, settimana: 'weekly',
  prezzi: n => `API prices of all providers (${n})`, colonne: 'input · output, $ per million tokens',
  letto: q => `Official prices read on ${q}`, pagina: f => `${f} pricing page`,
  nota: 'The real cost also depends on re-read memory (cache), which costs much less.',
}
const altriDe: TestiAltri = {
  apiAttivo: p => `Plan bei ${p}%: Aufgaben laufen jetzt über API-Guthaben`, apiPronto: s => `Ab ${s}% des Plans laufen Aufgaben von selbst über API-Guthaben`,
  apiChiave: 'Wechsel zu API-Guthaben ab 90%: die Schlüsseldatei (chiave.txt) fehlt', apiAgente: 'Wechsel zu API-Guthaben ab 90%: der Helfer agente.py fehlt',
  apiFiniti: 'API-Guthaben aufgebraucht oder abgelaufen: der Plan wird genutzt', apiSpento: 'Automatischer Wechsel zu API-Guthaben ist aus',
  strumento: 'Werkzeug', tutti: 'Alle',
  nessuno: n => `Andere Werkzeuge: keine auf diesem Computer gefunden. Sie erscheinen hier von selbst, sobald du sie benutzt: ${n}.`,
  errore: (n, e) => `${n}: kann nicht gezählt werden (${e})`,
  ore: h => `letzte ${h} Stunden`, settimana: 'wöchentlich',
  prezzi: n => `API-Preise aller Anbieter (${n})`, colonne: 'Eingabe · Ausgabe, $ pro Million Token',
  letto: q => `Offizielle Preise gelesen am ${q}`, pagina: f => `Preisseite von ${f}`,
  nota: 'Die echten Kosten hängen auch vom wiedergelesenen Speicher (Cache) ab, der viel weniger kostet.',
}
const altriFr: TestiAltri = {
  apiAttivo: p => `Forfait à ${p} % : les tâches passent aux crédits API`, apiPronto: s => `Dès ${s} % du forfait, les tâches passent seules aux crédits API`,
  apiChiave: 'Passage aux crédits API à 90 % : le fichier de clé (chiave.txt) manque', apiAgente: 'Passage aux crédits API à 90 % : l’assistant agente.py manque',
  apiFiniti: 'Crédits API épuisés ou expirés : le forfait est utilisé', apiSpento: 'Passage automatique aux crédits API désactivé',
  strumento: 'Outil', tutti: 'Tous',
  nessuno: n => `Autres outils : aucun trouvé sur cet ordinateur. Ils apparaissent ici tout seuls dès que tu les utilises : ${n}.`,
  errore: (n, e) => `${n} : impossible de le compter (${e})`,
  ore: h => `dernières ${h} heures`, settimana: 'hebdomadaire',
  prezzi: n => `Prix API de tous les fournisseurs (${n})`, colonne: 'entrée · sortie, $ par million de tokens',
  letto: q => `Prix officiels lus le ${q}`, pagina: f => `Page des prix de ${f}`,
  nota: 'Le coût réel dépend aussi de la mémoire relue (cache), qui coûte beaucoup moins.',
}
const altriEs: TestiAltri = {
  apiAttivo: p => `Plan al ${p}%: las tareas pasan a los créditos API`, apiPronto: s => `Desde el ${s}% del plan, las tareas pasan solas a los créditos API`,
  apiChiave: 'Cambio a créditos API al 90%: falta el archivo de la clave (chiave.txt)', apiAgente: 'Cambio a créditos API al 90%: falta el ayudante agente.py',
  apiFiniti: 'Créditos API agotados o caducados: se usa el plan', apiSpento: 'Cambio automático a créditos API desactivado',
  strumento: 'Herramienta', tutti: 'Todas',
  nessuno: n => `Otras herramientas: ninguna en este ordenador. Aparecen aquí solas en cuanto las uses: ${n}.`,
  errore: (n, e) => `${n}: no se puede contar (${e})`,
  ore: h => `últimas ${h} horas`, settimana: 'semanal',
  prezzi: n => `Precios API de todos los proveedores (${n})`, colonne: 'entrada · salida, $ por millón de tokens',
  letto: q => `Precios oficiales leídos el ${q}`, pagina: f => `Página de precios de ${f}`,
  nota: 'El coste real también depende de la memoria releída (caché), que cuesta mucho menos.',
}
export const TESTI_ALTRI: Record<Lingua, TestiAltri> = { it: altriIt, en: altriEn, de: altriDe, fr: altriFr, es: altriEs }
