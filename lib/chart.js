// Oddiy bar chart: SVG chizib, PNG rasmga aylantiradi (tashqi servis kerak emas)
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const FONT_DIR = path.join(__dirname, '..', 'fonts');
const FONTS = [path.join(FONT_DIR, 'DejaVuSans.ttf'), path.join(FONT_DIR, 'DejaVuSans-Bold.ttf')];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function shortMoney(v) {
  const a = Math.abs(v);
  if (a >= 1e6) return '$' + (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (a >= 1e5) return '$' + (v / 1e3).toFixed(0) + 'k';
  if (a >= 1e3) return '$' + (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return '$' + Math.round(v);
}

// 4 ta chiziq uchun "chiroyli" qadam: 1, 2, 2.5, 5 × 10^n
function niceMax(v) {
  if (v <= 0) return 4;
  const raw = (v * 1.08) / 4;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p * 4;
  return 40 * p;
}

/**
 * items: [{ label, value, sub?, highlight? }]
 * opts: { title, subtitle, valueFmt }
 */
function barChart(items, { title = '', subtitle = '', valueFmt = shortMoney } = {}) {
  const W = 1000, H = 600;
  const m = { top: subtitle ? 110 : 85, right: 30, bottom: 90, left: 80 };
  const cw = W - m.left - m.right, ch = H - m.top - m.bottom;
  const max = niceMax(Math.max(0, ...items.map((d) => d.value)));
  const n = Math.max(items.length, 1);
  const slot = cw / n;
  const bw = Math.min(90, slot * 0.62);
  const base = '#2f6fdb', hi = '#f08c2e', grid = '#e6e8ec', ink = '#1f2430', muted = '#6b7280';

  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  s += `<rect width="100%" height="100%" fill="#ffffff"/>`;
  s += `<style>text{font-family:'DejaVu Sans'}</style>`;
  s += `<text x="${m.left}" y="48" font-size="26" font-weight="bold" fill="${ink}">${esc(title)}</text>`;
  if (subtitle) s += `<text x="${m.left}" y="82" font-size="18" fill="${muted}">${esc(subtitle)}</text>`;

  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i;
    const y = m.top + ch - (v / max) * ch;
    s += `<line x1="${m.left}" y1="${y}" x2="${W - m.right}" y2="${y}" stroke="${grid}" stroke-width="1"/>`;
    s += `<text x="${m.left - 10}" y="${y + 5}" font-size="14" fill="${muted}" text-anchor="end">${esc(shortMoney(v))}</text>`;
  }

  const labelSize = n > 10 ? 12 : 15;
  items.forEach((d, i) => {
    const x = m.left + slot * i + (slot - bw) / 2;
    const h = (Math.max(0, d.value) / max) * ch;
    const y = m.top + ch - h;
    s += `<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="4" fill="${d.highlight ? hi : base}"/>`;
    s += `<text x="${x + bw / 2}" y="${y - 8}" font-size="${n > 10 ? 12 : 15}" font-weight="bold" fill="${ink}" text-anchor="middle">${esc(valueFmt(d.value))}</text>`;
    s += `<text x="${x + bw / 2}" y="${m.top + ch + 24}" font-size="${labelSize}" fill="${ink}" text-anchor="middle">${esc(d.label)}</text>`;
    if (d.sub) s += `<text x="${x + bw / 2}" y="${m.top + ch + 46}" font-size="${labelSize - 1}" fill="${muted}" text-anchor="middle">${esc(d.sub)}</text>`;
  });
  s += `<line x1="${m.left}" y1="${m.top + ch}" x2="${W - m.right}" y2="${m.top + ch}" stroke="#9aa1ad" stroke-width="1.5"/>`;
  s += `</svg>`;

  const r = new Resvg(s, {
    font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: 'DejaVu Sans' },
    fitTo: { mode: 'width', value: W },
  });
  return r.render().asPng();
}

module.exports = { barChart, shortMoney };
