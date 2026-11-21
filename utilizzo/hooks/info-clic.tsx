// L'icona ⓘ: un clic avvisa il pannello, che apre o chiude la sua finestra (passarci sopra non fa niente).
import type { ClientModule } from 'claude-code'

type Props = { id: string; grande?: boolean }

const InfoClic: ClientModule<Props, boolean> = (p, s) => {
  const { Text } = s.elements
  if (s.state === undefined) {
    s.onPointer(ev => { if (ev.type === 'down') s.post({ info: p.id }) })
    s.setState(true)
  }
  return Text({ dimColor: true, ...(p.grande ? { size: 'heading' } : {}), children: ['ⓘ'] } as any)
}
export default InfoClic
