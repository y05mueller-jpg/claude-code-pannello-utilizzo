// Crediti API per il pannello «Utilizzo» (facoltativo): legge ~/.claude/utilizzo-api/config.json (crediti, scadenze, prezzi)
// e, se c'è, uso.jsonl (una riga per lavoro: { data, titolo, modello, costo }). Solo numeri. Senza config.json la sezione non compare.
// Uscita (stdout): JSON { crediti, speso, lavori, prezzi, ricarica, chiave, agente, auto, soglia, ultimi }
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
    try { const j = JSON.parse(r); lavori.push({ data: j.data, titolo: j.titolo, modello: j.modello, costo: Number(j.costo) || 0, minuti: j.minuti, esito: j.esito }); } catch (e) {}
  }
} catch (e) {}
const speso = lavori.reduce((s, l) => s + l.costo, 0);
// passaggio automatico ai crediti API (hooks/register.tsx): serve l'aiutante agente.py e il file della chiave.
// Della chiave si guarda solo che il file esista e non sia vuoto: non si legge mai.
const dim = f => { try { return fs.statSync(path.join(CARTELLA, f)).size; } catch (e) { return 0; } };
const agente = dim('agente.py') > 0 ? path.join(CARTELLA, 'agente.py') : '';
const auto = config.passaggio_api !== false, soglia = Number(config.soglia_piano) || 90;
process.stdout.write(JSON.stringify({
  crediti: config.crediti, speso, lavori: lavori.length, prezzi: config.prezzi_per_milione, ricarica: config.ricarica,
  presente, chiave: dim('chiave.txt') > 10, agente, auto, soglia, ultimi: lavori.slice(-5).reverse(),
}));
