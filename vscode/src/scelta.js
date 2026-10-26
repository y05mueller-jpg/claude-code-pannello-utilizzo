// "Model choice" (model routing): which model to use for a job, to save money.
// Cheap model for simple jobs, the flagship for complex ones (design, 3D and render, new sites, architecture).
// Same rules as the Claude Code panel. Everything is local: no network, the text of the job is never saved.
// Works both in Node (require) and in the panel (window.SCELTA), so the "Try it" box answers instantly.
'use strict';
(function (radice) {
  const LIMITE_BREVE = 600;    // a light job must be shorter than this (characters)
  const LIMITE_LUNGO = 1500;   // anything longer is heavy

  // heavy has precedence over the other levels
  const PESANTE = [
    ['progett', /\bprogett/], ['architettur', /\barchitettur/], ['design', /\bdesign/], ['3d', /\b3d\b/], ['blender', /\bblender/],
    ['render', /\brender/], ['modell', /\bmodell/], ['sito', /\bsit[oi]\b/], ['backend', /\bback-?end/], ['frontend', /\bfront-?end/],
    ['app nuova', /\b(?:app|applicazione) nuova\b|\bnuova (?:app|applicazione)\b/], ['da zero', /\bda zero\b/], ['refactor', /\brefactor/],
    ['migra', /\bmigra/], ['sicurezza', /\bsicurezza/], ['debug difficile', /\bdebug difficile/], ['ottimizz', /\bottimizz/],
    ['plan', /\bplan/], ['architect', /\barchitect/], ['build', /\bbuild/], ['from scratch', /\bfrom scratch\b/],
    ['website', /\bwebsite/], ['security', /\bsecurity/], ['migrate', /\bmigrat/],
  ];
  // light: only for short jobs
  const LEGGERO = [
    ['cerca', /\bcerca/], ['trova', /\btrova/], ['elenca', /\belenca/], ['leggi', /\blegg(?:i|ere|imi)\b/], ['riassumi', /\briassum/],
    ['conta', /\bcont(?:a|are|ami)\b/], ['rinomina', /\brinomin/], ['traduci', /\btradu/], ['formatta', /\bformatt/],
    ['log', /\blogs?\b/], ['stato', /\bstato\b/], ['search', /\bsearch/], ['find', /\bfind/], ['list', /\blist(?:s|ing)?\b/],
    ['read', /\bread\b|\breads\b|\breading\b/], ['summarize', /\bsummar/], ['count', /\bcount/], ['rename', /\brenam/],
    ['translate', /\btranslat/], ['format', /\bformat/], ['status', /\bstatus\b/],
  ];

  const pulisci = t => String(t == null ? '' : t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const cerca = (elenco, t) => { for (const [nome, re] of elenco) if (re.test(t)) return nome; return ''; };

  // → { livello: 'leggero' | 'medio' | 'pesante', motivo, codice, parola, caratteri }
  // codice: 'vuoto' | 'pesanteParola' | 'pesanteLungo' | 'leggeroParola' | 'leggeroLungo' (light word, but too long) | 'medio'
  function scegliLivello(testo) {
    const grezzo = String(testo == null ? '' : testo).trim(), t = pulisci(grezzo), n = grezzo.length;
    const esito = (livello, codice, parola, motivo) => ({ livello, motivo, codice, parola: parola || '', caratteri: n });
    if (!n) return esito('medio', 'vuoto', '', 'empty text: medium');
    const pesante = cerca(PESANTE, t);
    if (pesante) return esito('pesante', 'pesanteParola', pesante, `contains "${pesante}"`);
    if (n > LIMITE_LUNGO) return esito('pesante', 'pesanteLungo', '', `long job (${n} characters, over ${LIMITE_LUNGO})`);
    const leggero = cerca(LEGGERO, t);
    if (leggero && n < LIMITE_BREVE) return esito('leggero', 'leggeroParola', leggero, `short job with "${leggero}"`);
    if (leggero) return esito('medio', 'leggeroLungo', leggero, `"${leggero}" but ${n} characters (light only under ${LIMITE_BREVE})`);
    return esito('medio', 'medio', '', 'no keyword: medium');
  }

  // preferred models where the price list also has older or special models (they must exist in the list, otherwise the
  // automatic choice is used): Anthropic Haiku / Sonnet / Opus 5.5, the newest OpenAI family, the stable Gemini models
  const PREFERITI = {
    anthropic: { leggero: 'claude-haiku-5-5', medio: 'claude-sonnet-5-5', pesante: 'claude-opus-5-5' },
    openai: { leggero: 'gpt-6-luna', medio: 'gpt-6.1-sol', pesante: 'gpt-6-astra' },
    google: { leggero: 'gemini-3.5-flash-lite', medio: 'gemini-3.8-flash', pesante: 'gemini-4-argon' },
  };

  const listinoBase = () => { try { return require('./prezzi').LISTINO; } catch (e) { return { fornitori: {} }; } };
  const peso = p => p.entrata + p.uscita;

  // → { leggero, medio, pesante } each { id, entrata, uscita, valuta } (null if the provider is unknown).
  // Automatic choice: the cheapest, the one closest to the middle (geometric mean of the two prices) and the most expensive.
  // Models with the same price as a cheaper-listed one are aliases (e.g. deepseek-v4-flash) and are skipped.
  // With two models: light and medium use the cheaper one; with one model: all three use it.
  function modelliPerFornitore(fornitore, listino) {
    const L = listino || listinoBase();
    const f = L && L.fornitori && L.fornitori[fornitore];
    if (!f || !f.modelli) return null;
    const voce = (id) => { const p = f.modelli[id]; return p ? { id, entrata: p.entrata, uscita: p.uscita, cache_letta: p.cache_letta == null ? null : p.cache_letta, cache_scritta: p.cache_scritta == null ? null : p.cache_scritta, valuta: p.valuta || 'USD' } : null; };
    const pref = PREFERITI[fornitore];
    if (pref && f.modelli[pref.leggero] && f.modelli[pref.medio] && f.modelli[pref.pesante]) {
      return { leggero: voce(pref.leggero), medio: voce(pref.medio), pesante: voce(pref.pesante) };
    }
    const visti = new Set(), elenco = [];
    for (const [id, p] of Object.entries(f.modelli)) {
      if (p.entrata == null || p.uscita == null || (p.valuta && p.valuta !== 'USD')) continue;
      const k = `${p.entrata}/${p.uscita}`;
      if (visti.has(k)) continue;
      visti.add(k); elenco.push(voce(id));
    }
    if (!elenco.length) return null;
    elenco.sort((a, b) => peso(a) - peso(b));
    const leggero = elenco[0], pesante = elenco[elenco.length - 1];
    let medio = leggero;
    if (elenco.length >= 3) {
      const centro = Math.sqrt(peso(leggero) * peso(pesante));
      const medi = elenco.slice(1, -1);
      medio = medi.reduce((m, x) => (Math.abs(Math.log(peso(x) / centro)) < Math.abs(Math.log(peso(m) / centro)) ? x : m), medi[0]);
    }
    return { leggero, medio, pesante };
  }

  // the assumed mix for the savings estimate
  const QUOTE = { leggero: 0.4, medio: 0.4, pesante: 0.2 };
  // cost of tokens { input, output, cacheScritta, cacheLetta } with one model; where the price list has no cache price:
  // cache write at the input price, cache read at 10% of it (as most providers do; it is an estimate)
  const costoCon = (m, t) => (t.input * m.entrata + t.output * m.uscita
    + t.cacheScritta * (m.cache_scritta != null ? m.cache_scritta : m.entrata)
    + t.cacheLetta * (m.cache_letta != null ? m.cache_letta : m.entrata * 0.1)) / 1e6;
  // → { sempreTop, conScelta, risparmio } in dollars
  function stimaRisparmio(modelli, t) {
    if (!modelli) return null;
    const sempreTop = costoCon(modelli.pesante, t);
    const conScelta = QUOTE.leggero * costoCon(modelli.leggero, t) + QUOTE.medio * costoCon(modelli.medio, t) + QUOTE.pesante * sempreTop;
    return { sempreTop, conScelta, risparmio: Math.max(0, sempreTop - conScelta) };
  }

  // documented options to choose the model in a tool's own configuration (only the ones found in this extension's
  // code and documentation; for the other tools the model is set in the tool itself)
  const CONFIG = {
    kimi: { file: '~/.kimi/config.toml', opzione: 'default_model' },
  };

  const api = { scegliLivello, modelliPerFornitore, stimaRisparmio, QUOTE, CONFIG, LIMITE_BREVE, LIMITE_LUNGO };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else radice.SCELTA = api;
})(typeof self !== 'undefined' ? self : this);
