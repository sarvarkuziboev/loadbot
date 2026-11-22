// Mahalliy sinov: node test/run.js <csv fayl>
const fs = require('fs');
const path = require('path');
const { parseCsv } = require('../lib/data');
const { handleUpdate } = require('../lib/bot');

process.env.ALLOWED_USERS = '42';
process.env.DEFAULT_DISPATCHER = 'Scott';
const rows = () => parseCsv(fs.readFileSync(process.argv[2], 'utf8'));
const outDir = process.argv[3] || '.';
let n = 0;
const tg = {
  call: async (m, p) => {
    if (m === 'sendMessage' || m === 'editMessageText') console.log(`--- ${m === 'sendMessage' ? 'MSG' : 'EDIT'}\n` + p.text + (p.reply_markup ? '\n[KB] ' + JSON.stringify(p.reply_markup.inline_keyboard || p.reply_markup.keyboard) : ''));
    return { ok: true };
  },
  sendText: async (c, t, e = {}) => tg.call('sendMessage', { text: t, ...e }),
  sendPhoto: async (c, png, cap, extra = {}) => { const f = path.join(outDir, `chart${++n}.png`); fs.writeFileSync(f, png); console.log(`--- PHOTO ${f}` + (cap ? '\n' + cap : '') + (extra.reply_markup ? '\n[KB] ' + JSON.stringify(extra.reply_markup.inline_keyboard) : '')); },
};
const msg = (text, from = 42) => ({ message: { chat: { id: 1 }, from: { id: from }, text } });
const cb = (data) => ({ callback_query: { id: 'x', from: { id: 42 }, data, message: { chat: { id: 1 }, message_id: 5, text: 'x' } } });
(async () => {
  const ctx = { tg, loadRows: async () => rows() };
  const steps = JSON.parse(process.argv[4] || '[]');
  for (const s of steps) { console.log('\n>>> ' + JSON.stringify(s)); await handleUpdate(s.cb ? cb(s.cb) : msg(s.t, s.from), ctx); }
})();
