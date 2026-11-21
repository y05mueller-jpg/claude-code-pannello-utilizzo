// Una scritta che apre la sua finestra di spiegazione quando il cursore ci passa sopra:
// all'entrata avvisa il pannello di aprirla, all'uscita di chiuderla.
// Solo testo: un collegamento qui dentro l'app non lo disegna (i collegamenti stanno nel pannello, in register.tsx).
import type { ClientModule } from 'claude-code'

type Props = { id: string; testo: string; colore?: string }

const ZonaInfo: ClientModule<Props, boolean> = (p, s) => {
  const { Text } = s.elements as any
  if (s.state === undefined) {
    s.onPointer(ev => {
      if (ev.type === 'enter') s.post({ infoSopra: p.id })
      else if (ev.type === 'leave') s.post({ infoVia: p.id })
    })
    s.setState(true)
  }
  return Text({ ...(p.colore ? { color: p.colore } : {}), children: [p.testo] } as any)
}
export default ZonaInfo
