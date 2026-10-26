// The panel drawn inside the editor (webview). It receives the numbers from the extension and draws:
// source selector, Codex limits, optional API credits, sessions, totals, daily chart by month and usage per chat.
'use strict';
(function () {
  const vscode = acquireVsCodeApi();
  const MISURE = { a4: 650, libri: 200000, ore: 3200, token: 1 };

  let dati = null, errore = '', inCorso = false, attive = null, L = window.TESTI.en;
  // the source actually shown (a tool id or 'tutti') and the tools that have chats on this computer
  let fonte = 'tutti', disponibili = [];
  const infoFonte = f => (dati && dati.fonti && dati.fonti[f]) || { nome: f, breve: f, colore: '#94a3b8' };
  // each tool has its color; the chosen day is drawn darker
  const colore = f => infoFonte(f).colore;
  const scuro = c => { const n = parseInt(c.slice(1), 16); const k = x => Math.round(x * 0.62).toString(16).padStart(2, '0'); return `#${k(n >> 16)}${k((n >> 8) & 255)}${k(n & 255)}`; };
  const salvato = vscode.getState() || {};
  const st = Object.assign({ fonte: 'tutti', misura: 'a4', scelta: null, info: '', menu: '', chatAperte: false, tutte: false, apiAperto: false, apiInfo: false }, salvato);
  st.menu = ''; st.info = '';
  const salva = () => vscode.setState(st);

  // ---- readable numbers ----
  const esc = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const intero = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, L.migliaia);
  const dec = (n, c) => n.toFixed(c).replace('.', L.decimale);
  function breve(n) {
    if (n >= 1e9) return dec(n / 1e9, n >= 1e10 ? 0 : 1) + ' ' + L.mld;
    if (n >= 1e6) return dec(n / 1e6, n >= 1e7 ? 0 : 1) + ' ' + L.mln;
    if (n >= 1e4) return Math.round(n / 1e3) + ' ' + L.mila;
    return intero(n);
  }
  function mis(n) {
    const v = n / (MISURE[st.misura] || MISURE.a4);
    return v >= 1e4 ? breve(v) : v >= 10 ? intero(v) : dec(v, 1).replace(L.decimale + '0', '');
  }
  // dollars: "$12.40" in English, "12,40 $" in the other languages
  const dollari = t => (L.decimale === '.' ? `$${t}` : `${t} $`);
  const soldi = n => dollari(dec(n, n >= 100 ? 0 : 2));
  // prices as written on the price pages: 4, 0.25, 0.125, 0.05 (no trailing zeros)
  const prezzo = n => dollari(n.toFixed(3).replace(/\.?0+$/, '').replace('.', L.decimale));
  const due = n => String(n).padStart(2, '0');
  const chiave = (a, m, g) => `${a}-${due(m + 1)}-${due(g)}`;
  const giorniNelMese = (a, m) => new Date(a, m + 1, 0).getDate();
  function quando(ms) {
    const d = new Date(ms), oggi = new Date(), ora = `${due(d.getHours())}:${due(d.getMinutes())}`;
    if (d.toDateString() === oggi.toDateString()) return L.oggi(ora);
    if (d.toDateString() === new Date(oggi.getTime() + 86400000).toDateString()) return L.domani(ora);
    return L.giornoAlle(`${L.giorniBrevi[d.getDay()]} ${d.getDate()} ${L.mesi[d.getMonth()].slice(0, 3)}`, ora);
  }
  function fa(ms) {
    const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 90) return L.adesso;
    if (s < 3600) return L.minFa(Math.round(s / 60));
    if (s < 86400) return L.hFa(Math.round(s / 3600));
    return L.gFa(Math.round(s / 86400));
  }
  const barra = (p, colore) => `<div class="barra"><div style="width:${Math.max(0, Math.min(100, p))}%;background:${colore}"></div></div>`;
  const sezione = (titolo, corpo) => `<section><h2>${esc(titolo)}</h2>${corpo}</section>`;

  // ---- the numbers of the chosen source ----
  function scelte() {
    const tutte = (dati && dati.sessioni) || [];
    return tutte.filter(s => disponibili.includes(s.fonte) && (fonte === 'tutti' || s.fonte === fonte));
  }
  const zero = () => ({ messaggi: 0, richieste: 0, token: 0, input: 0, output: 0, cacheScritta: 0, cacheLetta: 0, scritti: 0 });
  function somma(c, v) { c.token += v[0]; c.messaggi += v[1]; c.richieste += v[2]; c.input += v[3]; c.output += v[4]; c.cacheScritta += v[5]; c.cacheLetta += v[6]; c.scritti += v[7]; }
  function giorniDi(sessioni) {
    const g = {};
    for (const s of sessioni) for (const [k, v] of Object.entries(s.giorni)) {
      const x = g[k] || (g[k] = Object.assign(zero(), { perFonte: {} }));
      somma(x, v);
      x.perFonte[s.fonte] = (x.perFonte[s.fonte] || 0) + v[0];
    }
    return g;
  }
  const statoDi = s => (Date.now() - s.ultimo < 120000 ? 'lavoro' : s.bloccata ? 'bloccata' : 'ferma');

  // ---- boxes of the totals (two per row; a click shows what the number means) ----
  function riquadri(c, gruppo) {
    // with one tool the boxes name it ("Written by Claude" / "Written by Codex"…), with several they say "the AI"
    const chi = fonte !== 'tutti' ? infoFonte(fonte).breve : '';
    const voci = [
      [L.messaggiInviati, intero(c.messaggi), L.quelliCheScrivi],
      [L.richieste, intero(c.richieste), chi ? L.passiDi(chi) : L.passiAI],
      [L.tokenTotale, mis(c.token), L.tuttoPassato],
      [L.tokenRiletti, mis(c.cacheLetta), L.rilettiCache],
      [L.perMessaggio, mis(c.messaggi ? c.token / c.messaggi : 0), L.tokenMedia],
      [L.scrittiDaTe, mis(c.scritti), L.tokenTuoi],
      [chi ? L.scrittiDa(chi) : L.scrittiAI, mis(c.output), L.tokenRisposta],
      [L.nuoviEntrata, mis(c.input + c.cacheScritta), L.tokenPrimaVolta],
    ];
    return `<div class="riquadri">${voci.map(([nome, valore, nota], i) => {
      const id = `${gruppo}-${i}`;
      return `<button class="riquadro" data-azione="info" data-v="${id}" aria-expanded="${st.info === id}">
        <span class="nome">${esc(nome)}</span><span class="valore">${esc(valore)}</span>
        ${st.info === id ? `<span class="nota">${esc(nota)}</span>` : ''}</button>`;
    }).join('')}</div>`;
  }

  // ---- daily chart of the chosen month (stacked by source when "All" is chosen) ----
  function grafico(g, s) {
    const n = giorniNelMese(s.anno, s.mese), larg = 9, spazio = 3, alto = 120, base = alto - 16, W = n * (larg + spazio) + 4;
    const valori = Array.from({ length: n }, (_, i) => g[chiave(s.anno, s.mese, i + 1)] || null);
    const massimo = Math.max(1, ...valori.map(v => (v ? v.token : 0)));
    let r = `<line x1="0" y1="${base + 0.5}" x2="${W}" y2="${base + 0.5}" class="asse"/>`;
    valori.forEach((v, i) => {
      const x = 2 + i * (larg + spazio), sel = i + 1 === s.giorno;
      const tit = L.barra(i + 1, L.mesi[s.mese], breve(v ? v.token : 0), v ? v.messaggi : 0);
      r += `<g data-azione="giorno" data-v="${i + 1}" class="colonna"><title>${esc(tit)}</title><rect x="${x}" y="0" width="${larg}" height="${base}" fill="transparent"/>`;
      if (v && v.token) {
        let y = base;
        const h = Math.max(2, ((base - 4) * v.token) / massimo);
        for (const f of disponibili) {
          const parte = v.perFonte[f] || 0;
          if (!parte) continue;
          const hh = Math.max(1, (h * parte) / v.token);
          y -= hh;
          r += `<rect x="${x}" y="${y}" width="${larg}" height="${hh}" fill="${sel ? scuro(colore(f)) : colore(f)}"${sel ? ' class="scelta"' : ''}/>`;
        }
      }
      r += '</g>';
      if ((i + 1) % 5 === 0 || i === 0) r += `<text x="${x + larg / 2}" y="${alto - 3}" class="etichetta">${i + 1}</text>`;
    });
    return `<svg class="grafico" viewBox="0 0 ${W} ${alto}" role="img" aria-label="${esc(L.tokenPerGiorno(L.mesi[s.mese], s.anno))}">${r}</svg>`;
  }

  // ---- API prices: the person's own file first, then the official price list shipped with the extension ----
  const norma = m => String(m || '').toLowerCase().replace(/^.*\//, '').replace(/[:@].*$/, '').replace(/-(\d{8}|\d{4}-\d{2}-\d{2})$/, '').replace(/-latest$/, '');
  function prezzoDi(modello) {
    const propri = (dati.api && dati.api.prezzi) || {};
    if (propri[modello]) return propri[modello];
    const n = norma(modello);
    if (!n) return null;
    let migliore = null, lung = 0;
    for (const forn of Object.values((dati.listino && dati.listino.fornitori) || {})) {
      for (const [id, p] of Object.entries(forn.modelli || {})) {
        if (p.valuta && p.valuta !== 'USD') continue;   // costs are only estimated in dollars
        const k = norma(id);
        if (k === n) return p;
        // "gpt-5.5-codex-mini" → "gpt-5.5-codex": the longest known name the model starts with
        if (n.startsWith(k + '-') && k.length > lung) { migliore = p; lung = k.length; }
      }
    }
    return migliore;
  }
  const costo = (p, i, o, cw, cr) => (i * p.entrata + o * p.uscita + cw * (p.cache_scritta != null ? p.cache_scritta : p.entrata) + cr * (p.cache_letta != null ? p.cache_letta : p.entrata)) / 1e6;

  // ---- API credits and prices ("Top up and what it costs") ----
  function sezioneApi(sessioni) {
    const api = dati.api || { presente: false, crediti: [], prezzi: {} }, A = L.api;
    const listino = dati.listino || { fornitori: {} };
    // the providers of the tools shown (a tool like opencode or Cline can use any provider: then all of them)
    const fornitoriFonte = new Set((fonte === 'tutti' ? disponibili : [fonte]).map(f => infoFonte(f).fornitore || '*'));
    const tuttiFornitori = fornitoriFonte.has('*') || fonte === 'tutti';
    const crediti = (api.crediti || []).filter(c => tuttiFornitori || fornitoriFonte.has(c.fornitore));
    const ora = Date.now();
    const attivi = crediti.filter(c => !c.scadenza || Date.parse(c.scadenza + 'T00:00:00') > ora);
    const tot = attivi.reduce((x, c) => x + c.dollari, 0), rimasto = Math.max(0, tot - (api.speso || 0));
    const dataBreve = iso => { const x = new Date(iso + 'T00:00:00'); return `${L.giorniBrevi[x.getDay()]} ${x.getDate()} ${L.mesi[x.getMonth()]}${x.getFullYear() !== new Date().getFullYear() ? ' ' + x.getFullYear() : ''}`; };
    const oggiK = (() => { const o = new Date(); return chiave(o.getFullYear(), o.getMonth(), o.getDate()); })(), meseK = oggiK.slice(0, 7);
    let cOggi = 0, cMese = 0, senzaPrezzo = 0;
    for (const s of sessioni) {
      const p = prezzoDi(s.modello);
      const delMese = Object.keys(s.giorni).some(k => k.startsWith(meseK));
      if (!p) { if (delMese) senzaPrezzo++; continue; }
      for (const [k, v] of Object.entries(s.giorni)) {
        if (!k.startsWith(meseK)) continue;
        const c = costo(p, v[3], v[4], v[5], v[6]);
        cMese += c; if (k === oggiK) cOggi += c;
      }
    }
    let h = '';
    if (tot > 0) h += `<p>${esc(A.rimasti(soldi(rimasto), soldi(tot)))}</p>${barra((100 * rimasto) / tot, rimasto / tot < 0.2 ? '#ef4444' : '#22c55e')}`;
    if (st.apiInfo) {
      // the details open above the box, only after a tap on ⓘ
      const righe = crediti.filter(c => c.scadenza).map(c => {
        const ms = Date.parse(c.scadenza + 'T00:00:00') - ora, gg = Math.ceil(ms / 86400000);
        const di = listino.fornitori[c.fornitore] ? ` · ${listino.fornitori[c.fornitore].nome}` : '';
        return ms > 0 ? `<p class="${gg <= 7 ? 'avviso' : ''}">${esc(A.scade(dataBreve(c.scadenza), gg))} · ${soldi(c.dollari)}${esc(di)}</p>` : `<p class="tenue">${esc(A.scaduto(dataBreve(c.scadenza)))}${esc(di)}</p>`;
      }).join('');
      h += `<div class="dettagli">${api.presente ? (crediti.length ? righe : `<p class="tenue">${esc(A.nessunCredito)}</p>`) + `<p class="tenue">${esc(A.lavori(api.lavori || 0, soldi(api.speso || 0)))}</p>` : `<p class="tenue">${esc(A.senzaFile)}</p>`}
        <p>${esc(A.oggiMese(soldi(cOggi), soldi(cMese)))}</p>
        ${senzaPrezzo ? `<p class="tenue piccolo">${esc(A.senzaPrezzo(senzaPrezzo))}</p>` : ''}
        <p class="piccolo">${esc(A.nonPiano)}</p><p class="piccolo tenue">${esc(A.stima)}</p></div>`;
    }
    let box = `<div class="testata"><button class="apri" data-azione="apiAperto">${st.apiAperto ? '▾' : '▸'} ${esc(A.apriRicarica)}</button>
      <button class="icona${st.apiInfo ? ' attiva' : ''}" data-azione="apiInfo" title="${esc(A.info)}" aria-label="${esc(A.info)}" aria-pressed="${st.apiInfo}">ⓘ</button></div>`;
    if (st.apiAperto) {
      // providers of the tools in use first, then all the others
      const elenco = Object.entries(listino.fornitori).sort((a, b) => (fornitoriFonte.has(b[0]) ? 1 : 0) - (fornitoriFonte.has(a[0]) ? 1 : 0));
      const valore = (n, v) => (n == null ? '—' : v === 'CNY' ? `¥${dec(n, Number.isInteger(n) ? 0 : 2)}` : prezzo(n));
      const propri = Object.entries(api.prezzi || {});
      box += `<h3>${esc(A.costiTitolo)}</h3>${A.costi.map(([n, q]) => `<div class="riga"><span>${esc(n)}</span><b>${esc(q)}</b></div>`).join('')}
        <p class="tenue">${esc(A.conCento)} ${esc(A.esempiCento.join(' · '))}</p>
        <h3>${esc(A.prezziTitolo)}</h3><div class="riga destra tenue piccolo">${esc(A.colonne)}</div>
        ${propri.length ? `<p class="fornitore">${esc(A.tuoiPrezzi)}</p>${propri.map(([m, p]) => `<div class="riga"><span>${esc(m)}</span><b>${prezzo(p.entrata)} · ${prezzo(p.uscita)}</b></div>`).join('')}` : ''}
        ${elenco.map(([id, f]) => `<p class="fornitore">${esc(f.nome)}${f.link ? ` <a href="#" data-azione="link" data-v="${esc(f.link)}" class="piccolo">${esc(A.paginaPrezzi)} ↗</a>` : ''}</p>
          ${Object.entries(f.modelli).map(([m, p]) => `<div class="riga" title="${esc(p.nota || '')}"><span>${esc(m)}</span><b>${valore(p.entrata, p.valuta)} · ${valore(p.uscita, p.valuta)}</b></div>`).join('')}`).join('')}
        ${listino.letto ? `<p class="tenue piccolo">${esc(A.letto(dataBreve(listino.letto)))}</p>` : ''}
        <h3>${esc(A.ricaricaTitolo)}</h3>${A.passi.map((x, i) => `<p>${i + 1}. ${esc(x)}</p>`).join('')}
        <p class="link">${elenco.filter(([id, f]) => f.ricarica && (tuttiFornitori || fornitoriFonte.has(id))).map(([id, f]) => `<a href="#" data-azione="link" data-v="${esc(f.ricarica)}">${esc(f.nome)} ↗</a>`).join(' ')}</p>
        ${(api.ultimi || []).length ? `<h3>${esc(A.ultimi)}</h3>${api.ultimi.map(l => `<p class="tenue">${esc(l.data.slice(5, 16).replace('T', ' '))} · ${esc(l.titolo)} · ${soldi(l.costo)}</p>`).join('')}` : ''}`;
    }
    return sezione(A.sez, h + `<div class="box">${box}</div>`);
  }

  // ---- the whole panel ----
  function disegna() {
    const app = document.getElementById('app');
    const parti = [];
    if (attive && !Object.values(attive).some(Boolean)) { app.innerHTML = `<p class="tenue">${esc(L.nessunaFonte)}</p>`; return; }

    // the panel adapts to the tools found on this computer: only the ones with chats are shown;
    // with one tool there is no selector, with more there is "All" plus one button per tool
    const fonti = (dati && dati.fonti) || {};
    disponibili = Object.keys(fonti).filter(f => (!attive || attive[f]) && fonti[f].sessioni > 0);
    fonte = disponibili.length === 1 ? disponibili[0] : disponibili.includes(st.fonte) ? st.fonte : 'tutti';
    const aggiorna = `<button class="icona" data-azione="aggiorna" title="${esc(L.aggiorna)}" aria-label="${esc(L.aggiorna)}">${inCorso ? '…' : '↻'}</button>`;
    if (disponibili.length > 1) {
      parti.push(`<div class="cima"><div class="fonti" role="radiogroup" aria-label="${esc(L.scegliFonte)}">${['tutti', ...disponibili].map(f =>
        `<button role="radio" aria-checked="${fonte === f}" class="${fonte === f ? 'scelto' : ''}" data-azione="fonte" data-v="${esc(f)}" title="${esc(f === 'tutti' ? L.fonti.tutti : infoFonte(f).nome)}">${f !== 'tutti' ? `<i style="background:${colore(f)}"></i>${esc(infoFonte(f).breve)}` : esc(L.fonti.tutti)}</button>`).join('')}</div>${aggiorna}</div>`);
    } else {
      const solo = disponibili[0];
      parti.push(`<div class="cima"><span class="solo">${solo ? `<i style="background:${colore(solo)}"></i>${esc(infoFonte(solo).nome)}` : ''}</span>${aggiorna}</div>`);
    }
    if (dati) parti.push(`<p class="tenue piccolo">${esc(L.aggiornato(fa(dati.aggiornato)))}</p>`);
    if (errore) parti.push(`<p class="errore">${esc(L.erroreConteggio(errore))}</p>`);
    if (!dati) { parti.push(`<p class="tenue">${esc(L.stoContando)}</p>`); app.innerHTML = parti.join(''); return; }
    const cercate = Object.keys(fonti).filter(f => !attive || attive[f]);
    if (!disponibili.length) {
      // nothing found yet: say where we looked
      parti.push(`<p class="tenue">${esc(L.nienteTrovato)}</p>`);
      for (const f of cercate) parti.push(`<p class="tenue piccolo">${esc(fonti[f].nome)}: ${esc(fonti[f].cartella)}</p>`);
      app.innerHTML = parti.join(''); return;
    }
    for (const a of dati.avvisi || []) if (a.chiave === 'codexZst' && (fonte === 'tutti' || fonte === a.fonte)) parti.push(`<p class="avviso piccolo">${esc(L.codexZst(a.n))}</p>`);
    for (const f of disponibili) if (fonti[f].errore && (fonte === 'tutti' || fonte === f)) parti.push(`<p class="errore piccolo">${esc(fonti[f].nome)}: ${esc(L.erroreConteggio(fonti[f].errore))}</p>`);

    const sessioni = scelte(), g = giorniDi(sessioni);

    // limits reported by the tools themselves (today: OpenAI Codex, 5 hours and weekly), from their last reply
    for (const f of disponibili.filter(x => fonte === 'tutti' || fonte === x)) {
      const lim = (dati.limiti || []).filter(l => l.fonte === f);
      if (!lim.length) continue;
      const nome = m => (m === 300 ? L.ultime5 : m === 10080 ? L.settimanale : L.ultimeOre(Math.round(m / 60)));
      const righe = lim.map(l => {
        const p = Math.round(l.percento), col = p >= 90 ? '#ef4444' : p >= 70 ? '#f59e0b' : colore(f);
        return `<div class="limite"><p>${esc(nome(l.minuti))}: <b>${p}%</b></p>${l.azzera ? `<p class="tenue piccolo">${esc(L.siAzzera(quando(l.azzera)))}</p>` : ''}${barra(p, col)}</div>`;
      }).join('');
      parti.push(sezione(L.sezLimiti(infoFonte(f).nome), righe + `<p class="tenue piccolo">${esc(L.lettoDa(infoFonte(f).breve, fa(lim[0].letto)))}</p>`));
    }

    if (dati.api) parti.push(sezioneApi(sessioni));

    // sessions
    const conta = x => sessioni.filter(s => statoDi(s) === x).length;
    parti.push(sezione(L.sessioni, `<p><b class="blu">${conta('lavoro')}</b> ${esc(L.alLavoro)} · <b>${conta('ferma')}</b> ${esc(L.ferme)} · <b class="rosso">${conta('bloccata')}</b> ${esc(L.bloccate)}</p><p class="tenue">${esc(L.suTot(sessioni.length))}</p>`));

    // overall total, with the unit chooser
    const t = zero();
    for (const s of sessioni) { t.messaggi += s.messaggi; t.richieste += s.richieste; t.token += s.token; t.input += s.u[0]; t.output += s.u[1]; t.cacheScritta += s.u[2]; t.cacheLetta += s.u[3]; t.scritti += s.scritti; }
    const menuMisura = st.menu === 'misura' ? `<div class="finestra">${Object.keys(MISURE).map(k =>
      `<button class="${k === st.misura ? 'scelto' : ''}" data-azione="misura" data-v="${k}">${esc(L.misure[k].nome.replace(/^1 /, ''))}</button>`).join('')}
      <p class="tenue piccolo">${esc(L.misure[st.misura].spiega)}</p></div>` : '';
    parti.push(sezione(L.totale, `<div class="sopra"><div class="riga sinistra"><button class="scegli" data-azione="menu" data-v="misura">${esc(L.misure[st.misura].nome)} ▾</button><span>${esc(L.ugualeToken)}</span></div>${menuMisura}</div>${riquadri(t, 'tot')}`));

    // day by day
    const oggi = new Date();
    if (!st.scelta) st.scelta = { anno: oggi.getFullYear(), mese: oggi.getMonth(), giorno: oggi.getDate() };
    const s = st.scelta;
    s.giorno = Math.min(s.giorno, giorniNelMese(s.anno, s.mese));
    const anni = Array.from(new Set(Object.keys(g).map(k => Number(k.slice(0, 4))).concat(oggi.getFullYear(), s.anno))).sort();
    const griglia = (tipo, voci, colonne) => `<div class="finestra griglia" style="grid-template-columns:repeat(${colonne},1fr)">${voci.map(v =>
      `<button class="${v.scelta ? 'scelto' : ''}${v.oggi ? ' oggi' : ''}" data-azione="${tipo}" data-v="${v.v}">${esc(v.nome)}</button>`).join('')}</div>`;
    let finestra = '';
    if (st.menu === 'giorno') finestra = griglia('giorno', Array.from({ length: giorniNelMese(s.anno, s.mese) }, (_, i) => ({ v: i + 1, nome: String(i + 1), scelta: i + 1 === s.giorno, oggi: i + 1 === oggi.getDate() && s.mese === oggi.getMonth() && s.anno === oggi.getFullYear() })), 7);
    if (st.menu === 'mese') finestra = griglia('mese', L.mesi.map((nome, i) => ({ v: i, nome, scelta: i === s.mese, oggi: i === oggi.getMonth() && s.anno === oggi.getFullYear() })), 3);
    if (st.menu === 'anno') finestra = griglia('anno', anni.map(a => ({ v: a, nome: String(a), scelta: a === s.anno, oggi: a === oggi.getFullYear() })), Math.min(3, anni.length));
    const scegli = (nome, tipo, valore) => `<div class="campo"><span class="tenue piccolo">${esc(nome)}</span><button class="scegli" data-azione="menu" data-v="${tipo}">${esc(valore)}</button></div>`;
    const gSel = g[chiave(s.anno, s.mese, s.giorno)];
    const mese = zero();
    for (let i = 1; i <= giorniNelMese(s.anno, s.mese); i++) { const x = g[chiave(s.anno, s.mese, i)]; if (x) for (const k of Object.keys(mese)) mese[k] += x[k]; }
    parti.push(sezione(L.perGiorno, `<div class="sopra"><div class="scelte">
        <button class="freccia" data-azione="sposta" data-v="-1" title="${esc(L.mesePrima)}" aria-label="${esc(L.mesePrima)}">◀</button>
        ${scegli(L.giorno, 'giorno', s.giorno)}${scegli(L.mese, 'mese', L.mesi[s.mese])}${scegli(L.anno, 'anno', s.anno)}
        <button class="freccia" data-azione="sposta" data-v="1" title="${esc(L.meseDopo)}" aria-label="${esc(L.meseDopo)}">▶</button></div>${finestra}</div>
      ${grafico(g, s)}
      ${fonte === 'tutti' ? `<p class="legenda piccolo">${disponibili.map(f => `<span><i style="background:${colore(f)}"></i>${esc(infoFonte(f).nome)}</span>`).join(' ')}</p>` : ''}
      <p><b>${s.giorno} ${esc(L.mesi[s.mese])} ${s.anno}</b></p><p class="tenue">${esc(L.rigaGiorno(mis(gSel ? gSel.token : 0), gSel ? gSel.messaggi : 0))}</p>`));
    parti.push(sezione(L.totaleDi(L.mesi[s.mese], s.anno), riquadri(mese, 'mese')));

    // per chat, grouped by day (most recent first)
    const km = `${s.anno}-${due(s.mese + 1)}`;
    const delMese = sessioni.filter(x => Object.keys(x.giorni).some(k => k.startsWith(km) && (x.giorni[k][0] > 0 || x.giorni[k][1] > 0)));
    const giorniMese = Array.from(new Set(delMese.flatMap(x => Object.keys(x.giorni).filter(k => k.startsWith(km))))).sort().reverse();
    let chat = '';
    if (st.chatAperte) {
      for (const k of (st.tutte ? giorniMese : giorniMese.slice(0, 7))) {
        const [aa, mm, gg] = k.split('-').map(Number);
        const qui = delMese.filter(x => x.giorni[k] && (x.giorni[k][0] > 0 || x.giorni[k][1] > 0)).sort((a, b) => b.ultimo - a.ultimo);
        chat += `<div class="giornata"><p class="blu"><b>${esc(L.giorni[new Date(aa, mm - 1, gg).getDay()])} ${gg} ${esc(L.mesi[mm - 1])}</b></p>${qui.map(x => {
          const v = x.giorni[k], stato = statoDi(x);
          return `<div class="chat"><p><i class="punto" style="background:${colore(x.fonte)}" title="${esc(infoFonte(x.fonte).nome)}"></i><b>${stato === 'lavoro' ? '● ' : stato === 'bloccata' ? '■ ' : ''}${esc((x.titolo || L.senzaTitolo).slice(0, 60))}</b></p>
            <p>${esc(L.rigaChat(intero(v[1]), mis(v[0]), mis(v[2] ? v[0] / v[2] : 0)))}</p>
            <p class="tenue">${esc([x.progetto, x.modello, L.ultimaAttivita(fa(x.ultimo))].filter(Boolean).join(' · '))}</p></div>`;
        }).join('')}</div>`;
      }
      if (giorniMese.length > 7) chat += `<button class="apri" data-azione="tutte">${esc(st.tutte ? L.mostraMeno : L.mostraTutti(giorniMese.length))}</button>`;
    }
    parti.push(`<div class="box"><button class="apri" data-azione="chatAperte">${st.chatAperte ? '▾' : '▸'} ${esc(L.perChat(`${L.mesi[s.mese]} ${s.anno}`, delMese.length))}</button>${chat}</div>`);
    // tools that are on but have no chats on this computer: one small line at the bottom
    const assenti = cercate.filter(f => !disponibili.includes(f)).map(f => fonti[f].nome);
    if (assenti.length) parti.push(`<p class="tenue piccolo">${esc(L.nonTrovati(assenti.join(', ')))}</p>`);
    parti.push(`<p class="tenue piccolo">${esc(L.notaStati)}</p><p class="tenue piccolo">${esc(L.privacy)}</p>`);
    parti.push(`<p class="tenue piccolo firma">${esc(L.creatoDa)}</p>`);   // firma dell'autore
    app.innerHTML = parti.join('');
  }

  // ---- clicks ----
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-azione]');
    if (!el) { if (st.menu || st.info) { st.menu = ''; st.info = ''; disegna(); } return; }
    e.preventDefault();
    const a = el.getAttribute('data-azione'), v = el.getAttribute('data-v');
    const s = st.scelta;
    const fissa = () => { s.giorno = Math.min(s.giorno, giorniNelMese(s.anno, s.mese)); };
    switch (a) {
      case 'fonte': st.fonte = v; break;
      case 'aggiorna': vscode.postMessage({ tipo: 'aggiorna' }); inCorso = true; break;
      case 'info': st.info = st.info === v ? '' : v; st.menu = ''; break;
      case 'menu': st.menu = st.menu === v ? '' : v; st.info = ''; break;
      case 'misura': st.misura = v; st.menu = ''; break;
      case 'giorno': s.giorno = Number(v); st.menu = ''; break;
      case 'mese': s.mese = Number(v); fissa(); st.menu = ''; break;
      case 'anno': s.anno = Number(v); fissa(); st.menu = ''; break;
      case 'sposta': { const m = s.mese + Number(v); s.anno += Math.floor(m / 12); s.mese = ((m % 12) + 12) % 12; fissa(); st.menu = ''; break; }
      case 'chatAperte': st.chatAperte = !st.chatAperte; break;
      case 'tutte': st.tutte = !st.tutte; break;
      case 'apiAperto': st.apiAperto = !st.apiAperto; break;
      case 'apiInfo': st.apiInfo = !st.apiInfo; break;
      case 'link': vscode.postMessage({ tipo: 'link', quale: v }); return;
    }
    salva(); disegna();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && (st.menu || st.info)) { st.menu = ''; st.info = ''; disegna(); } });

  // ---- messages from the extension ----
  window.addEventListener('message', e => {
    const m = e.data || {};
    if (m.tipo === 'dati') { dati = m.dati; errore = ''; inCorso = false; }
    if (m.tipo === 'errore') { errore = m.errore; inCorso = false; }
    if (m.tipo === 'inCorso') inCorso = true;
    if (m.lingua) L = window.TESTI[window.TESTI.lingua(m.lingua)];
    if (m.attive) attive = m.attive;
    disegna();
  });
  setInterval(() => { if (dati) disegna(); }, 30000);   // "x min ago" and working/idle stay current
  disegna();
  vscode.postMessage({ tipo: 'pronto' });
})();
