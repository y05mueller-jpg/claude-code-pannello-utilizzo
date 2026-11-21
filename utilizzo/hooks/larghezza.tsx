// Misura la larghezza del pannello, in caratteri, e la dice al pannello quando cambia:
// serve alle finestre di spiegazione, che così non escono mai dal bordo quando il pannello è stretto.
// Non disegna niente: è una riga vuota larga quanto tutto il pannello.
import type { ClientModule } from 'claude-code'

// L'ultima larghezza detta al pannello sta qui e non nello stato del disegno: cambiare lo stato a ogni ridisegno,
// mentre si trascina il bordo del pannello, per l'app è un giro a vuoto e il disegno viene tolto (con un avviso sotto).
let ultima = 0

const Larghezza: ClientModule<Record<string, never>, number> = (_p, s) => {
  const colonne = s.columns
  if (colonne > 0 && colonne !== ultima) {
    ultima = colonne
    s.post({ colonne })
  }
  return s.elements.Text({ children: [' '] } as any)
}
export default Larghezza
