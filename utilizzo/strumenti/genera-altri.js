// Impacchetta i lettori dell'estensione VS Code (vscode/src) e strumenti/altri.js in un solo testo,
// e lo scrive in hooks/register.tsx come costante ALTRI_JS (il pannello lo fa girare con `node -e`).
// Da rifare ogni volta che cambia vscode/src o altri.js:  node utilizzo/strumenti/genera-altri.js
'use strict';
const fs = require('fs'), path = require('path');
const RADICE = path.join(__dirname, '..', '..');
const SRC = path.join(RADICE, 'vscode', 'src');
const REGISTER = path.join(RADICE, 'utilizzo', 'hooks', 'register.tsx');

const moduli = {};
for (const f of fs.readdirSync(SRC).filter(f => f.endsWith('.js') && f !== 'claude.js')) moduli[f.slice(0, -3)] = fs.readFileSync(path.join(SRC, f), 'utf8');
moduli.__entrata = fs.readFileSync(path.join(__dirname, 'altri.js'), 'utf8');

let js = `// Lettori degli altri strumenti (da vscode/src) e strumenti/altri.js, impacchettati da strumenti/genera-altri.js. Non modificare qui.
'use strict';
const __m = {}, __c = {}, __req = require;
function __r(n) {
  if (!n.startsWith('./')) return __req(n);
  n = n.slice(2).replace(/\\.js$/, '');
  if (__c[n]) return __c[n].exports;
  const module = { exports: {} }; __c[n] = module;
  __m[n](module, module.exports, __r);
  return module.exports;
}
`;
for (const [n, s] of Object.entries(moduli)) js += `__m[${JSON.stringify(n)}] = function (module, exports, require) {\n${s}\n};\n`;
js += `__r('./__entrata');\n`;

const riga = `const ALTRI_JS = ${JSON.stringify(js).replace(/[\u007f-￿]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))}`;
let reg = fs.readFileSync(REGISTER, 'utf8');
const da = reg.indexOf('\nconst ALTRI_JS = ');
if (da < 0) throw new Error('manca la riga «const ALTRI_JS = » in register.tsx');
const a = reg.indexOf('\n', da + 1);
reg = reg.slice(0, da + 1) + riga + reg.slice(a);
fs.writeFileSync(REGISTER, reg);
console.log(`ALTRI_JS: ${Object.keys(moduli).length} moduli, ${js.length} caratteri`);
