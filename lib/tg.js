// Telegram Bot API bilan ishlash
function api() {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error('BOT_TOKEN sozlanmagan');
  return `https://api.telegram.org/bot${token}`;
}

async function call(method, params = {}) {
  const res = await fetch(`${api()}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) console.error('Telegram xatosi', method, data);
  return data;
}

async function sendPhoto(chatId, png, caption, extra = {}) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  if (caption) {
    form.append('caption', caption);
    form.append('parse_mode', 'HTML');
  }
  for (const [k, v] of Object.entries(extra)) form.append(k, typeof v === 'string' ? v : JSON.stringify(v));
  form.append('photo', new Blob([png], { type: 'image/png' }), 'chart.png');
  const res = await fetch(`${api()}/sendPhoto`, { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) console.error('Telegram xatosi sendPhoto', data);
  return data;
}

// Uzun matnni 4000 belgidan bo'lib yuboradi
async function sendText(chatId, text, extra = {}) {
  const chunks = [];
  let cur = '';
  for (const line of text.split('\n')) {
    if ((cur + '\n' + line).length > 4000) { chunks.push(cur); cur = line; } else cur = cur ? cur + '\n' + line : line;
  }
  if (cur) chunks.push(cur);
  for (let i = 0; i < chunks.length; i++) {
    const last = i === chunks.length - 1;
    await call('sendMessage', {
      chat_id: chatId, text: chunks[i], parse_mode: 'HTML', disable_web_page_preview: true,
      ...(last ? extra : {}),
    });
  }
}

module.exports = { call, sendPhoto, sendText };
