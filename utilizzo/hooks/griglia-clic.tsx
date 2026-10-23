// Strato invisibile sopra UNA casella della griglia disegnata (mesi o anni):
// un clic in qualsiasi punto della casella manda al pannello quella scelta. Nessun calcolo di posizione.
import type { ClientModule } from 'claude-code'

type Props = { dati: { [k: string]: number } }

const GrigliaClic: ClientModule<Props, boolean> = (p, s) => {
  const { Box } = s.elements
  if (s.state === undefined) {
    s.onPointer(ev => { if (ev.type === 'down') s.post(p.dati) })
    s.setState(true)
  }
  return Box({ width: '100%', height: '100%' } as any)
}
export default GrigliaClic
