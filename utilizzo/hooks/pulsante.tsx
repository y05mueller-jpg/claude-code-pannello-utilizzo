// Testo di un pulsante disegnato dal pannello: sfondo e bordo li mette register.tsx attorno (bordo sottile);
// qui solo il testo, con uno spazio ai lati così tutto il pulsante riceve il clic. Il clic avvisa il pannello.
import type { ClientModule } from 'claude-code'

type Props = { id: string; testo: string; spento?: boolean }

const Pulsante: ClientModule<Props, boolean> = (p, s) => {
  const { Text } = s.elements
  if (s.state === undefined) {
    s.onPointer(ev => { if (ev.type === 'down') s.post({ premi: p.id }) })
    s.setState(true)
  }
  return Text({ color: p.spento ? '#a1a1aa' : '#f4f4f5', children: [p.testo] } as any)
}
export default Pulsante
