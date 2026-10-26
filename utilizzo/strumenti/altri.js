// Altri strumenti per il pannello «Utilizzo» di Claude Code: OpenAI Codex, Gemini CLI, Qwen Code, Kimi CLI, ZCode (GLM),
// MiniMax Code, opencode, Kilo Code, Cline, Roo Code, Continue e Aider. Usa gli stessi lettori dell'estensione VS Code
// (vscode/src), impacchettati dentro hooks/register.tsx da strumenti/genera-altri.js. Claude Code lo conta già conta.js.
// Legge solo i numeri dai file di quegli strumenti su questo PC: niente rete, nessuna chiave, nessun testo dei messaggi.
// Uscita (stdout): JSON { aggiornato, fonti: { id: { nome, breve, colore, fornitore, dati } }, limiti, cercati, listino }
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { FONTI } = require('./fonti');
const { raccogli } = require('./raccolta');

// le cartelle «globalStorage» degli editor (Cline e Roo Code ci tengono i loro compiti); solo i posti standard
function archiviEditor() {
  const out = [];
  const editori = ['Code', 'Code - Insiders', 'Cursor', 'Windsurf', 'VSCodium', 'Trae', 'Kiro'];
  const basi = process.platform === 'win32' ? [path.join(os.homedir(), 'AppData', 'Roaming')]
    : process.platform === 'darwin' ? [path.join(os.homedir(), 'Library', 'Application Support')]
      : [path.join(os.homedir(), '.config')];
  for (const b of basi) for (const e of editori) {
    const p = path.join(b, e, 'User', 'globalStorage');
    try { if (fs.statSync(p).isDirectory()) out.push(p); } catch (x) { /* non installato */ }
  }
  return out;
}

const attive = {};
for (const f of FONTI) if (f.id !== 'claude') attive[f.id] = true;
const { LINK } = require('./prezzi');
const r = raccogli({ attive, cartelle: {}, cache: path.join(os.homedir(), '.claude', 'utilizzo-altri'), archivi: archiviEditor(), progetti: [] });

// ogni strumento nella stessa forma dei numeri di Claude Code (conta.js): { aggiornato, totali, sessioni, giorni }
const ora = Date.now();
const fonti = {};
for (const [id, info] of Object.entries(r.fonti)) {
  const sue = r.sessioni.filter(s => s.fonte === id);
  if (!sue.length) continue;
  const totali = { messaggi: 0, richieste: 0, token: 0, input: 0, output: 0, cacheScritta: 0, cacheLetta: 0, scritti: 0, sessioni: 0 };
  const giorni = {}, sessioni = [];
  for (const s of sue) {
    const u = s.u || [0, 0, 0, 0];
    totali.messaggi += s.messaggi || 0; totali.richieste += s.richieste || 0; totali.token += s.token || 0; totali.scritti += s.scritti || 0;
    totali.input += u[0]; totali.output += u[1]; totali.cacheScritta += u[2]; totali.cacheLetta += u[3]; totali.sessioni++;
    const mesi = {}, g3 = {};
    for (const [k, v] of Object.entries(s.giorni || {})) {
      const x = giorni[k] || (giorni[k] = { token: 0, messaggi: 0, richieste: 0, input: 0, output: 0, cacheScritta: 0, cacheLetta: 0, scritti: 0 });
      x.token += v[0] || 0; x.messaggi += v[1] || 0; x.richieste += v[2] || 0; x.input += v[3] || 0; x.output += v[4] || 0;
      x.cacheScritta += v[5] || 0; x.cacheLetta += v[6] || 0; x.scritti += v[7] || 0;
      const m = mesi[k.slice(0, 7)] || (mesi[k.slice(0, 7)] = [0, 0, 0]);
      m[0] += v[0] || 0; m[1] += v[1] || 0; m[2] += v[2] || 0;
      g3[k] = [v[0] || 0, v[1] || 0, v[2] || 0];
    }
    const stato = ora - s.ultimo < 120000 ? 'al lavoro' : s.bloccata ? 'bloccata' : 'ferma';
    sessioni.push({ id: `${id}:${s.id}`, titolo: s.titolo || 'Senza titolo', progetto: s.progetto || info.nome, modello: s.modello || '',
      messaggi: s.messaggi || 0, richieste: s.richieste || 0, token: s.token || 0, u, ultimo: s.ultimo || 0, stato, mesi, giorni: g3 });
  }
  sessioni.sort((a, b) => b.ultimo - a.ultimo);
  fonti[id] = { nome: info.nome, breve: info.breve, colore: info.colore, fornitore: info.fornitore, dati: { aggiornato: ora, totali, sessioni, giorni } };
}
// limiti riportati dagli strumenti stessi (per ora Codex: finestra di 5 ore e settimanale)
const limiti = r.limiti.filter(l => fonti[l.fonte]).map(l => ({ fonte: l.fonte, minuti: l.minuti, percento: l.percento, azzera: l.azzera }));
// gli strumenti cercati, anche quelli non trovati, e gli errori (uno strumento rotto non ferma gli altri)
const cercati = Object.entries(r.fonti).map(([id, f]) => ({ id, nome: f.nome, trovato: !!fonti[id], errore: f.errore || '' }));
process.stdout.write(JSON.stringify({ aggiornato: ora, fonti, limiti, cercati, listino: r.listino, link: LINK }));
