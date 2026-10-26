// The list of tools the panel can read. Each one has its own switch in the settings
// (pannelloUtilizzo.sources.<id>), its own color and its own button in the selector.
// "fornitore" is the API provider (for credits and price links); '*' = the tool can use any provider.
// "verificato" says how the file format was checked: 'dati' = on real files, 'sorgente' = only on the official source code.
'use strict';
const path = require('path'), os = require('os');

const casa = (...p) => path.join(os.homedir(), ...p);

const FONTI = [
  { id: 'claude', nome: 'Claude Code', breve: 'Claude', colore: '#3b82f6', fornitore: 'anthropic', verificato: 'dati',
    cartella: () => casa('.claude', 'projects'), modulo: './claude', funzione: 'leggiClaude' },
  { id: 'codex', nome: 'OpenAI Codex', breve: 'Codex', colore: '#10b981', fornitore: 'openai', verificato: 'sorgente',
    cartella: () => casa('.codex'), modulo: './codex', funzione: 'leggiCodex' },
  { id: 'gemini', nome: 'Gemini CLI', breve: 'Gemini', colore: '#f59e0b', fornitore: 'google', verificato: 'sorgente',
    cartella: () => casa('.gemini'), modulo: './gemini', funzione: 'leggiGemini' },
  { id: 'qwen', nome: 'Qwen Code', breve: 'Qwen', colore: '#8b5cf6', fornitore: 'alibaba', verificato: 'sorgente',
    cartella: () => casa('.qwen'), modulo: './qwen', funzione: 'leggiQwen' },
  { id: 'kimi', nome: 'Kimi CLI', breve: 'Kimi', colore: '#ec4899', fornitore: 'moonshot', verificato: 'sorgente',
    cartella: () => casa('.kimi'), modulo: './kimi', funzione: 'leggiKimi' },
  { id: 'zcode', nome: 'ZCode (GLM)', breve: 'GLM', colore: '#06b6d4', fornitore: 'zhipu', verificato: 'sorgente',
    cartella: () => casa('.zcode'), modulo: './sqlite', funzione: 'leggiZcode' },
  { id: 'minimax', nome: 'MiniMax Code', breve: 'MiniMax', colore: '#ef4444', fornitore: 'minimax', verificato: 'sorgente',
    cartella: () => casa('.minimax'), modulo: './sqlite', funzione: 'leggiMinimax' },
  { id: 'opencode', nome: 'opencode', breve: 'opencode', colore: '#a3a3a3', fornitore: '*', verificato: 'sorgente',
    cartella: () => casa('.local', 'share', 'opencode'), modulo: './sqlite', funzione: 'leggiOpencode' },
  { id: 'kilo', nome: 'Kilo Code', breve: 'Kilo', colore: '#eab308', fornitore: '*', verificato: 'sorgente',
    cartella: () => casa('.local', 'share', 'kilo'), modulo: './sqlite', funzione: 'leggiKilo' },
  { id: 'cline', nome: 'Cline', breve: 'Cline', colore: '#14b8a6', fornitore: '*', verificato: 'sorgente',
    cartella: () => casa('.cline', 'data'), modulo: './editori', funzione: 'leggiCline' },
  { id: 'roo', nome: 'Roo Code', breve: 'Roo', colore: '#f97316', fornitore: '*', verificato: 'sorgente',
    cartella: () => '', modulo: './editori', funzione: 'leggiRoo' },
  { id: 'continue', nome: 'Continue', breve: 'Continue', colore: '#6366f1', fornitore: '*', verificato: 'sorgente',
    cartella: () => casa('.continue'), modulo: './altri', funzione: 'leggiContinue' },
  { id: 'aider', nome: 'Aider', breve: 'Aider', colore: '#84cc16', fornitore: '*', verificato: 'sorgente',
    cartella: () => '', modulo: './altri', funzione: 'leggiAider' },
];

module.exports = { FONTI, casa };
