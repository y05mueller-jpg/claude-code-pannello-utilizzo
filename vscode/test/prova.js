// Automatic test of the readers with INVENTED files (no real data): node test/prova.js
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), zlib = require('zlib'), assert = require('assert');
const { leggiCodex } = require('../src/codex');
const { leggiClaude } = require('../src/claude');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pannello-utilizzo-'));
const scrivi = (p, righe) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, righe.map(r => JSON.stringify(r)).join('\n') + '\n'); };
let prove = 0;
const ok = (a, b, nome) => { assert.deepStrictEqual(a, b, nome); prove++; };

// ---------- Codex ----------
const codex = path.join(tmp, 'codex');
const idA = '11111111-2222-3333-4444-555555555555', idB = '66666666-7777-8888-9999-000000000000', idC = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const T = (h) => `2026-10-20T${String(h).padStart(2, '0')}:00:00.000Z`;
const uso = (i, c, o) => ({ input_tokens: i, cached_input_tokens: c, output_tokens: o, reasoning_output_tokens: 0, total_tokens: i + o });
// A: newer Codex, one token_usage_record per reply (plus token_count events that must be ignored)
const fileA = path.join(codex, 'sessions', '2026', '10', '20', `rollout-2026-10-20T10-00-00-${idA}.jsonl`);
scrivi(fileA, [
  { timestamp: T(10), type: 'session_meta', payload: { id: idA, session_id: idA, timestamp: T(10), cwd: '/home/x/progetto-a', originator: 'codex_cli_rs', cli_version: '0.0.0' } },
  { timestamp: T(10), type: 'turn_context', payload: { cwd: '/home/x/progetto-a', model: 'gpt-test', approval_policy: 'never' } },
  { timestamp: T(10), type: 'event_msg', payload: { type: 'user_message', message: 'ciao ciao ciao' } },
  { timestamp: T(10), type: 'event_msg', payload: { type: 'user_message', message: '<environment_context>x</environment_context>' } },
  { timestamp: T(10), type: 'token_usage_record', payload: { response_id: 'r1', usage: uso(1000, 400, 50) } },
  { timestamp: T(10), type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: uso(1000, 400, 50), last_token_usage: uso(1000, 400, 50) }, rate_limits: { primary: { used_percent: 12.5, window_minutes: 300, resets_at: 1893456000 } } } },
  { timestamp: T(11), type: 'token_usage_record', payload: { response_id: 'r2', usage: uso(2000, 1500, 100) } },
  { timestamp: T(11), type: 'token_usage_record', payload: { response_id: 'r2', usage: uso(2000, 1500, 100) } },
]);
// B: older Codex, only token_count (with a repeated count) and resets_in_seconds; compressed to .jsonl.zst
const righeB = [
  { timestamp: T(12), type: 'session_meta', payload: { id: idB, timestamp: T(12), cwd: 'C:\\Users\\x\\progetto-b', originator: 'codex_cli_rs', cli_version: '0.0.0' } },
  { timestamp: T(12), type: 'event_msg', payload: { type: 'user_message', message: 'abcdefgh', kind: 'plain' } },
  { timestamp: T(12), type: 'event_msg', payload: { type: 'user_message', message: 'istruzioni', kind: 'user_instructions' } },
  { timestamp: T(12), type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: uso(300, 0, 30), last_token_usage: uso(300, 0, 30) }, rate_limits: { primary: { used_percent: 40, window_minutes: 300, resets_in_seconds: 600 }, secondary: { used_percent: 7, window_minutes: 10080, resets_in_seconds: 6000 } } } },
  { timestamp: T(12), type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: uso(300, 0, 30), last_token_usage: uso(300, 0, 30) } } },
  { timestamp: T(12), type: 'event_msg', payload: { type: 'token_count', info: null } },
  { timestamp: T(13), type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: uso(800, 100, 50), last_token_usage: uso(500, 100, 20) } } },
];
const fileB = path.join(codex, 'sessions', '2026', '10', '20', `rollout-2026-10-20T12-00-00-${idB}.jsonl.zst`);
const zstd = typeof zlib.zstdCompressSync === 'function';
fs.mkdirSync(path.dirname(fileB), { recursive: true });
if (zstd) fs.writeFileSync(fileB, zlib.zstdCompressSync(Buffer.from(righeB.map(r => JSON.stringify(r)).join('\n') + '\n')));
else scrivi(fileB.replace(/\.zst$/, ''), righeB);
// C: a fork that copies reply r1 of A (must not be counted twice), in archived_sessions
scrivi(path.join(codex, 'archived_sessions', `rollout-2026-10-21T09-00-00-${idC}.jsonl`), [
  { timestamp: '2026-10-21T09:00:00.000Z', type: 'session_meta', payload: { id: idC, forked_from_id: idA, timestamp: '2026-10-21T09:00:00.000Z', cwd: '/home/x/progetto-a' } },
  { timestamp: '2026-10-21T09:00:00.000Z', type: 'token_usage_record', payload: { response_id: 'r1', usage: uso(1000, 400, 50) } },
  { timestamp: '2026-10-21T09:05:00.000Z', type: 'token_usage_record', payload: { response_id: 'r3', usage: uso(10, 0, 5) } },
]);
fs.writeFileSync(path.join(codex, 'session_index.jsonl'), JSON.stringify({ id: idA, thread_name: 'Nome inventato', updated_at: T(11) }) + '\n');

