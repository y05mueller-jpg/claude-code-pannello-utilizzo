// Official API prices (US dollars per 1 million tokens), read on the providers' own pricing pages on 2026-10-26.
// Used for the table in "Top up and what it costs" and to estimate what the chats would cost if paid with the API.
// Prices in the person's own configuration file always win over these.
// Only the models whose id and price were read on the official page are here; uncertain ones are left out.
'use strict';

const P = (entrata, uscita, cache_letta, cache_scritta, nota) => ({ entrata, uscita, cache_letta: cache_letta == null ? null : cache_letta, cache_scritta: cache_scritta == null ? null : cache_scritta, valuta: 'USD', nota: nota || '' });

const LISTINO = {
  letto: '2026-10-26',
  fornitori: {
    anthropic: { nome: 'Anthropic', link: 'prezzi-anthropic', ricarica: 'ricarica-anthropic', modelli: {
      'claude-fable-5-1': P(10, 50, 0.25, 12.5, 'cache write 5 min; 1 h: $20'),
      'claude-opus-5-5': P(4, 20, 0.2, 5, 'cache write 5 min; 1 h: $8'),
      'claude-sonnet-5-5': P(2, 10, 0.1, 2.5, 'cache write 5 min; 1 h: $4'),
      'claude-haiku-5-5': P(0.1, 0.5, 0.01, 0.125, 'prompt > 100k: 0.50 / 2.50'),
    } },
    openai: { nome: 'OpenAI', link: 'prezzi-openai', ricarica: 'ricarica-openai', modelli: {
      'gpt-6-astra': P(10, 50, 1, null, '> 272k input: 20 / 75'),
      'gpt-6.1-sol': P(2, 10, 0.1, null, '> 272k input: 4 / 15'),
      'gpt-6-sol': P(2, 10, 0.2, null, '> 272k input: 4 / 15'),
      'gpt-6-luna': P(0.1, 0.5, 0.01, null, '> 272k input: 0.20 / 0.75'),
      'gpt-5.5': P(5, 30, 0.5, null, '> 272k input: 10 / 45'),
      'gpt-5.3-codex': P(1.75, 14, 0.175, null, ''),
      'gpt-5.1': P(1.25, 10, 0.125, null, ''),
      'gpt-5': P(1.25, 10, 0.125, null, ''),
      'gpt-5-mini': P(0.25, 2, 0.025, null, ''),
      'gpt-5-nano': P(0.05, 0.4, 0.005, null, ''),
    } },
    google: { nome: 'Google Gemini', link: 'prezzi-google', modelli: {
      'gemini-4-argon': P(2, 10, 0.1, null, 'until 30.11.2026; from 1.12.2026: 4 / 20'),
      'gemini-3.8-flash': P(0.75, 3.75, 0.075, null, 'from 1.1.2027: 1.50 / 7.50'),
      'gemini-3.6-flash': P(0.75, 3.75, 0.075, null, ''),
      'gemini-3.5-flash-lite': P(0.3, 2.5, 0.03, null, ''),
      'gemini-3.1-pro-preview': P(2, 12, 0.2, null, '> 200k: 4 / 18'),
      'gemini-2.5-pro': P(1.25, 10, 0.125, null, '> 200k: 2.50 / 15'),
      'gemini-2.5-flash': P(0.3, 2.5, 0.03, null, ''),
    } },
    deepseek: { nome: 'DeepSeek', link: 'prezzi-deepseek', modelli: {
      'deepseek-v4-pro': P(1.32, 3.96, 0.044, null, 'peak hours; off-peak half price'),
      'deepseek-flash': P(0.3, 1.2, 0.006, null, 'off-peak half price; also deepseek-v4-flash'),
      'deepseek-v4-flash': P(0.3, 1.2, 0.006, null, 'billed as deepseek-flash'),
    } },
    alibaba: { nome: 'Alibaba Qwen', link: 'prezzi-alibaba', modelli: {
      'qwen3.8-max': P(2, 6, null, null, 'international (Singapore)'),
      'qwen3.7-plus': P(0.4, 1.6, null, null, 'up to 256k; 256k–1M: 1.20 / 4.80'),
      'qwen3.8-flash': P(0.15, 0.47, null, null, 'up to 1M'),
      'qwen3-coder-flash': P(0.3, 1.5, null, null, '0–32k; up to 1.60 / 9.60 for 256k–1M'),
    } },
    moonshot: { nome: 'Moonshot Kimi', link: 'prezzi-moonshot', modelli: {
      'kimi-k3.1-pro': P(2, 10, 0.2, 2, 'cache write 5 min; 1 h: $4'),
      'kimi-k3': P(3, 15, 0.3, 3, 'cache write 5 min; 1 h: $6'),
      'kimi-k2.7-code': P(0.95, 4, 0.19, null, 'K2 series retiring by end of 2026'),
      'kimi-k2.6': P(0.95, 4, 0.16, null, 'K2 series retiring'),
    } },
    zhipu: { nome: 'Z.ai GLM', link: 'prezzi-zhipu', modelli: {
      'glm-5.3': P(1.4, 4.4, 0.26, null, 'also glm-5.2 and glm-5.1'),
      'glm-5': P(1, 3.2, 0.2, null, ''),
      'glm-4.7': P(0.6, 2.2, 0.11, null, ''),
      'glm-4.6': P(0.6, 2.2, 0.11, null, ''),
      'glm-4.5': P(0.6, 2.2, 0.11, null, ''),
      'glm-4.5-air': P(0.2, 1.1, 0.03, null, ''),
    } },
    minimax: { nome: 'MiniMax', link: 'prezzi-minimax', modelli: {
      'MiniMax-M3': P(0.3, 1.2, 0.06, null, 'up to 512k; above: 0.60 / 2.40'),
      'MiniMax-M3.1-Flash': P(0.15, 0.6, 0.015, null, ''),
    } },
    xai: { nome: 'xAI Grok', link: 'prezzi-xai', modelli: {
      'grok-4.7': P(2, 6, 0.5, null, 'from 200k prompt: 4 / 12'),
      'grok-4.3': P(1.25, 2.5, 0.2, null, 'from 200k: 2.50 / 5'),
      'grok-build-0.1': P(1, 2, 0.2, null, 'from 200k: 2 / 4'),
    } },
  },
};

// the only pages the panel can open (in the normal browser, after a click)
const LINK = {
  'prezzi-anthropic': 'https://platform.claude.com/docs/en/about-claude/pricing',
  'prezzi-openai': 'https://developers.openai.com/api/docs/pricing',
  'prezzi-google': 'https://ai.google.dev/gemini-api/docs/pricing',
  'prezzi-deepseek': 'https://api-docs.deepseek.com/quick_start/pricing/',
  'prezzi-alibaba': 'https://www.alibabacloud.com/help/en/model-studio/model-pricing',
  'prezzi-moonshot': 'https://platform.kimi.ai/docs/pricing/chat',
  'prezzi-zhipu': 'https://docs.z.ai/guides/overview/pricing',
  'prezzi-minimax': 'https://platform.minimax.io/docs/guides/pricing',
  'prezzi-xai': 'https://docs.x.ai/docs/models',
  'ricarica-anthropic': 'https://console.anthropic.com/settings/billing',
  'ricarica-openai': 'https://platform.openai.com/settings/organization/billing',
};

module.exports = { LISTINO, LINK };
