// Google Sheets'dan ma'lumot o'qish va qatorlarni tartibga keltirish
const Papa = require('papaparse');

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
const MONTHS_UZ = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul',
  'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
const MONTH_ALIASES = {
  yanvar: 1, january: 1, jan: 1, январь: 1,
  fevral: 2, february: 2, feb: 2, февраль: 2,
  mart: 3, march: 3, mar: 3, март: 3,
  aprel: 4, april: 4, apr: 4, апрель: 4,
  may: 5, май: 5,
  iyun: 6, june: 6, jun: 6, июнь: 6,
  iyul: 7, july: 7, jul: 7, июль: 7,
  avgust: 8, august: 8, aug: 8, август: 8,
  sentabr: 9, sentyabr: 9, september: 9, sep: 9, sept: 9, сентябрь: 9,
  oktabr: 10, oktyabr: 10, october: 10, oct: 10, октябрь: 10,
  noyabr: 11, november: 11, nov: 11, ноябрь: 11,
  dekabr: 12, december: 12, dec: 12, декабрь: 12,
};

function monthFromWord(w) {
  if (!w) return null;
  const s = String(w).trim().toLowerCase().replace(/[^a-zа-яё0-9]/gi, '');
  if (MONTH_ALIASES[s]) return MONTH_ALIASES[s];
  if (/^\d{1,2}$/.test(s) && +s >= 1 && +s <= 12) return +s;
  return null;
}

function num(v) {
  if (v === null || v === undefined) return 0;
  const s = String(v).replace(/[$,\s]/g, '');
  if (s === '' || s === '-') return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

// Sana: "11/13/2026", "2026-11-13", "13.11.2026", Sheets seriya raqami
function parseDate(v) {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const s = String(v).trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) {
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    return new Date(Date.UTC(y, +m[1] - 1, +m[2])); // AQSh formati: oy/kun/yil
  }
  if ((m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/))) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  if (/^\d{5}(\.\d+)?$/.test(s)) return new Date(Date.UTC(1899, 11, 30) + parseFloat(s) * 86400000);
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function normLoad(v) {
  return String(v || '').replace(/[#\s]/g, '').toUpperCase();
}

function normName(v) {
  return String(v || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function titleCase(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Ustun nomini topish (katta-kichik harf va bo'sh joyga qaramay)
function pick(row, ...names) {
  for (const key of Object.keys(row)) {
    const k = key.trim().toLowerCase();
    if (names.includes(k)) return row[key];
  }
  return undefined;
}

function normalizeRows(raw) {
  const rows = [];
  raw.forEach((r, i) => {
    const loadRaw = pick(r, 'load id', 'load #', 'load');
    const date = parseDate(pick(r, 'date'));
    const monthText = String(pick(r, 'month') || '').trim();
    const monthCol = monthFromWord(monthText);
    const dispRaw = pick(r, 'dispatcher');
    const revenue = num(pick(r, 'revenue'));
    if (!loadRaw && !revenue && !date) return; // bo'sh qator
    rows.push({
      line: i + 2, // jadvaldagi qator raqami (1-qator sarlavha)
      status: String(pick(r, 'status') || '').trim(),
      date,
      broker: String(pick(r, 'broker') || '').trim(),
      loadRaw: String(loadRaw || '').trim(),
      load: normLoad(loadRaw),
      route: String(pick(r, 'facility sequence') || '').trim(),
      driver: String(pick(r, 'driver name') || '').trim(),
      truck: String(pick(r, 'truck #') || '').trim(),
      loadedMiles: num(pick(r, 'loaded miles')),
      revenue,
      totalMiles: num(pick(r, 'total distance')),
      week: String(pick(r, 'week') || '').trim(),
      note: String(pick(r, 'note') || '').trim(),
      dispRaw: dispRaw === undefined || dispRaw === null ? '' : String(dispRaw),
      disp: normName(dispRaw),
      monthText,
      monthCol,
      // Month ustuni asosiy; bo'sh bo'lsa sanadan olinadi
      month: monthCol || (date ? date.getUTCMonth() + 1 : null),
      monthFromDate: !monthCol && !!date,
    });
  });
  return rows;
}

let cache = { at: 0, rows: null };

async function loadRows({ force = false } = {}) {
  const ttl = 60 * 1000; // 1 daqiqa kesh
  if (!force && cache.rows && Date.now() - cache.at < ttl) return cache.rows;
  const id = process.env.SHEET_ID;
  const gid = process.env.SHEET_GID || '0';
  if (!id) throw new Error('SHEET_ID sozlanmagan');
  const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { redirect: 'follow' });
  const text = await res.text();
  if (!res.ok || /^\s*<!DOCTYPE html/i.test(text)) {
    throw new Error("Google Sheets'ni o'qib bo'lmadi. Jadval \"Havolasi bor har kim ko'ra oladi\" qilib ulashilganini tekshiring.");
  }
  const rows = parseCsv(text);
  cache = { at: Date.now(), rows };
  return rows;
}

function parseCsv(text) {
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  return normalizeRows(parsed.data);
}

const isCancelled = (r) => /cancel/i.test(r.status);

module.exports = {
  MONTHS_EN, MONTHS_UZ, monthFromWord, normLoad, normName, titleCase,
  loadRows, parseCsv, isCancelled, num,
};
