// Capa de servicios. Cada función simula un endpoint REST (latencia + persistencia local).
// Para pasar a un backend real, solo se reemplaza el cuerpo de estas funciones por fetch().
import {
  haversine, parkingCost, claimStage, taxStatus, daysUntil, totalDue, luhn, validExpiry, validPlate, normPlate,
  CLAIM_STAGES,
} from './logic.js';

const KEY = 'sf-municipal-v1';
export const bus = new EventTarget();
const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));
const sleep = (ms = 250) => new Promise((r) => setTimeout(r, ms + Math.random() * 200));
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const uid = () => Math.random().toString(36).slice(2, 10);
const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return localISO(d); };

export const CENTER = { lat: -31.4275, lng: -62.0827 };
export const ZONES = ['Centro', 'Norte', 'Sur', 'Este', 'Oeste'];

export const NOTIF_TYPES = {
  agua: { label: 'Cortes de agua', icon: '💧', zoned: true },
  obras: { label: 'Obras públicas', icon: '🚧', zoned: true },
  eventos: { label: 'Eventos', icon: '🎉', zoned: true },
  emergencias: { label: 'Emergencias', icon: '🚨' },
  alarmas: { label: 'Alarmas comunitarias', icon: '🔔' },
  tributos: { label: 'Vencimientos tributarios', icon: '🧾' },
  estacionamiento: { label: 'Estacionamiento', icon: '🅿️' },
  reclamos: { label: 'Estado de reclamos', icon: '📣' },
};

// ---------- Datos de ejemplo (simulados) ----------
const STATIONS = [
  ['Plaza Mitre', -31.4272, -62.0830, 12], ['Terminal de Ómnibus', -31.4339, -62.0889, 10],
  ['Costanera', -31.4215, -62.0765, 14], ['Parque del Sur', -31.4390, -62.0800, 10],
  ['Hospital Iturraspe', -31.4300, -62.0750, 8], ['UTN FRSFCO', -31.4376, -62.0855, 12],
  ['Estación Ferrocarril', -31.4250, -62.0900, 10], ['Barrio Industrial', -31.4180, -62.0900, 8],
  ['Plaza Sarmiento', -31.4310, -62.0870, 12], ['Club Sportivo', -31.4240, -62.0800, 10],
].map(([name, lat, lng, cap], i) => ({ id: `E${i + 1}`, name, lat, lng, cap }));

const ALARMS = [
  ['Bº Centro Norte', 'Av. Urquiza 120', 'Centro', -31.4262, -62.0835], ['Bº Roca', 'Bv. 25 de Mayo 800', 'Centro', -31.4290, -62.0815],
  ['Bº Sarmiento', 'Rivadavia 1450', 'Norte', -31.4190, -62.0850], ['Bº Industrial', 'Ruta 19 km 2', 'Norte', -31.4170, -62.0910],
  ['Bº Parque', 'Av. Libertador 2300', 'Sur', -31.4380, -62.0790], ['Bº Villa del Parque', 'Mitre 3100', 'Sur', -31.4420, -62.0840],
  ['Bº Cerino', 'Bv. Roca 1900', 'Este', -31.4280, -62.0720], ['Bº Hospital', 'Belgrano 1750', 'Este', -31.4305, -62.0745],
  ['Bº Jardín', 'Italia 560', 'Oeste', -31.4270, -62.0950], ['Bº Ferrocarril', 'Pellegrini 900', 'Oeste', -31.4245, -62.0915],
  ['Bº Cooperativa', 'Los Álamos 340', 'Sur', -31.4350, -62.0900], ['Bº Costanera', 'Costanera 110', 'Este', -31.4220, -62.0760],
].map(([name, street, zone, lat, lng], i) => ({ id: `A${i + 1}`, name, street, zone, lat, lng, active: false }));

