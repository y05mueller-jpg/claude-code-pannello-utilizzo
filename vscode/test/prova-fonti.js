// Automatic test of the readers of the other tools, with INVENTED files in their official formats: node test/prova-fonti.js
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto'), assert = require('assert');
const { leggiGemini } = require('../src/gemini');
const { leggiQwen } = require('../src/qwen');
const { leggiKimi } = require('../src/kimi');
const { leggiOpencode, leggiKilo, leggiZcode, leggiMinimax } = require('../src/sqlite');
const { leggiCline, leggiRoo } = require('../src/editori');
const { leggiContinue, leggiAider } = require('../src/altri');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pannello-fonti-'));
const scrivi = (p, x) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, typeof x === 'string' ? x : Array.isArray(x) ? x.map(r => JSON.stringify(r)).join('\n') + '\n' : JSON.stringify(x)); };
let prove = 0;
const ok = (a, b, nome) => { assert.deepStrictEqual(a, b, nome); prove++; };
const SEGRETO = 'TESTO-SEGRETO-DEL-MESSAGGIO';
const tutti = [];
const T = h => `2026-10-20T${String(h).padStart(2, '0')}:00:00.000Z`;

// ---------- Gemini CLI ----------
{
  const r = path.join(tmp, 'gemini');
  scrivi(path.join(r, 'tmp', 'mio-progetto', '.project_root'), 'C:\\lavoro\\Mio Progetto');
  const f = path.join(r, 'tmp', 'mio-progetto', 'chats', 'session-2026-10-20T10-00-abcd1234.jsonl');
  scrivi(f, [
    { sessionId: 'g1', projectHash: 'x', startTime: T(10), lastUpdated: T(10) },
    { id: 'u1', timestamp: T(10), type: 'user', content: [{ text: SEGRETO }] },
    { id: 'm1', timestamp: T(10), type: 'gemini', content: SEGRETO, model: 'gemini-2.5-pro' },
    { id: 'm1', timestamp: T(10), type: 'gemini', content: SEGRETO, model: 'gemini-2.5-pro', tokens: { input: 1000, output: 100, cached: 600, thoughts: 50, tool: 10, total: 1160 } },
    { $set: { lastUpdated: T(10) } },
    { id: 'u2', timestamp: T(11), type: 'user', content: 'altro' },
    { id: 'm2', timestamp: T(11), type: 'gemini', content: 'x', tokens: { input: 5, output: 5, cached: 0, total: 10 } },
    { $rewindTo: 'u2' },
  ]);
  // older single-JSON format
  scrivi(path.join(r, 'tmp', 'vecchio', 'chats', 'session-2026-10-01T09-00-old.json'), { sessionId: 'g0', messages: [{ id: 'a', timestamp: '2026-10-01T09:00:00Z', type: 'gemini', tokens: { input: 10, output: 2, cached: 0, total: 12 } }] });
  const x = leggiGemini(r, null), s = x.sessioni.find(q => q.id === 'g1');
  ok([x.sessioni.length, s.progetto, s.modello, s.messaggi, s.richieste], [2, 'Mio Progetto', 'gemini-2.5-pro', 1, 1], 'Gemini: last line wins, rewind drops u2/m2');
  ok(s.u, [400 + 10, 150, 0, 600], 'Gemini: input without cache + tool, output + thoughts, cache read');
  tutti.push(x.sessioni);
}

// ---------- Qwen Code ----------
{
  const r = path.join(tmp, 'qwen');
  const sid = '6c2f0e1a-1111-2222-3333-444455556666';
  scrivi(path.join(r, 'projects', 'c--lavoro-app', 'chats', `${sid}.jsonl`), [
    { uuid: 'a', sessionId: sid, timestamp: T(9), type: 'user', cwd: 'C:\\lavoro\\app', message: { role: 'user', parts: [{ text: SEGRETO }] } },
    { uuid: 'b', sessionId: sid, timestamp: T(9), type: 'assistant', cwd: 'C:\\lavoro\\app', model: 'qwen3-coder-flash', usageMetadata: { promptTokenCount: 15000, candidatesTokenCount: 600, cachedContentTokenCount: 9000, thoughtsTokenCount: 100, totalTokenCount: 15600 } },
    { uuid: 'b', sessionId: sid, timestamp: T(9), type: 'assistant', model: 'qwen3-coder-flash', usageMetadata: { promptTokenCount: 15000, candidatesTokenCount: 600 } },
    { uuid: 'c', sessionId: sid, timestamp: T(9), type: 'system', subtype: 'ui_telemetry', usageMetadata: { promptTokenCount: 15000 } },
  ]);
  scrivi(path.join(r, 'projects', 'x', 'chats', `${sid}.ledger.jsonl`), [{ type: 'assistant', usageMetadata: { promptTokenCount: 1 } }]);
  const x = leggiQwen(r, null), s = x.sessioni[0];
  ok([x.sessioni.length, s.progetto, s.modello, s.messaggi, s.richieste, s.u], [1, 'app', 'qwen3-coder-flash', 1, 1, [6000, 600, 0, 9000]], 'Qwen: one reply, cache split out, telemetry and ledger skipped');
  tutti.push(x.sessioni);
}

