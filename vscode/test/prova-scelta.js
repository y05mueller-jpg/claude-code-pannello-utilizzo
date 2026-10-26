// Automatic test of "Model choice" (model routing): node test/prova-scelta.js
'use strict';
const assert = require('assert');
const { scegliLivello, modelliPerFornitore, stimaRisparmio } = require('../src/scelta');
const { LISTINO } = require('../src/prezzi');
let prove = 0;
const ok = (a, b, nome) => { assert.deepStrictEqual(a, b, nome); prove++; };
const liv = t => scegliLivello(t).livello;

// light: keyword and short
for (const t of ['cerca il file di configurazione', 'trova dove si usa questa funzione', 'elenca i file della cartella', 'leggi il README',
  'riassumi questa discussione', 'conta le righe del file', 'rinomina la variabile x in totale', 'traduci in inglese', 'formatta il JSON',
  'controlla i log di ieri', 'dimmi lo stato del servizio', 'search for TODOs', 'find the config', 'list the files', 'read the README',
  'summarize this', 'count the lines', 'rename this function', 'translate to German', 'format this file', 'show the status']) ok(liv(t), 'leggero', t);
// heavy: keyword (has precedence over light words)
for (const t of ['progetta il database', "rivedi l'architettura", 'design the API', 'scena 3D', 'modello in Blender', 'render della scena',
  'modella una sedia', 'fammi un sito', 'nuovo backend', 'frontend in React', 'una app nuova per le note', 'riscrivi da zero', 'refactor del modulo',
  'migra a Postgres', 'controllo di sicurezza', 'un debug difficile', 'ottimizza le query', 'plan the release', 'architect the service',
  'build a CLI', 'from scratch please', 'make a website', 'security review', 'migrate the data',
  'cerca e poi progetta il backend', 'riassumi e fai il render']) ok(liv(t), 'pesante', t);
// medium: everything else
for (const t of ['correggi il bug nel form', 'aggiungi un test', 'scrivi una funzione che somma due numeri', 'fix the failing test']) ok(liv(t), 'medio', t);

// the correction on "conta": "contatto", "contare" vs "contabilità"
ok(liv('aggiungi un contatto alla rubrica'), 'medio', '"contatto" is not "conta"');
ok(liv('contami le parole'), 'leggero', '"contami" is light');
ok(liv('puoi contare i file?'), 'leggero', '"contare" is light');
// "leggero" (an adjective) is not "leggi"; "lista" is not "list"
ok(liv('rendi la pagina più leggera'), 'medio', '"leggera" is not "leggi"');
ok(liv('aggiungi una lista'), 'medio', '"lista" is not "list"');

// length limits
ok(liv('cerca ' + 'a'.repeat(593)), 'leggero', 'light just under 600 characters');
ok(scegliLivello('cerca ' + 'a'.repeat(594)).codice, 'leggeroLungo', 'light word at 600 characters → medium');
ok(liv('cerca ' + 'a'.repeat(594)), 'medio', 'light word but too long');
ok(liv('x'.repeat(1500)), 'medio', '1500 characters is still medium');
ok(scegliLivello('x'.repeat(1501)).codice, 'pesanteLungo', 'over 1500 characters → heavy');
ok(liv('cerca ' + 'a'.repeat(1600)), 'pesante', 'long jobs are heavy even with a light word');
ok(scegliLivello('').codice, 'vuoto', 'empty text');
ok(scegliLivello('Progetta il SITO').parola, 'progett', 'case insensitive, first heavy word');
ok(typeof scegliLivello('riassumi').motivo, 'string', 'a reason is always given');

// models per provider, from the shipped price list
const ids = f => { const m = modelliPerFornitore(f); return [m.leggero.id, m.medio.id, m.pesante.id]; };
ok(ids('anthropic'), ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'], 'Anthropic Haiku / Sonnet / Opus 5.5');
for (const f of Object.keys(LISTINO.fornitori)) {
  const m = modelliPerFornitore(f);
  assert.ok(m, f); prove++;
  for (const l of ['leggero', 'medio', 'pesante']) { assert.ok(LISTINO.fornitori[f].modelli[m[l].id], `${f} ${l} is in the price list`); prove++; }
  ok(m.leggero.entrata + m.leggero.uscita <= m.medio.entrata + m.medio.uscita && m.medio.entrata + m.medio.uscita <= m.pesante.entrata + m.pesante.uscita, true, `${f}: light ≤ medium ≤ heavy`);
}
// providers with two models (aliases at the same price are skipped): light and medium share the cheaper one
ok(ids('minimax'), ['MiniMax-M3.1-Flash', 'MiniMax-M3.1-Flash', 'MiniMax-M3'], 'two models');
ok(ids('deepseek')[2], 'deepseek-v4-pro', 'DeepSeek flagship');
// one model only, and an unknown provider
const uno = { fornitori: { solo: { modelli: { 'm-1': { entrata: 1, uscita: 2, valuta: 'USD' } } } } };
ok(['leggero', 'medio', 'pesante'].map(l => modelliPerFornitore('solo', uno)[l].id), ['m-1', 'm-1', 'm-1'], 'one model');
ok(modelliPerFornitore('sconosciuto'), null, 'unknown provider');

// savings estimate: 40% light, 40% medium, 20% heavy, never negative
const t = { input: 1e6, output: 1e6, cacheScritta: 0, cacheLetta: 0 };
const r = stimaRisparmio(modelliPerFornitore('anthropic'), t);
ok(r.sempreTop, 24, 'always Opus 5.5: 4 + 20');
ok(Math.round(r.conScelta * 1000) / 1000, Math.round((0.4 * 0.6 + 0.4 * 12 + 0.2 * 24) * 1000) / 1000, 'mixed cost');
ok(r.risparmio > 0, true, 'some saving');
ok(stimaRisparmio(modelliPerFornitore('anthropic'), { input: 0, output: 0, cacheScritta: 0, cacheLetta: 0 }).risparmio, 0, 'no usage, no saving');

console.log(`OK: ${prove} checks passed`);