export const PARKING_ZONES = [
  { id: 'A', name: 'Zona A (Microcentro)', rate: 600, bounds: { south: -31.4290, north: -31.4260, west: -62.0850, east: -62.0810 } },
  { id: 'B', name: 'Zona B (Anillo central)', rate: 400, bounds: { south: -31.4315, north: -31.4240, west: -62.0885, east: -62.0780 } },
  { id: 'C', name: 'Zona C (Zona hospitalaria)', rate: 300, bounds: { south: -31.4325, north: -31.4295, west: -62.0775, east: -62.0725 } },
];
export const PARKING_SCHEDULE = [{ days: [1, 2, 3, 4, 5], from: 8, to: 20 }, { days: [6], from: 8, to: 13 }];

export const CONTACTS = [
  { id: 'c1', name: 'Atención al Vecino 147', area: 'General', phone: '147', email: 'atencion@sanfrancisco.example', wa: '5493564000147', hours: 'Lun a Vie 7 a 20 h' },
  { id: 'c2', name: 'Defensa Civil', area: 'Emergencias', phone: '103', email: 'defensacivil@sanfrancisco.example', wa: '5493564000103', hours: '24 h' },
  { id: 'c3', name: 'Bomberos', area: 'Emergencias', phone: '100', email: '', wa: '', hours: '24 h' },
  { id: 'c4', name: 'Policía', area: 'Emergencias', phone: '101', email: '', wa: '', hours: '24 h' },
  { id: 'c5', name: 'Emergencias médicas', area: 'Salud', phone: '107', email: '', wa: '', hours: '24 h' },
  { id: 'c6', name: 'Dirección General Tributaria', area: 'Tributos', phone: '03564400001', email: 'tributaria@sanfrancisco.example', wa: '5493564400001', hours: 'Lun a Vie 8 a 13 h' },
  { id: 'c7', name: 'Tránsito y Estacionamiento', area: 'Movilidad', phone: '03564400002', email: 'transito@sanfrancisco.example', wa: '5493564400002', hours: 'Lun a Vie 7 a 19 h' },
  { id: 'c8', name: 'Obras Públicas y Alumbrado', area: 'Servicios', phone: '03564400003', email: 'obras@sanfrancisco.example', wa: '5493564400003', hours: 'Lun a Vie 7 a 14 h' },
  { id: 'c9', name: 'Ambiente y Recolección', area: 'Servicios', phone: '03564400004', email: 'ambiente@sanfrancisco.example', wa: '5493564400004', hours: 'Lun a Sáb 7 a 18 h' },
  { id: 'c10', name: 'Bicicletas públicas', area: 'Movilidad', phone: '03564400005', email: 'bicis@sanfrancisco.example', wa: '5493564400005', hours: 'Todos los días 8 a 20 h' },
];

export const CLAIM_CATEGORIES = ['Alumbrado público', 'Bache o calzada', 'Recolección de residuos', 'Arbolado y espacios verdes', 'Pérdida de agua o cloacas', 'Ruidos molestos', 'Tránsito y señalización', 'Otro'];

// ---------- Estado persistente ----------
const seed = () => ({
  v: 1,
  user: null,
  cedulones: [],
  payments: [],
  claims: [],
  bikeReports: [],
  parking: { session: null, history: [] },
  alarmSubs: [],
  seq: { claim: 0 },
  prefs: {
    types: Object.fromEntries(Object.keys(NOTIF_TYPES).map((k) => [k, true])),
    frequency: 'inmediata',
    zones: [...ZONES],
    parkingAlertMin: 5,
  },
  notifications: [
    { id: 'n1', type: 'obras', zone: 'Centro', title: 'Obras en Bv. 25 de Mayo', body: 'Corte parcial de calzada entre Rivadavia y Belgrano por repavimentación.', url: 'https://www.sanfrancisco.gov.ar', ts: Date.now() - 3600e3 * 5, read: false },
    { id: 'n2', type: 'eventos', zone: 'Este', title: 'Feria en la Costanera', body: 'Este sábado a las 16 h, feria de emprendedores y música en vivo.', url: 'https://www.sanfrancisco.gov.ar', ts: Date.now() - 3600e3 * 26, read: false },
  ],
});

