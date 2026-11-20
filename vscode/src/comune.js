// Helpers shared by the readers.
// Common session shape returned by every reader:
//   { id, fonte: 'claude' | 'codex', titolo, progetto, modello, messaggi, richieste, token,
//     u: [input, output, cacheWrite, cacheRead], scritti, ultimo (ms), bloccata,
//     giorni: { 'YYYY-MM-DD': [token, messages, requests, input, output, cacheWrite, cacheRead, written] } }
'use strict';
const fs = require('fs'), path = require('path');

const due = n => String(n).padStart(2, '0');
// local calendar day of a timestamp, e.g. "2026-10-26"
const giorno = ts => { const d = new Date(ts); return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`; };

// all files under dir whose name ends with one of the suffixes
function fileConFine(dir, fini, out = []) {
  let voci; try { voci = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const v of voci) {
    const p = path.join(dir, v.name);
    if (v.isDirectory()) fileConFine(p, fini, out);
    else if (fini.some(f => v.name.endsWith(f))) out.push(p);
  }
  return out;
}

// complete lines from byte position `da` to the end of the file, read in 4 MB pieces:
// `righe` is iterated once (only one line is in memory at a time, so huge chats work too);
// read `nuovoInizio` after the loop. A single line longer than RIGA_MAX is skipped.
const PEZZO = 4 * 1024 * 1024, RIGA_MAX = 128 * 1024 * 1024;
function leggiRighe(file, da) {
  const fd = fs.openSync(file, 'r');
  let dim;
  try { dim = fs.fstatSync(fd).size; } catch (e) { fs.closeSync(fd); throw e; }
  let nuovoInizio = da;
  function* righe() {
    try {
      const buf = Buffer.alloc(Math.min(PEZZO, Math.max(1, dim - da)));
      let pos = da, pezzi = [], lungo = 0, salta = false;
      while (pos < dim) {
        const n = fs.readSync(fd, buf, 0, Math.min(buf.length, dim - pos), pos);
        if (!n) break;
        const c = buf.subarray(0, n);
        let a = 0;
        for (let i = c.indexOf(10); i !== -1; i = c.indexOf(10, a)) {
          let riga = null;
          if (!salta) riga = pezzi.length ? Buffer.concat([...pezzi, c.subarray(a, i)]).toString('utf8') : c.toString('utf8', a, i);
          pezzi = []; lungo = 0; salta = false; a = i + 1;
          nuovoInizio = pos + a;
          if (riga !== null) yield riga;
        }
        if (a < n && !salta) {   // start of a line that continues in the next piece
          lungo += n - a;
          if (lungo > RIGA_MAX) { pezzi = []; lungo = 0; salta = true; }
          else pezzi.push(Buffer.from(c.subarray(a)));
        }
        pos += n;
      }
    } catch (e) { /* read error: stop at the last complete line and go on from there next time */ }
    finally { fs.closeSync(fd); }
  }
  return { righe: righe(), get nuovoInizio() { return nuovoInizio; } };
}

const nuovoGiorno = () => [0, 0, 0, 0, 0, 0, 0, 0];

// one model reply: adds its tokens to the session and to its day
function aggiungiRichiesta(s, g, input, output, cw, cr) {
  const tot = input + output + cw + cr;
  s.richieste++; s.token += tot;
  s.u[0] += input; s.u[1] += output; s.u[2] += cw; s.u[3] += cr;
  if (g) {
    const x = s.giorni[g] || (s.giorni[g] = nuovoGiorno());
    x[0] += tot; x[2]++; x[3] += input; x[4] += output; x[5] += cw; x[6] += cr;
  }
}

// one message written by the person: only an estimate of its tokens is kept, never the text
function aggiungiMessaggio(s, g, stima) {
  s.messaggi++; s.scritti += stima;
  if (g) { const x = s.giorni[g] || (s.giorni[g] = nuovoGiorno()); x[1]++; x[7] += stima; }
}

module.exports = { giorno, fileConFine, leggiRighe, nuovoGiorno, aggiungiRichiesta, aggiungiMessaggio };
