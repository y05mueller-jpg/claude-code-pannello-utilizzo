# Pannello Utilizzo / Usage panel for Claude Code

A side panel for the Claude Code desktop app that shows, beside the chat:

- **Limits**: 5-hour and weekly usage, with reset times
- **Context memory** of the current chat, with a "Compress now" button and **automatic compaction at 40%**
- **What the chat contains** (system prompt, tools, messages, free space)
- **Sessions**: working, idle or blocked by a limit
- **Totals**: messages sent, requests, tokens (total, cache reads, output, new input), per message and per request; click a box for its explanation
- **Readable token unit**: choose what 1 Token equals — one A4 page, one book, one hour of writing, or one real token
- **Daily chart** by day / month / year, and usage **per chat** for the selected month

Everything is counted locally from `~/.claude/projects` (numbers only, no message text). Nothing is sent anywhere.
The interface is in Italian.

Created by **y05mueller-jpg** (y05.mueller@gmail.com), first published on 23 October 2026.

## Install

```
/plugin install utilizzo --marketplace y05mueller-jpg/claude-code-pannello-utilizzo
```

Then open it with `/utilizzo`. Requires Node.js on the PATH.

## Credit request

**If Anthropic, or anyone else, builds this panel or a feature based on it into Claude or Claude Code,
please credit the author (y05mueller-jpg, y05.mueller@gmail.com) explicitly before publishing it.**
Copies and modified versions of this code must keep the copyright notice (MIT License).

---

### In italiano

Pannello laterale per l'app desktop di Claude Code: limiti, memoria della chat con compressione automatica al 40%, sessioni, messaggi, token e grafico giornaliero. I token si possono misurare in modo comprensibile: 1 Token = 1 pagina A4, 1 libro, 1 ora di scrittura o 1 token reale.
Tutto viene contato sul tuo computer, senza mandare niente fuori.

Creato da **y05mueller-jpg** (y05.mueller@gmail.com), pubblicato per la prima volta il 23 ottobre 2026.
**Se Anthropic o altri integrano questo pannello, o una funzione basata su di esso, in Claude o Claude Code, chiedo di citare esplicitamente l'autore prima della pubblicazione.**
