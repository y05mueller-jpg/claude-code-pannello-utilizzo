// misure per rendere i token comprensibili. Un token è circa 3/4 di parola:
// una pagina A4 di testo (~500 parole) ≈ 650 token; un libro di 300 pagine ≈ 200'000 token;
// una persona scrive circa 40 parole al minuto, cioè ~3'200 token l'ora.
// Misure brevi (italiano, ~1,4 token per parola):
//  - riga di chat WhatsApp sul telefono: ~32 caratteri ≈ 6 parole ≈ 10-11 sillabe → ≈ 8 token
//    (un po' più corta di un verso da 12 sillabe);
//  - verso dodecasillabo: 12 sillabe ≈ 7-8 parole → ≈ 11 token;
//  - strofa: 4 versi da 12 sillabe = 4 × 11 → 44 token.
// L'ordine delle chiavi è quello del menu nella barra.
export const MISURE: Record<string, number> = { a4: 650, libri: 200000, ore: 3200, chat: 8, verso: 11, strofa: 44, token: 1 }

// quanti «Token» di una misura valgono n token reali (numero grezzo, senza formattazione)
export const valoreMisura = (n: number, m: string): number => n / (MISURE[m] ?? MISURE.a4)
