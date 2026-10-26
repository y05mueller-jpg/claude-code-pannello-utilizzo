// Readers for Continue and Aider. Formats checked against the official source code only (not on real files).
//   Continue  github.com/continuedev/continue core/data/log.ts: ~/.continue/dev_data/0.2.0/tokensGenerated.jsonl
//             one line per model call { timestamp, model, provider, promptTokens, generatedTokens } (counted by Continue's own
//             tokenizer; no cache, no session). chatInteraction.jsonl holds the chat text and is never opened.
//   Aider     github.com/Aider-AI/aider io.py + base_coder.py: .aider.chat.history.md in each project (git root):
//             "# aider chat started at 2026-10-26 09:12:03", "> Model: <name> with …", "#### <message>",
//             "> Tokens: 12k sent, 2.3k cache write, 8.1k cache hit, 512 received." Numbers like 2.3k / 1235k.
//             Aider has no global usage log by default, so only the open project folders (and the ones in the
//             "folders" setting, separated by ;) are read.
'use strict';
const fs = require('fs'), path = require('path');
const { giorno, leggiRighe, aggiungiRichiesta, aggiungiMessaggio } = require('./comune');

const VERSIONE = 1;
const nuovaSessione = (id, titolo, progetto, modello) => ({ id, titolo, progetto, modello, messaggi: 0, richieste: 0, token: 0, u: [0, 0, 0, 0], scritti: 0, ultimo: 0, bloccata: false, giorni: {} });

// ---------- Continue ----------
// no sessions in the file: one row per model in the list
function leggiContinue(radice, cacheIn) {
  const cache = cacheIn && cacheIn.v === VERSIONE ? cacheIn : { v: VERSIONE, inizio: 0, modelli: {} };
  const file = path.join(radice, 'dev_data', '0.2.0', 'tokensGenerated.jsonl');
  let st; try { st = fs.statSync(file); } catch (e) { return { cache, sessioni: [], limiti: [], avvisi: [] }; }
  if (st.size < cache.inizio) { cache.inizio = 0; cache.modelli = {}; }
  if (st.size > cache.inizio) {
    const l = leggiRighe(file, cache.inizio);
    for (const r of l.righe) {
      let j; try { j = JSON.parse(r); } catch (e) { continue; }
      if (!j || (j.eventName && j.eventName !== 'tokensGenerated')) continue;
      const modello = String(j.model || '?').slice(0, 40);
      const s = cache.modelli[modello] || (cache.modelli[modello] = nuovaSessione(`continue:${modello}`, modello, String(j.provider || ''), modello));
      const ts = Date.parse(j.timestamp), g = isNaN(ts) ? null : giorno(ts);
      if (!isNaN(ts) && ts > s.ultimo) s.ultimo = ts;
      aggiungiRichiesta(s, g, Number(j.promptTokens) || 0, Number(j.generatedTokens) || 0, 0, 0);
    }
    cache.inizio = l.nuovoInizio;
  }
  return { cache, sessioni: Object.values(cache.modelli), limiti: [], avvisi: [] };
}

// ---------- Aider ----------
const numero = t => { const m = /^([\d.]+)\s*([kKmM]?)$/.exec(String(t).trim()); if (!m) return 0; return Math.round(parseFloat(m[1]) * (m[2].toLowerCase() === 'k' ? 1e3 : m[2].toLowerCase() === 'm' ? 1e6 : 1)); };

function leggiAider(radice, cacheIn, extra) {
  const cache = cacheIn && cacheIn.v === VERSIONE ? cacheIn : { v: VERSIONE, file: {} };
  const cartelle = new Set(extra.progetti || []);
  for (const c of String(radice || '').split(';').map(x => x.trim()).filter(Boolean)) cartelle.add(c);
  const viste = new Set();
  for (const c of cartelle) {
    const file = path.join(c, '.aider.chat.history.md');
    let st; try { st = fs.statSync(file); } catch (e) { continue; }
    viste.add(file);
    let f = cache.file[file];
    if (!f || st.size < f.inizio) f = cache.file[file] = { inizio: 0, n: 0, sessioni: {}, attuale: '' };
    if (st.size === f.inizio) continue;
    const l = leggiRighe(file, f.inizio);
    const progetto = path.basename(c.replace(/[\\/]+$/, ''));
    for (const r of l.righe) {
      const inizio = /^# aider chat started at (\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(r);
      if (inizio) {
        const ts = new Date(+inizio[1], +inizio[2] - 1, +inizio[3], +inizio[4], +inizio[5], +inizio[6]).getTime();   // local time, as Aider writes it
        f.n++; f.attuale = `aider:${require('crypto').createHash('md5').update(file).digest('hex').slice(0, 10)}:${f.n}`;
        f.sessioni[f.attuale] = Object.assign(nuovaSessione(f.attuale, '', progetto, ''), { ultimo: ts, inizio: ts });
        continue;
      }
      const s = f.sessioni[f.attuale];
      if (!s) continue;
      const g = giorno(s.inizio);
      const modello = /^> (?:Main model|Model): (\S+)/.exec(r);
      if (modello) { s.modello = modello[1].slice(0, 40); continue; }
      if (/^#### /.test(r)) { aggiungiMessaggio(s, g, Math.ceil((r.length - 5) / 4)); continue; }
      const tok = /Tokens: ([\d.]+[kKmM]?) sent(?:, ([\d.]+[kKmM]?) cache write)?(?:, ([\d.]+[kKmM]?) cache hit)?, ([\d.]+[kKmM]?) received/.exec(r);
      if (tok) {
        const inviati = numero(tok[1]), cw = tok[2] ? numero(tok[2]) : 0, cr = tok[3] ? numero(tok[3]) : 0;
        // "sent" already contains the cache writes
        aggiungiRichiesta(s, g, Math.max(0, inviati - cw), numero(tok[4]), cw, cr);
      }
    }
    f.inizio = l.nuovoInizio;
    f.mtime = st.mtimeMs;
  }
  for (const k of Object.keys(cache.file)) if (!viste.has(k)) delete cache.file[k];
  const sessioni = [];
  for (const f of Object.values(cache.file)) for (const s of Object.values(f.sessioni)) {
    if (!s.richieste && !s.messaggi) continue;
    const { inizio, ...resto } = s;
    sessioni.push(resto);
  }
  return { cache, sessioni, limiti: [], avvisi: [] };
}

module.exports = { leggiContinue, leggiAider };