// ---------- Kimi CLI ----------
{
  const r = path.join(tmp, 'kimi'), dir = 'C:\\lavoro\\kimi-app', h = crypto.createHash('md5').update(dir, 'utf8').digest('hex');
  scrivi(path.join(r, 'kimi.json'), { work_dirs: [{ path: dir, kaos: 'local', last_session_id: 's1' }] });
  scrivi(path.join(r, 'config.toml'), 'default_model = "kimi-k3"\n');
  scrivi(path.join(r, 'credentials', 'kimi-code.json'), { token: 'NON-DEVE-ESSERE-LETTO' });
  const w = path.join(r, 'sessions', h, 's1');
  scrivi(path.join(w, 'state.json'), { title: 'Titolo Kimi' });
  scrivi(path.join(w, 'context.jsonl'), [{ role: '_system_prompt', content: SEGRETO }, { role: '_usage', token_count: 999999 }]);
  scrivi(path.join(w, 'wire.jsonl'), [
    { type: 'metadata', protocol_version: '1.10' },
    { timestamp: 1760950800, message: { type: 'TurnBegin', payload: { user_input: SEGRETO } } },
    { timestamp: 1760950801, message: { type: 'StatusUpdate', payload: { token_usage: { input_other: 800, output: 200, input_cache_read: 15000, input_cache_creation: 0 } } } },
    { timestamp: 1760950802, message: { type: 'StatusUpdate', payload: { token_usage: null, context_tokens: 16000 } } },
    { timestamp: 1760950803, message: { type: 'SubagentEvent', payload: { agent_id: 'x', event: { type: 'StatusUpdate', payload: { token_usage: { input_other: 50, output: 5 } } } } } },
  ]);
  scrivi(path.join(w, 'subagents', 'x', 'wire.jsonl'), [{ timestamp: 1760950803, message: { type: 'StatusUpdate', payload: { token_usage: { input_other: 50, output: 5, input_cache_read: 0, input_cache_creation: 0 } } } }]);
  const x = leggiKimi(r, null), s = x.sessioni[0];
  ok([x.sessioni.length, s.titolo, s.progetto, s.modello, s.messaggi, s.richieste, s.u], [1, 'Titolo Kimi', 'kimi-app', 'kimi-k3', 1, 2, [850, 205, 0, 15000]], 'Kimi: parent + subagent once, _usage never summed');
  tutti.push(x.sessioni);
}

