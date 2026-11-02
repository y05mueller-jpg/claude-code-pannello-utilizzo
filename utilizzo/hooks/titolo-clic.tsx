// Titolo e numero di un riquadro del Totale, disegnati come testo normale.
// Un clic in qualsiasi punto avvisa il pannello, che apre o chiude la spiegazione sotto il riquadro.
import type { ClientModule } from 'claude-code'

type Props = { id: string; nome: string; valore: string; piuLungo?: string }

const TitoloClic: ClientModule<Props, boolean> = (p, s) => {
  const { Box, Text } = s.elements
  if (s.state === undefined) {
    s.onPointer(ev => { if (ev.type === 'down') s.post({ info: p.id }) })
    s.setState(true)
  }
  return Box({ flexDirection: 'column', children: [
    Text({ dimColor: true, size: 'footnote', children: [p.nome] } as any),
    Text({ bold: true, size: 'heading', children: [p.valore] } as any),
    // riga alta 0 e invisibile col titolo più lungo: tutti i riquadri larghi uguali, margini uguali ai due lati
    ...(p.piuLungo ? [Box({ height: 0, overflow: 'hidden', children: [Text({ size: 'footnote', children: [p.piuLungo] } as any)] } as any)] : []),
  ] })
}
export default TitoloClic
