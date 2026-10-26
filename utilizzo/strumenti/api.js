// Crediti API per il pannello «Utilizzo» (facoltativo): legge ~/.claude/utilizzo-api/config.json (crediti, scadenze, prezzi)
// e, se c'è, uso.jsonl (una riga per lavoro: { data, titolo, modello, costo }). Solo numeri. Senza config.json la sezione non compare.
// Uscita (stdout): JSON { crediti, speso, lavori, prezzi, ricarica, chiave, agente, auto, soglia, scelta, perModello, risparmio, ultimi }
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const CARTELLA = path.join(os.homedir(), '.claude', 'utilizzo-api');
let config = { crediti: [], prezzi_per_milione: {}, ricarica: 'https://console.anthropic.com/settings/billing' };
let presente = false;
try { config = { ...config, ...JSON.parse(fs.readFileSync(path.join(CARTELLA, 'config.json'), 'utf8')) }; presente = true; } catch (e) {}
const lavori = [];
try {
  for (const r of fs.readFileSync(path.join(CARTELLA, 'uso.jsonl'), 'utf8').split('\n')) {
    if (!r.trim()) continue;
    try {
      const j = JSON.parse(r)
      lavori.push({ data: j.data, titolo: j.titolo, modello: j.modello, costo: Number(j.costo) || 0, minuti: j.minuti, esito: j.esito, livello: j.livello,
        u: [Number(j.entrata) || 0, Number(j.uscita) || 0, Number(j.cache_scritta) || 0, Number(j.cache_letta) || 0] });
    } catch (e) {}
  }
} catch (e) {}
const speso = lavori.reduce((s, l) => s + l.costo, 0);
// passaggio automatico ai crediti API (hooks/register.tsx): serve l'aiutante agente.py e il file della chiave.
// Della chiave si guarda solo che il file esista e non sia vuoto: non si legge mai.
const dim = f => { try { return fs.statSync(path.join(CARTELLA, f)).size; } catch (e) { return 0; } };
const agente = dim('agente.py') > 0 ? path.join(CARTELLA, 'agente.py') : '';
const auto = config.passaggio_api !== false, soglia = Number(config.soglia_piano) || 90;
// scelta automatica del modello: lavori per modello e quanto si è risparmiato rispetto a fare tutto con il modello di punta
const scelta = config.scelta_modello !== false;
const punta = config.modello_punta || 'claude-opus-5-5', pp = (config.prezzi_per_milione || {})[punta];
const perModello = {};
let risparmio = 0;
for (const l of lavori) {
  const m = perModello[l.modello] || (perModello[l.modello] = { lavori: 0, costo: 0 });
  m.lavori++; m.costo += l.costo;
  if (pp && l.modello !== punta && l.u.some(x => x > 0)) {
    const comePunta = (l.u[0] * pp.entrata + l.u[1] * pp.uscita + l.u[2] * pp.cache_scritta + l.u[3] * pp.cache_letta) / 1e6;
    risparmio += Math.max(0, comePunta - l.costo);
  }
}
process.stdout.write(JSON.stringify({
  crediti: config.crediti, speso, lavori: lavori.length, prezzi: config.prezzi_per_milione, ricarica: config.ricarica,
  presente, chiave: dim('chiave.txt') > 10, agente, auto, soglia, scelta, perModello, risparmio,
  ultimi: lavori.slice(-5).reverse().map(({ u, ...x }) => x),
}));
