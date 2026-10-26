# Changelog

## 1.2.0 — 2026-10-26
- New **Model choice** section (model routing): for every tool found, the light / medium / heavy model of its provider (cheapest, middle, flagship from the shipped price list; Anthropic Haiku / Sonnet / Opus 5.5) with input/output prices, what each level is for, and an estimate of the savings this month compared with always using the flagship (assuming 40% light, 40% medium, 20% heavy).
- **Try it** box: describe a job and see at once the level, the model and the reason. Computed in the panel, nothing saved or sent.
- Same rules as the Claude Code panel (`src/scelta.js`), with a test (`test/prova-scelta.js`). Texts in five languages.

## 1.1.0 — 2026-10-26
- Many more tools, each with its own switch and color: Gemini CLI, Qwen Code, Kimi CLI, ZCode (GLM), MiniMax Code, opencode, Kilo Code, Cline, Roo Code, Continue and Aider (readers written from the official source code; only Claude Code tried on real files).
- The panel shows only the tools found on the computer; with more than one, a selector with one button per tool.
- "Top up and what it costs" now lists the official API prices of Anthropic, OpenAI, Google, DeepSeek, Alibaba (Qwen), Moonshot (Kimi), Z.ai (GLM), MiniMax and xAI (read on 26 October 2026), with links to the price pages; cost estimates use the model of each chat.
- The API section also works without a credits file.

## 1.0.0 — 2026-10-26
- First version: side panel for VS Code, Cursor and Windsurf with Claude Code and OpenAI Codex CLI usage, totals, daily chart, usage per chat, Codex limits and optional API credits. Five languages.
