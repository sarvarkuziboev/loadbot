// Telegram xabarlari: pastki menyu tugmalari + inline tugmalar orqali qadam-baqadam tanlash
const R = require('./report');
const { MONTHS_UZ, titleCase } = require('./data');

const RATES = ['1', '1.7', '2'];

// Pastki doimiy menyu
const BTN = {
  report: '📊 Hisobot',
  foiz: '💰 Foiz',
  chart: '👥 Dispetcherlar',
  year: '📅 Yillik',
  search: '🔍 Load qidirish',
  list: '🧾 Ro\'yxat tekshirish',
  issues: '🛠 Xatolar',
  refresh: '🔄 Yangilash',
};
const MAIN_MENU = {
  keyboard: [
    [{ text: BTN.report }, { text: BTN.foiz }],
    [{ text: BTN.chart }, { text: BTN.year }],
    [{ text: BTN.search }, { text: BTN.list }],
    [{ text: BTN.issues }, { text: BTN.refresh }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

// Har bir amal uchun nima kerak: n = dispetcher, m = oy, r = foiz
const ACTIONS = {
  h: { title: '📊 Hisobot', need: ['n', 'm'] },
  f: { title: '💰 Foiz', need: ['n', 'm', 'r'] },
  g: { title: '👥 Dispetcherlar', need: ['m'] },
  y: { title: '📅 Yillik', need: ['n'] },
  x: { title: '🛠 Xatolar', need: ['m'] },
};

const HELP = [
  '<b>Gross Board bot</b>',
  '',
  'Pastdagi tugmalardan foydalaning:',
  `${BTN.report} — dispetcher hisoboti va haftalik grafik`,
  `${BTN.foiz} — 1% / 1.7% / 2% bo'yicha oylik ulush`,
  `${BTN.chart} — dispetcherlarni taqqoslash`,
  `${BTN.year} — oyma-oy gross`,
  `${BTN.search} — load raqami bo'yicha qidirish`,
  `${BTN.list} — load ro'yxatini jadval bilan solishtirish`,
  `${BTN.issues} — jadvaldagi xatolar`,
  '',
  'Qo\'lda faqat load raqamlarini yozasiz.',
].join('\n');

function allowed(userId) {
  const list = String(process.env.ALLOWED_USERS || '').split(/[,\s]+/).filter(Boolean);
  return list.includes(String(userId));
}

// callback_data: "a|<amal>|<ism>|<oy>|<foiz>" ("-" = hali tanlanmagan)
const cbData = (act, n, m, r) => `a|${act}|${n || '-'}|${m || '-'}|${r || '-'}`.slice(0, 64);

function rows3(buttons, per = 3) {
  const out = [];
  for (let i = 0; i < buttons.length; i += per) out.push(buttons.slice(i, i + per));
  return out;
}

// Keyingi kerakli tanlov uchun tugmalar; hammasi tanlangan bo'lsa null
function nextStep(rows, act, n, m, r) {
  const A = ACTIONS[act];
  const picked = [n && titleCase(n), m && (m === 'all' ? 'Butun yil' : MONTHS_UZ[m - 1]), r && r + '%'].filter(Boolean);
  const head = `<b>${A.title}</b>${picked.length ? ' · ' + picked.join(' · ') : ''}`;
  if (A.need.includes('n') && !n) {
    const names = R.dispatchers(rows);
    const kb = rows3(names.map((x) => ({ text: titleCase(x), callback_data: cbData(act, x, m, r) })));
    return { text: `${head}\n\nDispetcherni tanlang:`, keyboard: kb };
  }
  if (A.need.includes('m') && !m) {
    const months = R.monthsWithData(rows, A.need.includes('n') ? n : null);
    const kb = rows3(months.map((x) => ({ text: MONTHS_UZ[x - 1], callback_data: cbData(act, n, x, r) })));
    if (act === 'x') kb.push([{ text: 'Butun yil', callback_data: cbData(act, n, 'all', r) }]);
    if (A.need.includes('n')) kb.push([{ text: '⬅️ Dispetcherni o\'zgartirish', callback_data: cbData(act, null, null, r) }]);
    return { text: `${head}\n\nOyni tanlang:`, keyboard: kb };
  }
  if (A.need.includes('r') && !r) {
    const kb = [RATES.map((x) => ({ text: `${x}%`, callback_data: cbData(act, n, m, x) }))];
    kb.push([{ text: '⬅️ Oyni o\'zgartirish', callback_data: cbData(act, n, null, null) }]);
    return { text: `${head}\n\nFoizni tanlang:`, keyboard: kb };
  }
  return null;
}

// Natija ostidagi tezkor tugmalar
function afterButtons(rows, act, n, m, r) {
  const kb = [];
  const mm = m && m !== 'all' ? +m : null;
  if (mm && act !== 'y') {
    // Faqat ma'lumoti bor qo'shni oylarga o'tish
    const months = R.monthsWithData(rows, ACTIONS[act].need.includes('n') ? n : null);
    const prev = months.filter((x) => x < mm).pop();
    const next = months.find((x) => x > mm);
    const nav = [];
    if (prev) nav.push({ text: `◀️ ${MONTHS_UZ[prev - 1]}`, callback_data: cbData(act, n, prev, r) });
    if (next) nav.push({ text: `${MONTHS_UZ[next - 1]} ▶️`, callback_data: cbData(act, n, next, r) });
    if (nav.length) kb.push(nav);
  }
  if (act === 'f') kb.push(RATES.filter((x) => x !== r).map((x) => ({ text: `${x}% ga o'tish`, callback_data: cbData('f', n, m, x) })));
  if (act === 'h') kb.push([{ text: '💰 Shu oy foizi', callback_data: cbData('f', n, m, null) }, { text: '📅 Yillik', callback_data: cbData('y', n, null, null) }]);
  if (act === 'y') kb.push([{ text: '📊 Oylik hisobot', callback_data: cbData('h', n, null, null) }]);
  if (act === 'g') kb.push([{ text: '📊 Dispetcher hisoboti', callback_data: cbData('h', null, m, null) }]);
  return kb.length ? kb : null;
}

function runAction(rows, act, n, m, r) {
  const opts = { name: n, month: m === 'all' ? null : m };
  if (act === 'h') return R.report(rows, [], opts);
  if (act === 'f') return R.commission(rows, r, +m, n);
  if (act === 'g') return R.compareDispatchers(rows, [], opts);
  if (act === 'y') return R.yearly(rows, [], opts);
  if (act === 'x') return R.issues(rows, [], opts);
  return { text: 'Noma\'lum amal' };
}

async function respond(tg, chatId, out) {
  const markup = out.keyboard ? { reply_markup: { inline_keyboard: out.keyboard } } : {};
  if (out.png) {
    // Rasm izohi 1024 belgigacha; uzun matn alohida yuboriladi
    if (out.text && out.text.length <= 1000) return tg.sendPhoto(chatId, out.png, out.text, markup);
    await tg.sendPhoto(chatId, out.png);
  }
  if (out.text) await tg.sendText(chatId, out.text, markup);
}

async function handleCallback(cq, { tg, loadRows }) {
  const chatId = cq.message && cq.message.chat.id;
  const msgId = cq.message && cq.message.message_id;
  await tg.call('answerCallbackQuery', { callback_query_id: cq.id });
  if (!allowed(cq.from.id) || !chatId) return;

  let [kind, act, n, m, r] = String(cq.data || '').split('|');
  if (kind === 'f') { // eski formatdagi tugmalar: f|foiz|oy|ism
    [act, r, m, n] = ['f', act, n, m];
  } else if (kind !== 'a' || !ACTIONS[act]) return;
  n = n && n !== '-' ? n : null;
  m = m && m !== '-' ? (m === 'all' ? 'all' : +m) : null;
  r = r && r !== '-' ? r : null;

  const rows = await loadRows();
  const step = nextStep(rows, act, n, m, r);
  if (step) {
    // Tanlov xabarini joyida yangilaymiz; bo'lmasa yangi xabar
    const res = msgId && cq.message.text
      ? await tg.call('editMessageText', { chat_id: chatId, message_id: msgId, text: step.text, parse_mode: 'HTML', reply_markup: { inline_keyboard: step.keyboard } })
      : { ok: false };
    if (!res.ok) await tg.sendText(chatId, step.text, { reply_markup: { inline_keyboard: step.keyboard } });
    return;
  }
  // Hammasi tanlangan: tanlov xabarini yopib, natijani yuboramiz
  if (msgId && cq.message.text) {
    await tg.call('editMessageReplyMarkup', { chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: [] } });
  }
  await tg.call('sendChatAction', { chat_id: chatId, action: 'upload_photo' });
  const out = runAction(rows, act, n, m, r);
  const after = afterButtons(rows, act, n, m, r);
  if (after) out.keyboard = after;
  await respond(tg, chatId, out);
}

async function startAction(tg, chatId, loadRows, act) {
  const rows = await loadRows();
  const step = nextStep(rows, act, null, null, null);
  if (step) return tg.sendText(chatId, step.text, { reply_markup: { inline_keyboard: step.keyboard } });
  return respond(tg, chatId, runAction(rows, act));
}

async function handleUpdate(update, { tg, loadRows }) {
  if (update.callback_query) {
    try { return await handleCallback(update.callback_query, { tg, loadRows }); } catch (e) {
      console.error(e);
      const chatId = update.callback_query.message && update.callback_query.message.chat.id;
      if (chatId) return tg.sendText(chatId, '⚠️ Xato: ' + String(e.message || e).replace(/</g, '&lt;'));
      return;
    }
  }

  const msg = update.message || update.edited_message;
  if (!msg || !msg.text) return;
  const chatId = msg.chat.id;
  if (!allowed(msg.from.id)) {
    await tg.sendText(chatId, `⛔ Ruxsat yo'q.\nSizning Telegram ID: <code>${msg.from.id}</code>\nUni Vercel'dagi ALLOWED_USERS sozlamasiga qo'shing.`);
    return;
  }

  const text = msg.text.trim();
  const [first, ...args] = text.split(/\s+/);
  const cmd = first.startsWith('/') ? first.slice(1).split('@')[0].toLowerCase() : null;
  const menu = { reply_markup: MAIN_MENU };

  try {
    if (cmd === 'start' || cmd === 'help' || cmd === 'yordam' || cmd === 'menu') return tg.sendText(chatId, HELP, menu);

    // Pastki menyu tugmalari
    if (text === BTN.report) return startAction(tg, chatId, loadRows, 'h');
    if (text === BTN.foiz) return startAction(tg, chatId, loadRows, 'f');
    if (text === BTN.chart) return startAction(tg, chatId, loadRows, 'g');
    if (text === BTN.year) return startAction(tg, chatId, loadRows, 'y');
    if (text === BTN.issues) return startAction(tg, chatId, loadRows, 'x');
    if (text === BTN.search) return tg.sendText(chatId, '🔍 Load raqamini yozing (masalan <code>1955571</code>).');
    if (text === BTN.list) return tg.sendText(chatId, '🧾 Load raqamlarini yuboring — har birini yangi qatorda.\nDispetcher va oyni bot o\'zi aniqlaydi.');
    if (text === BTN.refresh || cmd === 'yangila') {
      await loadRows({ force: true });
      return tg.sendText(chatId, '✅ Jadval qaytadan o\'qildi.', menu);
    }

    await tg.call('sendChatAction', { chat_id: chatId, action: 'typing' });
    const rows = await loadRows();

    // Eski / buyruqlar ham ishlayveradi
    if (cmd === 'hisobot') return respond(tg, chatId, R.report(rows, args));
    if (cmd === 'foiz') return respond(tg, chatId, R.commissionPrompt(rows, args));
    if (cmd === 'grafik') return respond(tg, chatId, R.compareDispatchers(rows, args));
    if (cmd === 'yil') return respond(tg, chatId, R.yearly(rows, args));
    if (cmd === 'xatolar') return respond(tg, chatId, R.issues(rows, args));
    if (cmd) return tg.sendText(chatId, 'Pastdagi tugmalardan foydalaning.', menu);

    // Oddiy matn: load raqami(lari)
    const tokens = text.split(/[\s,;]+/).filter(Boolean);
    const loadLike = tokens.filter((t) => /\d/.test(t) && t.replace(/[#\-]/g, '').length >= 3);
    if (loadLike.length >= 2) return respond(tg, chatId, R.compareList(rows, tokens));
    if (loadLike.length === 1) return respond(tg, chatId, R.findLoad(rows, loadLike[0]));
    return tg.sendText(chatId, HELP, menu);
  } catch (e) {
    console.error(e);
    return tg.sendText(chatId, '⚠️ Xato: ' + String(e.message || e).replace(/</g, '&lt;'));
  }
}

module.exports = { handleUpdate, HELP };