let r = leggiCodex(codex, null);
const per = id => r.sessioni.find(s => s.id === id);
const a = per(idA), b = per(idB), c = per(idC);
ok(r.sessioni.length, 3, 'three Codex sessions');
ok([a.titolo, a.progetto, a.modello, a.fonte], ['Nome inventato', 'progetto-a', 'gpt-test', 'codex'], 'A metadata');
ok([a.messaggi, a.richieste, a.token], [1, 2, 3150], 'A counts (records, duplicate r2 ignored)');
ok(a.u, [600 + 500, 150, 0, 400 + 1500], 'A: input without cache, output, cache read');
ok(a.scritti, Math.ceil('ciao ciao ciao'.length / 4), 'A written estimate');
ok([b.messaggi, b.richieste, b.token, b.u], [1, 2, 850, [700, 50, 0, 100]], 'B counts (token_count, repeated count ignored)');
ok(b.progetto, 'progetto-b', 'B project from a Windows path');
ok([c.richieste, c.token], [1, 15], 'C: copied reply r1 not counted twice');
const g = Object.keys(a.giorni);
ok(g.length, 1, 'A one day');
ok(a.giorni[g[0]][2], 2, 'A day requests');
// limits: the most recent snapshot that has them (B at 12:00 is newer than A at 10:00)
ok(r.limiti.map(l => [l.minuti, l.percento]), [[300, 40], [10080, 7]], 'latest Codex limits');
ok(r.limiti[0].azzera, Date.parse(T(12)) + 600000, 'reset time from resets_in_seconds');

// incremental: a new line is added to A, only that one is read
fs.appendFileSync(fileA, JSON.stringify({ timestamp: T(14), type: 'token_usage_record', payload: { response_id: 'r4', usage: uso(100, 0, 10) } }) + '\n');
r = leggiCodex(codex, r.cache);
ok([per(idA).richieste, per(idA).token, per(idC).richieste], [3, 3260, 1], 'incremental read');
// half-written line is not read until it is complete
fs.appendFileSync(fileA, '{"timestamp":"2026-10-20T15:00:00Z","type":"token_usage_record","payl');
r = leggiCodex(codex, r.cache);
ok(per(idA).richieste, 3, 'incomplete line waits');
fs.appendFileSync(fileA, 'oad":{"response_id":"r5","usage":{"input_tokens":1,"cached_input_tokens":0,"output_tokens":1}}}\n');
r = leggiCodex(codex, r.cache);
ok(per(idA).richieste, 4, 'completed line counted');

// ---------- Claude ----------
const claude = path.join(tmp, 'claude', 'projects', 'C--Users-x-Documents-mio-progetto');
const sid = 'cccccccc-0000-0000-0000-000000000001';
scrivi(path.join(claude, `${sid}.jsonl`), [
  { type: 'custom-title', customTitle: 'Titolo inventato', sessionId: sid },
  { type: 'user', sessionId: sid, timestamp: T(9), message: { role: 'user', content: 'scrivi una cosa' } },
  { type: 'user', sessionId: sid, timestamp: T(9), message: { role: 'user', content: '<command-name>/x</command-name>' } },
  { type: 'user', sessionId: sid, timestamp: T(9), message: { role: 'user', content: [{ type: 'tool_result', content: 'x' }] } },
  { type: 'assistant', sessionId: sid, timestamp: T(9), requestId: 'q1', message: { id: 'm1', model: 'claude-test', usage: { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 30, cache_read_input_tokens: 40 } } },
  { type: 'assistant', sessionId: sid, timestamp: T(9), requestId: 'q1', message: { id: 'm1', model: 'claude-test', usage: { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 30, cache_read_input_tokens: 40 } } },
]);
const rc = leggiClaude(path.join(tmp, 'claude', 'projects'), null);
const s = rc.sessioni[0];
ok([rc.sessioni.length, s.titolo, s.progetto, s.messaggi, s.richieste, s.token, s.u, s.modello], [1, 'Titolo inventato', 'mio progetto', 1, 1, 100, [10, 20, 30, 40], 'claude-test'], 'Claude counts');

// nothing from the message text is in the output, only numbers and titles
const testo = JSON.stringify([r.sessioni, rc.sessioni]);
for (const parola of ['ciao ciao', 'abcdefgh', 'scrivi una cosa', 'environment_context', 'istruzioni']) ok(testo.includes(parola), false, `no text: ${parola}`);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`OK: ${prove} checks passed${zstd ? ' (including a .jsonl.zst file)' : ' (zstd not available in this Node: .zst test done on a plain file)'}`);
