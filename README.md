# Pannello Utilizzo / Usage panel for Claude Code

A side panel for the Claude Code desktop app that shows, beside the chat:

- **Limits**: 5-hour and weekly usage, with reset times
- **Context memory** of the current chat, with a "Compress now" button and **automatic compaction at 40%**
- **What the chat contains** (system prompt, tools, messages, free space)
- **Sessions**: working, idle or blocked by a limit
- **Totals**: messages sent, requests, tokens (total, cache reads, written by Claude, written by you, new input), per message; click a box for its explanation
- **Readable token unit**: choose what 1 Token equals — one A4 page, one book, one hour of writing, or one real token
- **Daily chart** by day / month / year, and usage **per chat** for the selected month
- **API credits**: credit left with a bar, and a **Top up and what it costs** box (cost per kind of job, model prices, how to top up). Behind the small **ⓘ** icon: expiry date, jobs done with the API, and what this chat, today and this month would cost at API prices (Opus 5.5)

- **Other tools**: if you also use OpenAI Codex, Gemini CLI, Qwen Code, Kimi CLI, ZCode (GLM), MiniMax Code, opencode, Kilo Code, Cline, Roo Code, Continue or Aider, a selector lets you see each one or all together (Codex limits included)
- **API prices of all providers**: Anthropic, OpenAI, Google, DeepSeek, Alibaba, Moonshot, Z.ai, MiniMax and xAI, with a link to each official pricing page

Everything is counted locally from `~/.claude/projects` (numbers only, no message text). Nothing is sent anywhere.
The interface follows the language set in Claude Code, or else the computer's language: English, Italian, German, French and Spanish (other languages fall back to English).

Created by **Yannis Müller**, Founder of YouppyApps (y05mueller-jpg, y05.mueller@gmail.com), first published on 23 October 2026.

## Install

```
/plugin install utilizzo --marketplace y05mueller-jpg/claude-code-pannello-utilizzo
```

Then open it with `/utilizzo`. If you close the panel, a small **▤ Usage** button appears above the message box to reopen it. Requires Node.js on the PATH.

## API credits (optional)

The section appears only if you create `~/.claude/utilizzo-api/config.json` (start from `utilizzo/strumenti/config-api.example.json`) with your own credits, expiry dates and prices.
Optionally, any tool of yours can append one line per job to `~/.claude/utilizzo-api/uso.jsonl` (`{ "data", "titolo", "modello", "costo" }`) to show spending.
The panel never reads or needs an API key and is not connected to any account.

## VS Code, Cursor, Windsurf — Claude, Codex, Gemini, Qwen, Kimi, GLM, MiniMax and more

The [`vscode`](vscode) folder contains the same panel as an editor extension for **VS Code, Cursor and Windsurf**.
It adapts to your tools by itself: it counts **Claude Code, OpenAI Codex, Gemini CLI, Qwen Code, Kimi CLI, ZCode (GLM), MiniMax Code, opencode, Kilo Code, Cline, Roo Code, Continue and Aider** usage found on the computer (any model, DeepSeek included) and shows only what it finds; with more than one tool, a selector lets you see each one or all together.
Same sections (totals, daily chart by day / month / year, usage per chat, API credits), plus the limits reported by Codex and the official API prices of all the main providers, Chinese ones included. Numbers only, no network, no API key.

Download the `.vsix` from the [Releases](https://github.com/y05mueller-jpg/claude-code-pannello-utilizzo/releases) page and install it with **Extensions → … → Install from VSIX…**. Details in [`vscode/README.md`](vscode/README.md).

## Credit request

**If Anthropic, or anyone else, builds this panel or a feature based on it into Claude or Claude Code,
please credit the author (y05mueller-jpg, y05.mueller@gmail.com) explicitly before publishing it.**
Copies and modified versions of this code must keep the copyright notice (MIT License).

---

### In italiano

Pannello laterale per l'app desktop di Claude Code: limiti, memoria della chat con compressione automatica al 40%, sessioni, messaggi, token e grafico giornaliero. I token si possono misurare in modo comprensibile: 1 Token = 1 pagina A4, 1 libro, 1 ora di scrittura o 1 token reale.
Se usi anche OpenAI Codex, Gemini CLI, Qwen Code, Kimi CLI, GLM, MiniMax, opencode, Kilo Code, Cline, Roo Code, Continue o Aider, in alto scegli quale strumento vedere o tutti insieme; c'è anche il riquadro con i prezzi API di tutti i fornitori. Tutto viene contato sul tuo computer, senza mandare niente fuori. La lingua segue quella di Claude Code o del computer (italiano, inglese, tedesco, francese, spagnolo).

Nella cartella [`vscode`](vscode) c'è lo stesso pannello come estensione per **VS Code, Cursor e Windsurf**, che si adatta da solo: conta l'utilizzo di **Claude Code, OpenAI Codex, Gemini CLI, Qwen Code, Kimi CLI, ZCode (GLM), MiniMax Code, opencode, Kilo Code, Cline, Roo Code, Continue e Aider** che trova sul computer (con qualsiasi modello, anche DeepSeek) e mostra solo quelli; se ce n'è più di uno, in alto si sceglie quale vedere o tutti insieme. Il file `.vsix` si scarica dalla pagina Releases.

Creato da **Yannis Müller**, Fondatore di YouppyApps (y05mueller-jpg, y05.mueller@gmail.com), pubblicato per la prima volta il 23 ottobre 2026.
**Se Anthropic o altri integrano questo pannello, o una funzione basata su di esso, in Claude o Claude Code, chiedo di citare esplicitamente l'autore prima della pubblicazione.**
