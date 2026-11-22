// Telegram xabarlarini qabul qilib, kerakli hisobotga yo'naltiradi
const R = require('./report');

const HELP = [
  '<b>Gross Board bot</b>',
  '',
  '/hisobot <i>[ism] [oy]</i> — dispetcher hisoboti va haftalik grafik',
  '/foiz <i>[ism] [oy]</i> — 1% / 1.7% / 2% tanlab, oylik ulushni hisoblash',
  '/grafik <i>[oy]</i> — dispetcherlarni taqqoslash',
  '/yil <i>[ism]</i> — oyma-oy gross grafigi',
  '/xatolar <i>[oy]</i> — jadvaldagi xatolar (bo\'sh Month, dispetcher va h.k.)',
  '/yangila — jadvalni qaytadan o\'qish',
  '',
  '🔍 Bitta load raqamini yuborsangiz — o\'sha yukni topadi.',
  '🧾 Bir nechta load raqamini (har biri yangi qatorda) yuborsangiz — jadval bilan solishtiradi. Boshida ism va oyni yozish mumkin: <code>scott noyabr</code>',
  '',
  'Ism yozilmasa — standart dispetcher, oy yozilmasa — joriy oy olinadi.',
  'Misol: <code>/foiz scott noyabr</code>',
].join('\n');

function allowed(userId) {
  const list = String(process.env.ALLOWED_USERS || '').split(/[,\s]+/).filter(Boolean);
  return list.includes(String(userId));
}

async function respond(tg, chatId, out) {
  if (out.png) {
    // Rasm izohi 1024 belgigacha; matn uzun bo'lsa alohida yuboriladi
    if (out.text && out.text.length <= 1000 && !out.keyboard) {
      await tg.sendPhoto(chatId, out.png, out.text);
      return;
    }
    await tg.sendPhoto(chatId, out.png);
  }
  if (out.text) {
    await tg.sendText(chatId, out.text, out.keyboard ? { reply_markup: { inline_keyboard: out.keyboard } } : {});
  }
}

async function handleUpdate(update, { tg, loadRows }) {
  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = cq.message && cq.message.chat.id;
    await tg.call('answerCallbackQuery', { callback_query_id: cq.id });
    if (!allowed(cq.from.id) || !chatId) return;
    const [kind, rate, month, ...nameParts] = String(cq.data || '').split('|');
    if (kind === 'f') {
      await tg.call('sendChatAction', { chat_id: chatId, action: 'upload_photo' });
      const rows = await loadRows();
      await respond(tg, chatId, R.commission(rows, rate, +month, nameParts.join('|')));
    }
    return;
  }

  const msg = update.message || update.edited_message;
  if (!msg || !msg.text) return;
  const chatId = msg.chat.id;
  if (!allowed(msg.from.id)) {
    await tg.sendText(chatId, `⛔ Ruxsat yo'q.\nSizning Telegram ID: <code>${msg.from.id}</code>\nUni Vercel'dagi ALLOWED_USERS sozlamasiga qo'shing.`);
    return;
  }

  const text = msg.text.trim();
  const [first, ...restWords] = text.split(/\s+/);
  const cmd = first.startsWith('/') ? first.slice(1).split('@')[0].toLowerCase() : null;
  const args = restWords;

  try {
    if (cmd === 'start' || cmd === 'help' || cmd === 'yordam') return tg.sendText(chatId, HELP);
    if (cmd === 'yangila') { await loadRows({ force: true }); return tg.sendText(chatId, '✅ Jadval qaytadan o\'qildi.'); }

    await tg.call('sendChatAction', { chat_id: chatId, action: 'typing' });
    const rows = await loadRows();

    if (cmd === 'hisobot') return respond(tg, chatId, R.report(rows, args));
    if (cmd === 'foiz') return respond(tg, chatId, R.commissionPrompt(rows, args));
    if (cmd === 'grafik') return respond(tg, chatId, R.compareDispatchers(rows, args));
    if (cmd === 'yil') return respond(tg, chatId, R.yearly(rows, args));
    if (cmd === 'xatolar') return respond(tg, chatId, R.issues(rows, args));
    if (cmd) return tg.sendText(chatId, 'Bunday buyruq yo\'q. /help ni bosing.');

    // Oddiy matn: load raqami(lari)
    const tokens = text.split(/[\s,;]+/).filter(Boolean);
    const loadLike = tokens.filter((t) => /\d/.test(t) && t.replace(/[#\-]/g, '').length >= 3);
    if (loadLike.length >= 2) return respond(tg, chatId, R.compareList(rows, tokens));
    if (loadLike.length === 1) return respond(tg, chatId, R.findLoad(rows, loadLike[0]));
    return tg.sendText(chatId, HELP);
  } catch (e) {
    console.error(e);
    return tg.sendText(chatId, '⚠️ Xato: ' + String(e.message || e).replace(/</g, '&lt;'));
  }
}

module.exports = { handleUpdate, HELP };
