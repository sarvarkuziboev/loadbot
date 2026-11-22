// Bir marta ochiladi: https://<sizning-loyiha>.vercel.app/api/setup?key=WEBHOOK_SECRET
// Telegram'ga webhook manzilini va buyruqlar menyusini ro'yxatdan o'tkazadi
const tg = require('../lib/tg');

module.exports = async (req, res) => {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret || req.query.key !== secret) return res.status(401).send('key noto\'g\'ri yoki WEBHOOK_SECRET sozlanmagan');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const url = `https://${host}/api/telegram`;
  const hook = await tg.call('setWebhook', {
    url, secret_token: secret, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true,
  });
  const cmds = await tg.call('setMyCommands', {
    commands: [
      { command: 'hisobot', description: 'Dispetcher hisoboti' },
      { command: 'foiz', description: 'Oylik ulush (1% / 1.7% / 2%)' },
      { command: 'grafik', description: 'Dispetcherlarni taqqoslash' },
      { command: 'yil', description: 'Oyma-oy gross' },
      { command: 'xatolar', description: 'Jadvaldagi xatolar' },
      { command: 'yangila', description: 'Jadvalni qayta o\'qish' },
      { command: 'help', description: 'Yordam' },
    ],
  });
  res.status(200).json({ webhook: url, setWebhook: hook, setMyCommands: cmds });
};