// ---------- SQLite tools ----------
let sqlite = null;
try { sqlite = require('node:sqlite'); } catch (e) { /* skipped below */ }
if (sqlite) {
  const crea = (file, sql) => { fs.mkdirSync(path.dirname(file), { recursive: true }); const db = new sqlite.DatabaseSync(file); db.exec(sql); db.close(); };
  const t0 = Date.parse(T(8));
  const opencodeSql = `CREATE TABLE session (id TEXT, project_id TEXT, directory TEXT, title TEXT, time_created INTEGER, time_updated INTEGER);
    CREATE TABLE message (id TEXT, session_id TEXT, time_created INTEGER, time_updated INTEGER, data TEXT);
    INSERT INTO session VALUES ('ses1', 'p', '/home/x/oc-app', 'Titolo opencode', ${t0}, ${t0});
    INSERT INTO message VALUES ('m1', 'ses1', ${t0}, ${t0}, '${JSON.stringify({ role: 'user', time: { created: t0 } })}');
    INSERT INTO message VALUES ('m2', 'ses1', ${t0}, ${t0}, '${JSON.stringify({ role: 'assistant', time: { created: t0 }, modelID: 'deepseek-v4-pro', providerID: 'deepseek', tokens: { input: 100, output: 20, reasoning: 5, cache: { read: 300, write: 10 } }, cost: 0.01 })}');`;
  crea(path.join(tmp, 'opencode', 'opencode.db'), opencodeSql);
  let x = leggiOpencode(path.join(tmp, 'opencode'), null), s = x.sessioni[0];
  ok([x.sessioni.length, s.titolo, s.progetto, s.modello, s.messaggi, s.richieste, s.u], [1, 'Titolo opencode', 'oc-app', 'deepseek-v4-pro', 1, 1, [100, 25, 10, 300]], 'opencode database');
  const c1 = x.cache;
  x = leggiOpencode(path.join(tmp, 'opencode'), c1);
  ok(x.cache.impronta, c1.impronta, 'opencode: unchanged database is not read again');
  tutti.push(x.sessioni);
  crea(path.join(tmp, 'kilo', 'kilo.db'), opencodeSql.replace('Titolo opencode', 'Titolo Kilo'));
  x = leggiKilo(path.join(tmp, 'kilo'), null);
  ok([x.sessioni.length, x.sessioni[0].titolo], [1, 'Titolo Kilo'], 'Kilo Code database');

  crea(path.join(tmp, 'zcode', 'cli', 'db', 'db.sqlite'), `CREATE TABLE session (id TEXT, directory TEXT, title TEXT);
    CREATE TABLE model_usage (session_id TEXT, turn_id TEXT, provider_id TEXT, model_id TEXT, status TEXT, started_at INTEGER, completed_at INTEGER,
      input_tokens INTEGER, output_tokens INTEGER, reasoning_tokens INTEGER, cache_creation_input_tokens INTEGER, cache_read_input_tokens INTEGER, error_message TEXT);
    INSERT INTO session VALUES ('z1', '/w/glm-app', 'Titolo ZCode');
    INSERT INTO model_usage VALUES ('z1', 't', 'zai', 'glm-5.3', 'ok', ${t0}, ${t0}, 1000, 100, 10, 0, 500, '${SEGRETO}');`);
  x = leggiZcode(path.join(tmp, 'zcode'), null); s = x.sessioni[0];
  ok([s.titolo, s.progetto, s.modello, s.u], ['Titolo ZCode', 'glm-app', 'glm-5.3', [1000, 110, 0, 500]], 'ZCode (GLM) database');
  tutti.push(x.sessioni);

  crea(path.join(tmp, 'minimax', 'v2', 'sqlite', 'runtime-state.sqlite'), `CREATE TABLE local_runtime_token_usage (session_id TEXT, agent_name TEXT, turn_id TEXT, model TEXT, ts INTEGER,
      input_tokens INTEGER, output_tokens INTEGER, reasoning_tokens INTEGER, cache_read_tokens INTEGER, cache_write_tokens INTEGER, cost_usd REAL, raw TEXT);
    INSERT INTO local_runtime_token_usage VALUES ('mm1', 'a', 't', 'MiniMax-M3', ${t0}, 200, 50, 0, 100, 20, 0.001, '${SEGRETO}');`);
  x = leggiMinimax(path.join(tmp, 'minimax'), null); s = x.sessioni[0];
  ok([x.sessioni.length, s.modello, s.u], [1, 'MiniMax-M3', [200, 50, 20, 100]], 'MiniMax Code database');
  tutti.push(x.sessioni);
}

