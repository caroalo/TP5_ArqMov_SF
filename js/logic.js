// Lógica pura (sin DOM ni red): fácil de testear con `node --test`.

export const CLAIM_STAGES = ['Recibido', 'En análisis', 'En ejecución', 'Resuelto'];
// Tiempos acelerados para la demo en clase (en producción los define el backend).
export const CLAIM_OFFSETS_MS = [0, 20_000, 60_000, 150_000];

export function haversine(a, b) {
  const rad = (x) => (x * Math.PI) / 180;
  const R = 6371000;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function sortByDistance(items, pos) {
  return items.map((i) => ({ ...i, dist: haversine(pos, i) })).sort((x, y) => x.dist - y.dist);
}

export function fmtDist(m) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

// Estacionamiento: se cobra por bloques de 15 minutos.
export function parkingCost(minutes, ratePerHour) {
  if (!(minutes > 0)) return 0;
  return Math.round((Math.ceil(minutes / 15) * ratePerHour) / 4);
}

export function isRegulated(date, schedule) {
  const d = date.getDay();
  const h = date.getHours() + date.getMinutes() / 60;
  return schedule.some((s) => s.days.includes(d) && h >= s.from && h < s.to);
}

export function pointInRect(p, b) {
  return p.lat >= b.south && p.lat <= b.north && p.lng >= b.west && p.lng <= b.east;
}

export function formatCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`;
}

// Tributos
const dueEnd = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59);
};

export function taxStatus(c, now = new Date()) {
  if (c.paidAt) return 'paid';
  return now > dueEnd(c.dueDate) ? 'overdue' : 'due';
}

export function daysUntil(iso, now = new Date()) {
  const due = dueEnd(iso);
  const a = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / 86400000); // diferencia en días calendario
}

// Recargo simulado: 2% por mes (o fracción) de mora.
export function surcharge(c, now = new Date()) {
  if (taxStatus(c, now) !== 'overdue') return 0;
  const daysOver = Math.floor((now - dueEnd(c.dueDate)) / 86400000) + 1;
  const months = Math.max(1, Math.ceil(daysOver / 30));
  return Math.round(c.amount * 0.02 * months * 100) / 100;
}

export const totalDue = (c, now = new Date()) => Math.round((c.amount + surcharge(c, now)) * 100) / 100;

// Validaciones
export function luhn(num) {
  const s = String(num).replace(/\s|-/g, '');
  if (!/^\d{13,19}$/.test(s)) return false;
  let sum = 0;
  let alt = false;
  for (let i = s.length - 1; i >= 0; i--) {
    let n = Number(s[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function validExpiry(mmyy, now = new Date()) {
  const m = /^(\d{2})\/(\d{2})$/.exec(mmyy);
  if (!m) return false;
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return false;
  return new Date(year, month, 0, 23, 59, 59) >= now;
}

// Patentes argentinas: formato viejo (ABC123) y Mercosur (AB123CD).
export function validPlate(p) {
  return /^([A-Z]{3}\d{3}|[A-Z]{2}\d{3}[A-Z]{2})$/.test(String(p).toUpperCase().replace(/\s|-/g, ''));
}

export const normPlate = (p) => String(p).toUpperCase().replace(/\s|-/g, '');

// Reclamos
export function claimStage(createdAt, now = Date.now(), offsets = CLAIM_OFFSETS_MS) {
  let stage = 0;
  offsets.forEach((o, i) => {
    if (now - createdAt >= o) stage = i;
  });
  return stage;
}

// Barras determinísticas para el código del cedulón (representación simple).
export function barcodeBars(code) {
  const bars = [];
  for (const ch of String(code)) {
    const c = ch.charCodeAt(0);
    bars.push((c % 3) + 1, ((c * 7) % 3) + 1, ((c * 13) % 2) + 1);
  }
  return bars;
}
