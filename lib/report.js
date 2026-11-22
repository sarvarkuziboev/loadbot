// Hisob-kitob funksiyalari (Telegram'ga bog'liq emas, shuning uchun sinash oson)
const { MONTHS_UZ, monthFromWord, normLoad, normName, titleCase, isCancelled } = require('./data');
const { barChart } = require('./chart');

const RATES = ['1', '1.7', '2'];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const money = (v, cents = false) => '$' + v.toLocaleString('en-US', {
  minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0,
});
const fmtDate = (d) => (d ? `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}` : '—');
const monthName = (m) => (m ? MONTHS_UZ[m - 1] : '—');

function currentMonth() {
  const m = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'numeric' }).format(new Date());
  return +m;
}

// Dispetcheri bo'sh qator (masalan, layover) shu load'ning dispetcheriga biriktiriladi
function prepare(rows) {
  const byLoad = new Map();
  for (const r of rows) {
    if (!r.load) continue;
    if (!byLoad.has(r.load)) byLoad.set(r.load, []);
    byLoad.get(r.load).push(r);
  }
  for (const r of rows) {
    r.effDisp = r.disp;
    r.inherited = false;
    if (!r.disp && r.load) {
      const owner = (byLoad.get(r.load) || []).find((x) => x.disp);
      if (owner) { r.effDisp = owner.disp; r.inherited = true; }
    }
  }
  return { rows, byLoad };
}

function dispatchers(rows) {
  return [...new Set(rows.map((r) => r.disp).filter(Boolean))].sort();
}

// "/hisobot scott noyabr" kabi argumentlarni ajratish
function parseArgs(tokens, rows) {
  const names = dispatchers(rows);
  let month = null, name = null;
  const rest = [];
  for (const t of tokens) {
    const m = monthFromWord(t);
    if (m && !month && !/^\d{3,}/.test(t)) { month = m; continue; }
    const low = normName(t);
    const hit = low.length >= 2 && names.find((n) => n === low || n.startsWith(low));
    if (hit && !name) { name = hit; continue; }
    rest.push(t);
  }
  return { month, name, rest };
}

function defaultName() {
  return normName(process.env.DEFAULT_DISPATCHER || '');
}