let db;
try { db = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch { db = seed(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { console.warn('No se pudo guardar', e); } };
export const resetAll = () => { try { localStorage.removeItem(KEY); } catch { /* noop */ } location.reload(); };

let userPos = null;
export const setUserPos = (p) => { userPos = p; };
export const getUserPos = () => userPos;

// ---------- Notificaciones ----------
export function notify(n) {
  const p = db.prefs;
  if (!p.types[n.type]) return null;
  if (NOTIF_TYPES[n.type]?.zoned && n.zone && !p.zones.includes(n.zone)) return null;
  const item = { id: uid(), ts: Date.now(), read: false, url: 'https://www.sanfrancisco.gov.ar', ...n };
  db.notifications.unshift(item);
  db.notifications = db.notifications.slice(0, 100);
  save();
  const silent = p.frequency === 'resumen' && n.type !== 'emergencias';
  emit('notify', { item, silent });
  return item;
}
export const getNotifications = () => structuredClone(db.notifications);
export const unreadCount = () => db.notifications.filter((n) => !n.read).length;
export function markAllRead() { db.notifications.forEach((n) => { n.read = true; }); save(); emit('notify', { silent: true }); }
export function markRead(id) { const n = db.notifications.find((x) => x.id === id); if (n) { n.read = true; save(); emit('notify', { silent: true }); } }
export function clearNotifications() { db.notifications = []; save(); emit('notify', { silent: true }); }
export const getPrefs = () => structuredClone(db.prefs);
export function setPrefs(patch) { db.prefs = { ...db.prefs, ...patch }; save(); emit('prefs'); }

const DEMO = {
  agua: { title: 'Corte de agua programado', body: 'Mañana de 8 a 12 h por mantenimiento de red. Zona Sur.', zone: 'Sur' },
  obras: { title: 'Obra en calle Rivadavia', body: 'Desvío de tránsito por trabajos de cloacas.', zone: 'Norte' },
  eventos: { title: 'Acto en Plaza Mitre', body: 'Este domingo 11 h. Habrá cortes de tránsito en el microcentro.', zone: 'Centro' },
  emergencias: { title: 'Alerta por tormenta', body: 'Se espera tormenta fuerte en las próximas 2 horas. Evite circular.', zone: 'Centro' },
};
export function simulateNotification(type = 'agua') {
  const d = DEMO[type] || DEMO.agua;
  return notify({ type, ...d });
}

// ---------- Bicicletas ----------
let stations = STATIONS.map((s) => ({ ...s, bikes: rand(0, s.cap), updatedAt: Date.now() }));
export async function getStations() {
  await sleep();
  return stations.map((s) => ({ ...s, docks: s.cap - s.bikes }));
}
export async function reportBikeIssue({ stationId, kind, description }) {
  await sleep(400);
  if (!description || description.trim().length < 5) throw new Error('Describí brevemente el problema (mínimo 5 caracteres).');
  const r = { id: `B-${uid().toUpperCase()}`, stationId, kind, description: description.trim(), ts: Date.now() };
  db.bikeReports.unshift(r);
  save();
  return r;
}

// ---------- Tributos ----------
export async function queryTaxes(identifier) {
  await sleep(500);
  const id = String(identifier || '').trim();
  if (!/^[0-9A-Za-z.\-/]{5,20}$/.test(id)) throw new Error('Ingresá un DNI, CUIT o número de partida válido (5 a 20 caracteres).');
  db.user = { id };
  if (!db.cedulones.length) {
    db.cedulones = [
      { id: 'TSP-2026-11', tax: 'Tasa de Servicios a la Propiedad', period: 'Noviembre 2026', amount: 18450.5, dueDate: addDays(5) },
      { id: 'AUT-2026-05', tax: 'Patente Automotor', period: 'Cuota 5 de 6', amount: 32200, dueDate: addDays(-12) },
      { id: 'COM-2026-11', tax: 'Tasa de Comercio e Industria', period: 'Noviembre 2026', amount: 25800, dueDate: addDays(20) },
      { id: 'TSP-2026-10', tax: 'Tasa de Servicios a la Propiedad', period: 'Octubre 2026', amount: 17900, dueDate: addDays(-25), paidAt: Date.now() - 86400e3 * 27 },
    ];
    db.payments.push({ id: 'P-SEED01', cedulonId: 'TSP-2026-10', tax: 'Tasa de Servicios a la Propiedad', period: 'Octubre 2026', amount: 17900, method: 'Tarjeta •••• 4242', ts: Date.now() - 86400e3 * 27 });
  }
  save();
  checkTaxReminders();
  emit('tax');
  return getTaxState();
}
export const getTaxState = () => structuredClone({ user: db.user, cedulones: db.cedulones, payments: db.payments });
export const logoutTax = () => { db.user = null; db.cedulones = []; db.payments = []; save(); emit('tax'); };

export function checkCard(card) {
  if (!luhn(card.number)) throw new Error('Número de tarjeta inválido.');
  if (!validExpiry(card.exp)) throw new Error('Tarjeta vencida o fecha inválida (MM/AA).');
  if (!/^\d{3,4}$/.test(card.cvv)) throw new Error('Código de seguridad inválido.');
  if (!card.name || card.name.trim().length < 3) throw new Error('Ingresá el nombre del titular.');
  if (card.number.replace(/\D/g, '').endsWith('0002')) throw new Error('Pago rechazado por el emisor (tarjeta de prueba).');
}
const last4 = (n) => n.replace(/\D/g, '').slice(-4);

// La pasarela se simula: nunca se guarda el número completo ni el CVV.
export async function payCedulon(id, card) {
  const c = db.cedulones.find((x) => x.id === id);
  if (!c || c.paidAt) throw new Error('El cedulón no existe o ya fue pagado.');
  checkCard(card);
  await sleep(900);
  const amount = totalDue(c);
  const p = { id: `P-${uid().toUpperCase()}`, cedulonId: id, tax: c.tax, period: c.period, amount, method: `Tarjeta •••• ${last4(card.number)}`, ts: Date.now() };
  c.paidAt = p.ts;
  db.payments.unshift(p);
  save();
  emit('tax');
  return p;
}
export function checkTaxReminders() {
  db.cedulones.forEach((c) => {
    if (c.paidAt || c.reminded) return;
    const d = daysUntil(c.dueDate);
    if (d <= 7) {
      c.reminded = true;
      notify({ type: 'tributos', title: taxStatus(c) === 'overdue' ? `Vencido: ${c.tax}` : `Vence pronto: ${c.tax}`, body: `${c.period}. Vencimiento ${c.dueDate}.` });
    }
  });
  save();
}

// ---------- Reclamos ----------
export async function createClaim({ category, description, address, coords, files }) {
  await sleep(500);
  if (!category) throw new Error('Elegí una categoría.');
  if (!description || description.trim().length < 10) throw new Error('Describí el reclamo (mínimo 10 caracteres).');
  if (!address || address.trim().length < 3) throw new Error('Indicá la dirección o el lugar del reclamo.');
  const n = ++db.seq.claim;
  const c = {
    id: `R-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`, category, description: description.trim(), address: address.trim(),
    coords: coords || null, files: files || [], createdAt: Date.now(), stage: 0, history: [{ stage: 0, ts: Date.now() }],
  };
  db.claims.unshift(c);
  save();
  emit('claims');
  return c;
}
export const getClaims = () => structuredClone(db.claims);

// ---------- Alarmas ----------
let alarms = ALARMS.map((a) => ({ ...a }));
export async function getAlarms() { await sleep(); return structuredClone(alarms); }
export const getAlarmSubs = () => [...db.alarmSubs];
export function toggleAlarmSub(zone) {
  db.alarmSubs = db.alarmSubs.includes(zone) ? db.alarmSubs.filter((z) => z !== zone) : [...db.alarmSubs, zone];
  save();
  emit('alarms');
  return [...db.alarmSubs];
}
function triggerAlarm(a) {
  a.active = true;
  emit('alarms');
  const near = userPos && haversine(userPos, a) < 1000;
  if (db.alarmSubs.includes(a.zone) || near) {
    notify({ type: 'alarmas', zone: a.zone, title: 'Alarma comunitaria activada', body: `${a.name} (${a.street}), zona ${a.zone}.` });
  }
  setTimeout(() => { a.active = false; emit('alarms'); }, 20000);
}
export function simulateAlarm() {
  const free = alarms.filter((a) => !a.active);
  if (free.length) triggerAlarm(free[rand(0, free.length - 1)]);
}

// ---------- Estacionamiento ----------
export const getParking = () => structuredClone(db.parking);
export async function startParking({ plate, zoneId, minutes, card }) {
  if (!validPlate(plate)) throw new Error('Patente inválida. Ejemplos: AB123CD o ABC123.');
  const zone = PARKING_ZONES.find((z) => z.id === zoneId);
  if (!zone) throw new Error('Elegí una zona.');
  if (db.parking.session) throw new Error('Ya tenés un estacionamiento activo.');
  checkCard(card);
  await sleep(800);
  const now = Date.now();
  const s = {
    id: `S-${uid().toUpperCase()}`, plate: normPlate(plate), zoneId, zoneName: zone.name, rate: zone.rate, startedAt: now, endsAt: now + minutes * 60000,
    paid: parkingCost(minutes, zone.rate), method: `Tarjeta •••• ${last4(card.number)}`, alerted: false, expiredNotified: false,
  };
  db.parking.session = s;
  save();
  emit('parking');
  return s;
}
export async function extendParking(minutes) {
  const s = db.parking.session;
  if (!s) throw new Error('No hay estacionamiento activo.');
  await sleep(500);
  const base = Math.max(s.endsAt, Date.now());
  s.endsAt = base + minutes * 60000;
  s.paid += parkingCost(minutes, s.rate);
  s.alerted = false;
  s.expiredNotified = false;
  save();
  emit('parking');
  return structuredClone(s);
}
export function endParking() {
  const s = db.parking.session;
  if (s) { db.parking.history.unshift({ ...s, finishedAt: Date.now() }); db.parking.history = db.parking.history.slice(0, 20); }
  db.parking.session = null;
  save();
  emit('parking');
}

// ---------- Simulación de tiempo real y tareas periódicas ----------
let started = false;
export function startSimulations() {
  if (started) return;
  started = true;
  setInterval(() => {
    const s = stations[rand(0, stations.length - 1)];
    s.bikes = clamp(s.bikes + (Math.random() < 0.5 ? -1 : 1), 0, s.cap);
    s.updatedAt = Date.now();
    emit('stations');
  }, 6000);
  setInterval(simulateAlarm, 45000);
  setInterval(checkTaxReminders, 60000);
}

// Se llama cada segundo desde app.js.
export function tick() {
  const now = Date.now();
  const s = db.parking.session;
  if (s) {
    const left = s.endsAt - now;
    if (!s.alerted && left > 0 && left <= db.prefs.parkingAlertMin * 60000) {
      s.alerted = true; save();
      notify({ type: 'estacionamiento', title: 'Tu estacionamiento está por vencer', body: `Patente ${s.plate}. Podés extender el tiempo desde la app.`, url: '#/parking' });
    }
    if (!s.expiredNotified && left <= 0) {
      s.expiredNotified = true; save();
      notify({ type: 'estacionamiento', title: 'Estacionamiento vencido', body: `Patente ${s.plate}. Extendé el tiempo para evitar multas.`, url: '#/parking' });
    }
  }
  db.claims.forEach((c) => {
    if (c.stage >= CLAIM_STAGES.length - 1) return;
    const st = claimStage(c.createdAt, now);
    if (st > c.stage) {
      c.stage = st; c.history.push({ stage: st, ts: now }); save();
      emit('claims');
      notify({ type: 'reclamos', title: `Reclamo ${c.id}: ${CLAIM_STAGES[st]}`, body: c.category, url: '#/claims' });
    }
  });
}
