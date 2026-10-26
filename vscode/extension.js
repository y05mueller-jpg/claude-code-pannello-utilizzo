// "Usage Panel" for VS Code, Cursor, Windsurf and any editor compatible with VS Code extensions.
// A side panel with the messages and tokens used with AI coding tools (Claude Code, OpenAI Codex, Gemini CLI,
// Qwen Code, Kimi CLI, opencode, Cline, Roo Code, Continue, Aider…), counted only from the files these tools
// already write on this computer. No network, no API key, no message text.
'use strict';
const vscode = require('vscode');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const { FONTI } = require('./src/fonti');
const { LINK } = require('./src/prezzi');

// the "globalStorage" folders of the editors on this computer (Cline, Roo Code… keep their tasks there)
function archiviEditor(context) {
  const out = new Set([path.dirname(context.globalStorageUri.fsPath)]);
  const editori = ['Code', 'Code - Insiders', 'Cursor', 'Windsurf', 'VSCodium', 'Trae', 'Kiro'];
  // standard places only (no environment variables are read)
  const basi = process.platform === 'win32' ? [path.join(os.homedir(), 'AppData', 'Roaming')]
    : process.platform === 'darwin' ? [path.join(os.homedir(), 'Library', 'Application Support')]
      : [path.join(os.homedir(), '.config')];
  for (const b of basi) for (const e of editori) {
    const p = path.join(b, e, 'User', 'globalStorage');
    try { if (fs.statSync(p).isDirectory()) out.add(p); } catch (x) { /* not installed */ }
  }
  return [...out];
}

function activate(context) {
  const pannello = new Pannello(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('pannelloUtilizzo.vista', pannello, { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.commands.registerCommand('pannelloUtilizzo.aggiorna', () => pannello.aggiorna()),
    vscode.commands.registerCommand('pannelloUtilizzo.apri', () => vscode.commands.executeCommand('pannelloUtilizzo.vista.focus')),
    vscode.workspace.onDidChangeConfiguration(e => { if (e.affectsConfiguration('pannelloUtilizzo')) { pannello.programma(); pannello.aggiorna(); } }),
    { dispose: () => pannello.ferma() },
  );
}

class Pannello {
  constructor(context) { this.context = context; this.vista = null; this.timer = null; this.lavoro = null; this.ancora = false; this.ultimi = null; }

  impostazioni() {
    const c = vscode.workspace.getConfiguration('pannelloUtilizzo');
    const attive = {};
    for (const f of FONTI) attive[f.id] = c.get(`sources.${f.id}`, true) !== false;
    const cartelle = c.get('folders', {}) || {};
    return {
      attive,
      cartelle: typeof cartelle === 'object' ? cartelle : {},
      api: c.get('apiCredits.enabled', true),
      fileApi: c.get('apiCredits.configFile', ''),
      secondi: Math.max(15, Number(c.get('refreshSeconds', 60)) || 60),
      lingua: c.get('language', 'auto'),
    };
  }
  lingua() { const l = this.impostazioni().lingua; return l && l !== 'auto' ? l : vscode.env.language; }

  resolveWebviewView(vista) {
    this.vista = vista;
    const media = vscode.Uri.joinPath(this.context.extensionUri, 'media');
    vista.webview.options = { enableScripts: true, localResourceRoots: [media] };
    const uri = f => vista.webview.asWebviewUri(vscode.Uri.joinPath(media, f));
    const nonce = crypto.randomBytes(16).toString('base64');
    vista.webview.html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${vista.webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${vista.webview.cspSource} data:;">
<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${uri('pannello.css')}"></head>
<body><div id="app"></div><script nonce="${nonce}" src="${uri('testi.js')}"></script><script nonce="${nonce}" src="${uri('pannello.js')}"></script></body></html>`;
    vista.webview.onDidReceiveMessage(m => {
      if (!m) return;
      if (m.tipo === 'pronto') { if (this.ultimi) this.invia(this.ultimi); this.aggiorna(); }
      if (m.tipo === 'aggiorna') this.aggiorna();
      // only the fixed official pages listed in src/prezzi.js can be opened, in the normal browser
      if (m.tipo === 'link' && typeof m.quale === 'string' && Object.prototype.hasOwnProperty.call(LINK, m.quale)) vscode.env.openExternal(vscode.Uri.parse(LINK[m.quale]));
    });
    vista.onDidChangeVisibility(() => { if (vista.visible) this.aggiorna(); });
    vista.onDidDispose(() => { this.vista = null; });
    this.programma();
  }

  programma() {
    if (this.timer) clearInterval(this.timer);
    // counts again every minute, only while the panel is visible (afterwards only new lines are read)
    this.timer = setInterval(() => { if (this.vista && this.vista.visible) this.aggiorna(); }, this.impostazioni().secondi * 1000);
  }
  ferma() { if (this.timer) clearInterval(this.timer); }

  invia(dati) {
    const o = this.impostazioni();
    if (this.vista) this.vista.webview.postMessage({ tipo: 'dati', dati, lingua: this.lingua(), attive: o.attive });
  }

  aggiorna() {
    if (this.lavoro) { this.ancora = true; return; }
    const o = this.impostazioni();
    const progetti = (vscode.workspace.workspaceFolders || []).map(w => w.uri.fsPath);
    const opzioni = { attive: o.attive, cartelle: o.cartelle, api: o.api, fileApi: o.fileApi, cache: this.context.globalStorageUri.fsPath, archivi: archiviEditor(this.context), progetti };
    if (this.vista) this.vista.webview.postMessage({ tipo: 'inCorso', lingua: this.lingua(), attive: o.attive });
    const fine = (esito) => {
      this.lavoro = null;
      if (esito.ok) { this.ultimi = esito.dati; this.invia(esito.dati); }
      else if (this.vista) this.vista.webview.postMessage({ tipo: 'errore', errore: esito.errore, lingua: this.lingua() });
      if (this.ancora) { this.ancora = false; this.aggiorna(); }
    };
    // counting runs in a worker thread, so the editor never waits
    try {
      const { Worker } = require('worker_threads');
      const w = new Worker(path.join(__dirname, 'src', 'raccolta.js'), { workerData: { pannelloUtilizzo: true, opzioni } });
      this.lavoro = w;
      let finito = false;
      w.once('message', m => { finito = true; fine(m); w.terminate(); });
      w.once('error', e => { if (!finito) { finito = true; fine({ ok: false, errore: String((e && e.message) || e).slice(0, 300) }); } });
      w.once('exit', () => { if (!finito) { finito = true; fine({ ok: false, errore: 'worker stopped' }); } });
    } catch (e) {
      // editors without worker threads: count here (slower the first time)
      this.lavoro = true;
      setTimeout(() => {
        try { fine({ ok: true, dati: require('./src/raccolta').raccogli(opzioni) }); }
        catch (x) { fine({ ok: false, errore: String((x && x.message) || x).slice(0, 300) }); }
      }, 0);
    }
  }
}

function deactivate() {}
module.exports = { activate, deactivate };