function weekKey(r) {
  if (r.week) return r.week;
  if (!r.date) return '?';
  const d = new Date(Date.UTC(r.date.getUTCFullYear(), r.date.getUTCMonth(), r.date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return String(Math.ceil(((d - y0) / 86400000 + 1) / 7));
}

function selectLoads(rows, name, month) {
  return rows.filter((r) => r.effDisp === name && r.month === month);
}

function summarize(sel) {
  const active = sel.filter((r) => !isCancelled(r));
  const loads = new Set(active.filter((r) => !r.inherited).map((r) => r.load || 'line' + r.line));
  const gross = active.reduce((a, r) => a + r.revenue, 0);
  const miles = active.reduce((a, r) => a + r.totalMiles, 0);
  const loaded = active.reduce((a, r) => a + r.loadedMiles, 0);
  const status = {};
  for (const r of active.filter((x) => !x.inherited)) {
    const k = r.status || "Status yo'q";
    status[k] = (status[k] || 0) + 1;
  }
  return { active, cancelled: sel.filter(isCancelled), count: loads.size, gross, miles, loaded, status };
}

function weeklyItems(active, rate) {
  const w = new Map();
  for (const r of active) w.set(weekKey(r), (w.get(weekKey(r)) || 0) + r.revenue);
  return [...w.entries()]
    .sort((a, b) => (+a[0] || 0) - (+b[0] || 0))
    .map(([k, v]) => ({
      label: k === '?' ? '?' : `${k}-hafta`,
      value: v,
      sub: rate ? money((v * parseFloat(rate)) / 100, true) : undefined,
    }));
}

// ---------- /hisobot ----------
function report(rows, tokens) {
  prepare(rows);
  const a = parseArgs(tokens, rows);
  const name = a.name || defaultName();
  const month = a.month || currentMonth();
  if (!name) return { text: 'Dispetcher ismini yozing, masalan: <code>/hisobot scott noyabr</code>' };
  const sel = selectLoads(rows, name, month);
  const s = summarize(sel);
  const N = titleCase(name);
  if (!sel.length) return { text: `${esc(N)} uchun ${monthName(month)} oyida yuk topilmadi.` };

  const lines = [];
  lines.push(`📊 <b>${esc(N)} — ${monthName(month)}</b>`);
  lines.push(`Yuklar: <b>${s.count}</b>`);
  lines.push(`Gross: <b>${money(s.gross)}</b>`);
  if (s.miles) lines.push(`Masofa: ${Math.round(s.miles).toLocaleString('en-US')} mil · RPM: $${(s.gross / s.miles).toFixed(2)}`);
  lines.push('Status: ' + Object.entries(s.status).map(([k, v]) => `${esc(k)} ${v}`).join(', '));
  lines.push('');
  lines.push('<b>Yuklar ro\'yxati:</b>');
  const sorted = [...s.active].sort((x, y) => (x.date || 0) - (y.date || 0));
  for (const r of sorted) {
    const flags = [];
    if (r.inherited) flags.push(r.note || 'qo\'shimcha');
    if (r.monthFromDate) flags.push('Month bo\'sh');
    if (!r.status) flags.push('status yo\'q');
    lines.push(`${fmtDate(r.date)} · <code>${esc(r.loadRaw)}</code> · ${esc(r.driver)} · <b>${money(r.revenue)}</b>${flags.length ? ' ⚠️ ' + esc(flags.join(', ')) : ''}`);
  }
  if (s.cancelled.length) {
    lines.push('');
    lines.push(`Bekor qilingan (hisobga kirmagan): ${s.cancelled.map((r) => `<code>${esc(r.loadRaw)}</code>`).join(', ')}`);
  }
  const png = barChart(weeklyItems(s.active), {
    title: `${N} — ${monthName(month)}: haftalik gross`,
    subtitle: `${s.count} ta yuk · jami ${money(s.gross)}`,
  });
  return { text: lines.join('\n'), png };
}

// ---------- /foiz ----------
function commissionPrompt(rows, tokens) {
  prepare(rows);
  const a = parseArgs(tokens, rows);
  const name = a.name || defaultName();
  const month = a.month || currentMonth();
  if (!name) return { text: 'Dispetcher ismini yozing, masalan: <code>/foiz scott noyabr</code>' };
  return {
    text: `${esc(titleCase(name))} — ${monthName(month)}. Foizni tanlang:`,
    keyboard: [RATES.map((p) => ({ text: `${p}%`, callback_data: `f|${p}|${month}|${name}`.slice(0, 64) }))],
  };
}

function commission(rows, rate, month, name) {
  prepare(rows);
  const s = summarize(selectLoads(rows, name, month));
  const N = titleCase(name);
  const pct = parseFloat(rate);
  const lines = [
    `💰 <b>${esc(N)} — ${monthName(month)}</b>`,
    `Yuklar: ${s.count}`,
    `Oylik gross: <b>${money(s.gross)}</b>`,
    `Tanlangan foiz: <b>${rate}%</b> → <b>${money((s.gross * pct) / 100, true)}</b>`,
    '',
    'Boshqa foizlarda: ' + RATES.filter((p) => p !== rate).map((p) => `${p}% = ${money((s.gross * parseFloat(p)) / 100, true)}`).join(' · '),
  ];
  const png = barChart(weeklyItems(s.active, rate), {
    title: `${N} — ${monthName(month)}: gross va ${rate}% ulush`,
    subtitle: `Gross ${money(s.gross)} · ${rate}% = ${money((s.gross * pct) / 100, true)} (ustun ostida — haftalik ulush)`,
  });
  return { text: lines.join('\n'), png };
}

// ---------- /grafik: dispetcherlar taqqoslash ----------
function compareDispatchers(rows, tokens) {
  prepare(rows);
  const a = parseArgs(tokens, rows);
  const month = a.month || currentMonth();
  const names = dispatchers(rows);
  const mine = defaultName();
  const items = names.map((n) => {
    const s = summarize(selectLoads(rows, n, month));
    return { label: titleCase(n), value: s.gross, sub: `${s.count} yuk`, highlight: n === mine };
  }).filter((d) => d.value > 0).sort((x, y) => y.value - x.value);
  const none = rows.filter((r) => r.month === month && !r.effDisp && !isCancelled(r));
  const noneSum = none.reduce((x, r) => x + r.revenue, 0);
  if (!items.length) return { text: `${monthName(month)} oyida ma'lumot yo'q.` };
  const total = items.reduce((x, d) => x + d.value, 0);
  const lines = [`📊 <b>${monthName(month)} — dispetcherlar bo'yicha</b>`];
  for (const d of items) lines.push(`${esc(d.label)}: <b>${money(d.value)}</b> (${d.sub}, ${((d.value / total) * 100).toFixed(0)}%)`);
  if (none.length) lines.push(`Dispetcher yozilmagan: ${none.length} ta qator, ${money(noneSum)}`);
  const png = barChart(items, { title: `${monthName(month)}: dispetcherlar grossi`, subtitle: `Jami (dispetcher bilan): ${money(total)}` });
  return { text: lines.join('\n'), png };
}

// ---------- /yil: oyma-oy ----------
function yearly(rows, tokens) {
  prepare(rows);
  const a = parseArgs(tokens, rows);
  const name = a.name || defaultName();
  if (!name) return { text: 'Dispetcher ismini yozing, masalan: <code>/yil scott</code>' };
  const items = [];
  for (let m = 1; m <= 12; m++) {
    const s = summarize(selectLoads(rows, name, m));
    if (s.gross > 0) items.push({ label: MONTHS_UZ[m - 1].slice(0, 3), value: s.gross, sub: `${s.count} yuk`, highlight: m === currentMonth() });
  }
  if (!items.length) return { text: `${esc(titleCase(name))} uchun ma'lumot topilmadi.` };
  const total = items.reduce((x, d) => x + d.value, 0);
  const lines = [`📈 <b>${esc(titleCase(name))} — oylar bo'yicha</b>`];
  for (const d of items) lines.push(`${d.label}: <b>${money(d.value)}</b> (${d.sub})`);
  lines.push(`Jami: <b>${money(total)}</b>`);
  const png = barChart(items, { title: `${titleCase(name)}: oylik gross`, subtitle: `Yil bo'yicha jami ${money(total)}` });
  return { text: lines.join('\n'), png };
}

// ---------- Load qidirish ----------
function findLoad(rows, query) {
  prepare(rows);
  const q = normLoad(query);
  let hits = rows.filter((r) => r.load === q);
  let partial = false;
  if (!hits.length && q.length >= 4) { hits = rows.filter((r) => r.load.includes(q)); partial = true; }
  if (!hits.length) return { text: `🔍 <code>${esc(query)}</code> jadvalda topilmadi.` };
  if (partial && new Set(hits.map((r) => r.load)).size > 5) {
    return { text: `🔍 <code>${esc(query)}</code> bo'yicha ${hits.length} ta mos keldi, aniqroq yozing.` };
  }
  const lines = [];
  if (partial) lines.push(`Aniq mos kelmadi, o'xshashlari:`);
  for (const r of hits) {
    lines.push(`🔍 <b><code>${esc(r.loadRaw)}</code></b>${r.note ? ' — ' + esc(r.note) : ''}`);
    lines.push(`Sana: ${fmtDate(r.date)} · Oy: ${r.monthText ? esc(r.monthText) : '⚠️ bo\'sh'}`);
    lines.push(`Broker: ${esc(r.broker)}`);
    if (r.route) lines.push(`Yo'nalish: ${esc(r.route)}`);
    lines.push(`Haydovchi: ${esc(r.driver)}${r.truck ? ' · ' + esc(r.truck) : ''}`);
    lines.push(`Revenue: <b>${money(r.revenue)}</b> · ${Math.round(r.totalMiles)} mil`);
    lines.push(`Dispetcher: ${r.disp ? esc(titleCase(r.disp)) : (r.inherited ? esc(titleCase(r.effDisp)) + ' (biriktirilgan)' : '⚠️ yozilmagan')}`);
    lines.push(`Status: ${r.status ? esc(r.status) : '⚠️ yo\'q'} · Jadval qatori: ${r.line}`);
    lines.push('');
  }
  const loadsN = new Set(hits.map((r) => r.load)).size;
  if (hits.length > 1 && loadsN === 1) lines.push(`Jami: <b>${money(hits.reduce((a, r) => a + r.revenue, 0))}</b>`);
  return { text: lines.join('\n').trim() };
}

// ---------- Ro'yxatni solishtirish ----------
function compareList(rows, tokens) {
  prepare(rows);
  const a = parseArgs(tokens, rows);
  const name = a.name || defaultName();
  const ids = [...new Set(a.rest.map(normLoad).filter((t) => t.length >= 3 && /\d/.test(t)))];
  if (!name) return { text: 'Ro\'yxat boshida dispetcher ismini yozing, masalan: <code>scott noyabr</code>' };

  const missing = [], found = [];
  for (const id of ids) {
    const hits = rows.filter((r) => r.load === id);
    if (!hits.length) missing.push(id); else found.push({ id, hits });
  }
  const mc = {};
  for (const f of found) for (const r of f.hits) if (r.month) mc[r.month] = (mc[r.month] || 0) + 1;
  const month = a.month || +(Object.entries(mc).sort((x, y) => y[1] - x[1])[0] || [currentMonth()])[0];

  let listTotal = 0;
  const problems = [];
  for (const f of found) {
    for (const r of f.hits) {
      if (isCancelled(r)) { problems.push(`<code>${esc(r.loadRaw)}</code> — bekor qilingan (Cancelled), hisobga kirmaydi`); continue; }
      listTotal += r.revenue;
      const why = [];
      if (!r.effDisp) why.push('dispetcher yozilmagan');
      else if (r.effDisp !== name) why.push(`dispetcher: ${titleCase(r.effDisp)}`);
      if (!r.monthCol) why.push('Month ustuni bo\'sh');
      else if (r.monthCol !== month) why.push(`Month: ${r.monthText}`);
      if (why.length) problems.push(`<code>${esc(r.loadRaw)}</code> ${money(r.revenue)} — ${esc(why.join(', '))}`);
    }
  }
  const ids2 = new Set(ids);
  const s = summarize(selectLoads(rows, name, month));
  const extra = s.active.filter((r) => !ids2.has(r.load));
  const N = titleCase(name);

  const lines = [`🧾 <b>Ro'yxat tekshiruvi — ${esc(N)}, ${monthName(month)}</b>`];
  lines.push(`Ro'yxatda: ${ids.length} ta load · jadvalda topildi: ${found.length}`);
  lines.push(`Ro'yxatdagi yuklar summasi (jadval bo'yicha): <b>${money(listTotal)}</b>`);
  lines.push(`Jadvaldagi rasmiy hisob (${esc(N)}, ${monthName(month)}): <b>${money(s.gross)}</b> — ${s.count} ta yuk`);
  const diff = listTotal - s.gross;
  lines.push(diff === 0 ? '✅ Farq yo\'q' : `Farq: <b>${money(Math.abs(diff))}</b> ${diff > 0 ? '(hisobga tushmagan)' : '(ro\'yxatda yo\'q yuklar bor)'}`);
  if (missing.length) { lines.push(''); lines.push(`❌ <b>Jadvalda yo'q (${missing.length}):</b>`); missing.forEach((m) => lines.push(`<code>${esc(m)}</code>`)); }
  if (problems.length) { lines.push(''); lines.push(`⚠️ <b>Jadvalda to'g'rilash kerak (${problems.length}):</b>`); problems.forEach((p) => lines.push(p)); }
  if (extra.length) { lines.push(''); lines.push(`➕ <b>Jadvalda ${esc(N)} nomida, lekin ro'yxatingizda yo'q (${extra.length}):</b>`); extra.forEach((r) => lines.push(`<code>${esc(r.loadRaw)}</code> ${fmtDate(r.date)} ${money(r.revenue)}`)); }
  lines.push('');
  lines.push('Summani o\'zingiznikidan farq qilsa, load raqamini yuborib tekshiring.');
  return { text: lines.join('\n') };
}

// ---------- /xatolar ----------
function issues(rows, tokens) {
  prepare(rows);
  const a = parseArgs(tokens, rows);
  const month = a.month || null;
  const inMonth = (r) => !month || r.month === month || (r.date && r.date.getUTCMonth() + 1 === month);
  const sel = rows.filter(inMonth);
  const groups = [
    ['Month ustuni bo\'sh', sel.filter((r) => !r.monthCol)],
    ['Dispetcher yozilmagan', sel.filter((r) => !r.effDisp && !isCancelled(r))],
    ['Status yo\'q', sel.filter((r) => !r.status)],
    ['Revenue 0 yoki bo\'sh', sel.filter((r) => !r.revenue && !isCancelled(r))],
  ];
  const lines = [`🛠 <b>Jadvaldagi xatolar${month ? ' — ' + monthName(month) : ''}</b>`];
  let any = false;
  for (const [title, list] of groups) {
    if (!list.length) continue;
    any = true;
    lines.push('');
    lines.push(`<b>${title} (${list.length}):</b>`);
    for (const r of list.slice(0, 25)) {
      lines.push(`${r.line}-qator · <code>${esc(r.loadRaw || '—')}</code> · ${fmtDate(r.date)} · ${money(r.revenue)}${r.disp ? ' · ' + esc(titleCase(r.disp)) : ''}`);
    }
    if (list.length > 25) lines.push(`… yana ${list.length - 25} ta`);
  }
  const spaces = sel.filter((r) => r.disp && r.dispRaw !== r.dispRaw.trim());
  if (spaces.length) {
    any = true;
    lines.push('');
    lines.push(`<b>Dispetcher ismida ortiqcha bo'sh joy:</b> ${spaces.length} ta qator (masalan "Scott "). Bot buni to'g'ri hisoblaydi, lekin Sheets filtrida ism ikki xil ko'rinadi.`);
  }
  if (!any) lines.push('✅ Xato topilmadi');
  return { text: lines.join('\n') };
}

module.exports = { report, commissionPrompt, commission, compareDispatchers, yearly, findLoad, compareList, issues, parseArgs, prepare };
