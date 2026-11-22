// Vercel: Telegram webhook shu manzilga keladi
const tg = require('../lib/tg');
const { loadRows } = require('../lib/data');
const { handleUpdate } = require('../lib/bot');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(200).send('Bot ishlayapti ✅');
  const secret = process.env.WEBHOOK_SECRET;
  if (secret && req.headers['x-telegram-bot-api-secret-token'] !== secret) {
    return res.status(401).send('unauthorized');
  }
  try {
    const update = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    await handleUpdate(update || {}, { tg, loadRows });
  } catch (e) {
    console.error(e);
  }
  res.status(200).send('ok');
};
