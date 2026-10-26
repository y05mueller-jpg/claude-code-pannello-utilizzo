// Qwen Code reader: ~/.qwen/projects/<project>/chats/<sessionId>.jsonl (also chats/archive/, and the older ~/.qwen/tmp/*/chats/).
// Format checked against the official source code only (github.com/QwenLM/qwen-code, commit ef4c132,
// packages/core/src/services/chatRecordingService.ts), NOT on real files. Append-only JSONL, one record per line:
//   { uuid, parentUuid, sessionId, timestamp, type: 'user' | 'assistant' | 'tool_result' | 'system', subtype?, cwd, model?,
//     message?, usageMetadata?: { promptTokenCount, candidatesTokenCount, cachedContentTokenCount, thoughtsTokenCount, totalTokenCount } }
//   promptTokenCount already includes the cached tokens; candidatesTokenCount already includes reasoning.
//   Only "assistant" lines are counted ("system" lines may repeat the same numbers for the interface).
// Only numbers are kept: for messages written by the person, only the length of their text.
'use strict';
const fs = require('fs'), path = require('path');
const { giorno, leggiRighe, fileConFine, aggiungiRichiesta, aggiungiMessaggio } = require('./comune');

const VERSIONE = 1;
const NOME = /^[0-9a-fA-F-]{32,36}\.jsonl$/;

function leggiQwen(radice, cacheIn) {
  const cache = cacheIn && cacheIn.v === VERSIONE ? cacheIn : { v: VERSIONE, file: {}, sessioni: {} };
  const elenco = [...fileConFine(path.join(radice, 'projects'), ['.jsonl']), ...fileConFine(path.join(radice, 'tmp'), ['.jsonl'])]
    .filter(p => NOME.test(path.basename(p)) && p.split(path.sep).includes('chats'));
  const visti = new Set(elenco);
  for (const k of Object.keys(cache.file)) if (!visti.has(k)) delete cache.file[k];
  const sessione = (id, file) => cache.sessioni[id] || (cache.sessioni[id] = {
    id, titolo: '', progetto: '', modello: '', messaggi: 0, richieste: 0, token: 0, u: [0, 0, 0, 0], scritti: 0, ultimo: 0, bloccata: false, giorni: {}, file,
  });

  for (const file of elenco) {
    let st; try { st = fs.statSync(file); } catch (e) { continue; }
    const f = cache.file[file] || (cache.file[file] = { inizio: 0, mtime: 0, visti: [] });
    f.mtime = st.mtimeMs;
    if (st.size < f.inizio) { f.inizio = 0; f.visti = []; }
    if (st.size === f.inizio) continue;
    const giaVisti = new Set(f.visti);
    let letto; try { letto = leggiRighe(file, f.inizio); } catch (e) { continue; }
    for (const r of letto.righe) {
      if (!r) continue;
      let j; try { j = JSON.parse(r); } catch (e) { continue; }
      if (!j || !j.type) continue;
      if (j.uuid) { if (giaVisti.has(j.uuid)) continue; giaVisti.add(j.uuid); f.visti.push(j.uuid); }
      const s = sessione(String(j.sessionId || path.basename(file, '.jsonl')), file);
      if (j.cwd && !s.progetto) s.progetto = path.basename(String(j.cwd).replace(/[\\/]+$/, ''));
      const ts = j.timestamp ? Date.parse(j.timestamp) : NaN, g = isNaN(ts) ? null : giorno(ts);
      if (!isNaN(ts) && ts > s.ultimo) s.ultimo = ts;
      if (j.type === 'assistant' && j.usageMetadata) {
        const u = j.usageMetadata, n = v => Number(v) || 0;
        let entrata = n(u.promptTokenCount), uscita = n(u.candidatesTokenCount);
        const letti = n(u.cachedContentTokenCount);
        if (!entrata && !uscita) entrata = n(u.totalTokenCount);   // some providers send only a total
        if (!entrata && !uscita) continue;
        aggiungiRichiesta(s, g, Math.max(0, entrata - letti), uscita, 0, letti);
        if (j.model) s.modello = String(j.model).slice(0, 40);
      } else if (j.type === 'user' && !j.subtype) {
        const parti = j.message && Array.isArray(j.message.parts) ? j.message.parts : [];
        const t = parti.map(p => (p && typeof p.text === 'string' ? p.text : '')).join('');
        if (t && !/^\s*</.test(t)) aggiungiMessaggio(s, g, Math.ceil(t.length / 4));
      }
    }
    if (f.visti.length > 50000) f.visti = f.visti.slice(-20000);
    f.inizio = letto.nuovoInizio;
  }
  const sessioni = [];
  for (const s of Object.values(cache.sessioni)) {
    if (!visti.has(s.file)) continue;
    if (!s.richieste && !s.messaggi) continue;
    const { file, ...resto } = s;
    sessioni.push({ ...resto, giorni: s.giorni, u: s.u.slice(), ultimo: Math.max(s.ultimo, (cache.file[file] || {}).mtime || 0) });
  }
  for (const [id, s] of Object.entries(cache.sessioni)) if (!visti.has(s.file)) delete cache.sessioni[id];
  return { cache, sessioni, limiti: [], avvisi: [] };
}

module.exports = { leggiQwen };
