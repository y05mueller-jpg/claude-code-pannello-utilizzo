// Strato invisibile sopra la griglia disegnata (mesi o anni, immagine con caselle arrotondate):
// riceve il clic, capisce su quale casella è caduto dalla posizione e manda la scelta al pannello.
import type { ClientModule } from 'claude-code'

type Props = { chiave: string; valori: number[]; colonne: number }

const GrigliaClic: ClientModule<Props, boolean> = (p, s) => {
  const { Box } = s.elements
  if (s.state === undefined) {
    s.onPointer(ev => {
      if (ev.type !== 'down' || !s.columns || !s.rows) return
      const x = ev.fine?.x ?? ev.x + 0.5, y = ev.fine?.y ?? ev.y + 0.5
      const righe = Math.ceil(p.valori.length / p.colonne)
      const c = Math.min(p.colonne - 1, Math.max(0, Math.floor((x / s.columns) * p.colonne)))
      const r = Math.min(righe - 1, Math.max(0, Math.floor((y / s.rows) * righe)))
      const i = r * p.colonne + c
      if (i < p.valori.length) s.post({ [p.chiave]: p.valori[i] })
    })
    s.setState(true)
  }
  return Box({ width: '100%', height: '100%' } as any)
}
export default GrigliaClic