// ---------- Cline and Roo Code (inside the editor) ----------
{
  const gs = path.join(tmp, 'Code', 'User', 'globalStorage');
  const cl = path.join(gs, 'saoudrizwan.claude-dev');
  scrivi(path.join(cl, 'state', 'taskHistory.json'), JSON.stringify([{ id: 'c1', ts: 1, task: SEGRETO, cwdOnTaskInitialization: 'C:\\lavoro\\cline-app', tokensIn: 1, tokensOut: 1 }]));
  scrivi(path.join(cl, 'tasks', 'c1', 'ui_messages.json'), JSON.stringify([
    { ts: Date.parse(T(7)), type: 'say', say: 'task', text: SEGRETO },
    { ts: Date.parse(T(7)), type: 'say', say: 'api_req_started', text: JSON.stringify({ request: SEGRETO, tokensIn: 1500, tokensOut: 300, cacheWrites: 20, cacheReads: 12000, cost: 0.01 }), modelInfo: { providerId: 'anthropic', modelId: 'claude-sonnet-5-5', mode: 'act' } },
  ]));
  const sdk = path.join(tmp, 'cline-data');
  scrivi(path.join(sdk, 'sessions', 'k1', 'k1.json'), { cwd: '/w/cli-app' });
  scrivi(path.join(sdk, 'sessions', 'k1', 'k1.messages.json'), { version: 1, sessionId: 'k1', messages: [
    { role: 'user', content: SEGRETO, ts: Date.parse(T(6)) },
    { role: 'assistant', content: SEGRETO, ts: Date.parse(T(6)), modelInfo: { id: 'glm-4.6', provider: 'zai' }, metrics: { inputTokens: 100, outputTokens: 10, cacheReadTokens: 50, cacheWriteTokens: 0, cost: 0 } },
  ] });
  let x = leggiCline(sdk, null, { archivi: [gs] });
  const a = x.sessioni.find(q => q.id === 'c1'), b = x.sessioni.find(q => q.id === 'k1');
  ok([a.progetto, a.modello, a.messaggi, a.u], ['cline-app', 'claude-sonnet-5-5', 1, [1500, 300, 20, 12000]], 'Cline extension: tokensIn without cache');
  ok([b.progetto, b.modello, b.u], ['cli-app', 'glm-4.6', [100, 10, 0, 50]], 'Cline CLI / SDK');
  tutti.push(x.sessioni);

  const roo = path.join(gs, 'rooveterinaryinc.roo-cline');
  scrivi(path.join(roo, 'tasks', 'r1', 'history_item.json'), { id: 'r1', task: SEGRETO, workspace: '/w/roo-app' });
  scrivi(path.join(roo, 'tasks', 'r1', 'ui_messages.json'), JSON.stringify([{ ts: Date.parse(T(5)), type: 'say', say: 'api_req_started', text: JSON.stringify({ tokensIn: 13520, tokensOut: 300, cacheWrites: 20, cacheReads: 12000 }) }]));
  x = leggiRoo('', null, { archivi: [gs] });
  ok([x.sessioni[0].progetto, x.sessioni[0].u], ['roo-app', [1500, 300, 20, 12000]], 'Roo Code: tokensIn includes the cache');
  tutti.push(x.sessioni);
}

// ---------- Continue and Aider ----------
{
  const r = path.join(tmp, 'continue');
  scrivi(path.join(r, 'dev_data', '0.2.0', 'tokensGenerated.jsonl'), [
    { eventName: 'tokensGenerated', schema: '0.2.0', timestamp: T(4), model: 'qwen3-coder-flash', provider: 'alibaba', promptTokens: 4210, generatedTokens: 388 },
    { eventName: 'tokensGenerated', schema: '0.2.0', timestamp: T(5), model: 'qwen3-coder-flash', provider: 'alibaba', promptTokens: 10, generatedTokens: 2 },
  ]);
  scrivi(path.join(r, 'dev_data', '0.2.0', 'chatInteraction.jsonl'), [{ prompt: SEGRETO }]);
  let x = leggiContinue(r, null);
  ok([x.sessioni.length, x.sessioni[0].richieste, x.sessioni[0].u], [1, 2, [4220, 390, 0, 0]], 'Continue');
  tutti.push(x.sessioni);

  const p = path.join(tmp, 'aider-app');
  scrivi(path.join(p, '.aider.chat.history.md'), [
    '', '# aider chat started at 2026-10-20 09:12:03', '', '> Aider v0.86.0  ', '> Main model: deepseek/deepseek-v4-pro with diff edit format  ', '',
    `#### ${SEGRETO}`, '', '> Tokens: 12k sent, 2.3k cache write, 8.1k cache hit, 512 received.', 'Cost: $0.04 message, $0.12 session.  ',
    '> Tokens: 1235k sent, 120 received. Cost: $0.01 message, $0.13 session.  ', '',
  ].join('\n'));
  x = leggiAider('', null, { progetti: [p] });
  const s = x.sessioni[0];
  ok([x.sessioni.length, s.progetto, s.modello, s.messaggi, s.richieste, s.u], [1, 'aider-app', 'deepseek/deepseek-v4-pro', 1, 2, [9700 + 1235000, 632, 2300, 8100]], 'Aider history');
  tutti.push(x.sessioni);
}

ok(JSON.stringify(tutti).includes(SEGRETO), false, 'no message text in any output');
ok(JSON.stringify(tutti).includes('NON-DEVE-ESSERE-LETTO'), false, 'Kimi credentials not read');
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`OK: ${prove} checks passed${sqlite ? '' : ' (SQLite tools skipped: node:sqlite not available)'}`);
