# Usage Panel for Claude Code & OpenAI Codex

A side panel for **VS Code, Cursor, Windsurf** (and any editor that installs VS Code extensions) that shows how much you use your AI coding assistants:

- **Adapts to your provider by itself**: it looks for Claude Code and OpenAI Codex CLI chats on your computer and shows only what it finds. With one provider the panel is just for that one; with both, a selector at the top lets you see **Claude**, **OpenAI** or **All** together
- **Totals**: messages sent, requests, tokens (total, re-read from cache, written by the AI, written by you, new input), tokens per message. Click a box for its explanation
- **Readable token unit**: choose what 1 Token equals — one A4 page, one book, one hour of writing, or one real token
- **Daily bar chart** for the chosen month, with day / month / year choosers (stacked by source when "All" is selected), and the totals of that month
- **Usage per chat** for the chosen month, grouped by day, with project, model and last activity
- **Sessions**: working, idle or blocked by a limit
- **OpenAI Codex limits** (5-hour and weekly window) as last reported by Codex
- **API credits** (optional): credit left with a bar, and a **Top up and what it costs** box. Details (expiry dates, jobs done with the API, what today and this month would cost at API prices) open above the box behind the small **ⓘ** icon

![The panel](images/pannello.png)

*Screenshot with invented data.*

## Privacy

Everything is counted **on your computer** from the chat files that the tools already write:

| Source | Files read |
|---|---|
| Claude Code | `~/.claude/projects/**/*.jsonl` |
| OpenAI Codex CLI | `~/.codex/sessions/**/rollout-*.jsonl` (and `.jsonl.zst`), `~/.codex/archived_sessions/`, `~/.codex/session_index.jsonl` (thread names) |

Only numbers are kept: token counts, dates, message counts, chat titles, project folder names and model names.
**Message text is never stored or shown** (only its length is used to estimate "tokens written by you").
The extension makes **no network requests**, **never reads or asks for an API key**, and is not connected to any account.
A small cache with the numbers is kept in the editor's extension storage so that, after the first time, only new lines are read.

## Install

### From a `.vsix` file (VS Code, Cursor, Windsurf)

1. Download `pannello-utilizzo-1.0.0.vsix` from the [Releases](https://github.com/y05mueller-jpg/claude-code-pannello-utilizzo/releases) page.
2. Install it:
   - **VS Code**: Extensions view (`Ctrl+Shift+X`) → `…` menu → **Install from VSIX…**, or run `code --install-extension pannello-utilizzo-1.0.0.vsix`
   - **Cursor**: Extensions view → `…` menu → **Install from VSIX…** (or drag the file onto the Extensions view), or run `cursor --install-extension pannello-utilizzo-1.0.0.vsix`
   - **Windsurf**: Extensions view → `…` menu → **Install from VSIX…**, or run `windsurf --install-extension pannello-utilizzo-1.0.0.vsix`
3. Click the **bar-chart icon** in the activity bar (or run **Usage Panel: Open** from the Command Palette).

### Build it yourself

From the `vscode` folder of this repository:

```
npm install
npm test
npm run package
```

No runtime dependencies: the extension is plain JavaScript.

## Settings

| Setting | Default | |
|---|---|---|
| `pannelloUtilizzo.sources.claudeCode` | `true` | Count Claude Code chats |
| `pannelloUtilizzo.sources.openaiCodex` | `true` | Count OpenAI Codex CLI sessions |
| `pannelloUtilizzo.claudeCode.folder` | `~/.claude/projects` | Where the Claude Code chats are |
| `pannelloUtilizzo.openaiCodex.folder` | `~/.codex` | Codex home folder (set it if you use `CODEX_HOME`) |
| `pannelloUtilizzo.apiCredits.enabled` | `true` | Show the API credits section when its file exists |
| `pannelloUtilizzo.apiCredits.configFile` | `~/.claude/utilizzo-api/config.json` | Your API credits file |
| `pannelloUtilizzo.refreshSeconds` | `60` | How often to count again while the panel is visible |
| `pannelloUtilizzo.language` | `auto` | English, Italian, German, French or Spanish; `auto` follows the editor |

## API credits (optional)

The section appears only if you create the configuration file yourself (start from [`config-api.example.json`](config-api.example.json)) with your own credits, expiry dates and prices per million tokens.
Add `"fonte": "openai"` to a credit to show it under OpenAI. Models without a price are estimated with the Opus 5.5 price.
Optionally, any tool of yours can append one line per job to `uso.jsonl` in the same folder (`{ "data", "titolo", "modello", "costo" }`) to show spending.
The panel never reads or needs an API key.

## How the numbers are counted

- **Claude Code**: one request per model reply (repeated lines of the same reply are counted once); tokens = input + output + cache write + cache read. Same logic as the Claude Code mod in [`utilizzo/strumenti/conta.js`](../utilizzo/strumenti/conta.js).
- **OpenAI Codex CLI**: format checked against the official source code ([openai/codex](https://github.com/openai/codex)). One request per `token_usage_record` (newer Codex) or per new `token_count` event (older Codex); `input_tokens` includes the cached tokens, which are shown as "re-read"; `output_tokens` includes reasoning. A reply copied into a forked thread is counted once.
- **Working / idle / blocked** are estimated from the files: working = written in the last 2 minutes; blocked = the last reply was a limit error (Claude) or a limit window at 100% (Codex).
- Compressed old Codex sessions (`.jsonl.zst`) are read when the editor's Node.js supports zstd; otherwise the panel says how many were skipped.

The same panel also exists as a mod inside the Claude Code desktop app, in the [`utilizzo`](../utilizzo) folder of this repository.

Created by **y05mueller-jpg** (y05.mueller@gmail.com), first published on 26 October 2026.

## Credit request

**If Anthropic, OpenAI, or anyone else, builds this panel or a feature based on it into their products,
please credit the author (y05mueller-jpg, y05.mueller@gmail.com) explicitly before publishing it.**
Copies and modified versions of this code must keep the copyright notice (MIT License).

---

### In italiano

Pannello laterale per VS Code, Cursor e Windsurf con messaggi, token, grafico giornaliero e utilizzo per chat di **Claude Code** e **OpenAI Codex CLI**. Si adatta da solo al provider: mostra solo quello che trova sul computer; se ci sono tutti e due, in alto c'è il selettore Claude, OpenAI o tutti insieme. Sezione facoltativa «Crediti API» con il box «Ricarica e quanto costa» e i dettagli dietro l'icona ⓘ.
Tutto viene contato sul tuo computer dai file delle chat: solo numeri, niente testo dei messaggi, niente rete, nessuna chiave API. Lingue: italiano, inglese, tedesco, francese, spagnolo.

Creato da **y05mueller-jpg** (y05.mueller@gmail.com), pubblicato per la prima volta il 26 ottobre 2026.
**Se Anthropic, OpenAI o altri integrano questo pannello, o una funzione basata su di esso, nei loro prodotti, chiedo di citare esplicitamente l'autore prima della pubblicazione.**
