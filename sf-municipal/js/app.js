import * as api from './api.js';
import { $, $$, toast } from './ui.js';
import home from './views/home.js';
import bikes from './views/bikes.js';
import tax from './views/tax.js';
import claims from './views/claims.js';
import contacts from './views/contacts.js';
import alarms from './views/alarms.js';
import parking from './views/parking.js';
import notifications from './views/notifications.js';

const routes = { '': home, bikes, tax, claims, contacts, alarms, parking, notifications };
const view = $('#view');
let cleanup = null;
let token = 0;

async function route() {
  const key = location.hash.replace(/^#\/?/, '').split('?')[0];
  const v = routes[key] || home;
  const t = ++token;
  cleanup?.();
  cleanup = null;
  const el = document.createElement('div');
  view.replaceChildren(el);
  $('#title').textContent = v.title;
  document.title = key ? `${v.title} | SF Digital` : 'San Francisco Digital';
  $('#back').hidden = !key;
  $$('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === key));
  try {
    const c = await v.render(el);
    if (t !== token) c?.(); else cleanup = c;
  } catch (e) {
    console.error(e);
    el.innerHTML = '<p class="empty">Ocurrió un error al cargar la sección.</p>';
  }
  if (t === token) { view.focus({ preventScroll: true }); window.scrollTo(0, 0); }
}

function updateBadge() {
  const n = api.unreadCount();
  const b = $('#badge');
  b.hidden = n === 0;
  b.textContent = n > 9 ? '9+' : n;
}

async function systemNotify(item) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = { body: item.body, icon: 'icons/icon-192.png', tag: item.id, data: { url: item.url?.startsWith('#') ? `./${item.url}` : './#/notifications' } };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) reg.showNotification(item.title, opts); else new Notification(item.title, opts);
  } catch { /* noop */ }
}

api.bus.addEventListener('notify', (e) => {
  updateBadge();
  const { item, silent } = e.detail;
  if (item && !silent) {
    toast(`${item.title}`, item.type === 'emergencias' || item.type === 'alarmas' ? 'error' : 'info');
    systemNotify(item);
  }
});

$('#back').addEventListener('click', () => (history.length > 1 ? history.back() : (location.hash = '#/')));
window.addEventListener('hashchange', route);

// Conectividad
const net = $('#net');
const syncNet = () => { net.hidden = navigator.onLine; };
addEventListener('online', syncNet);
addEventListener('offline', syncNet);
syncNet();

// Instalación (PWA)
let deferred = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; $('#install').hidden = false; });
$('#install').addEventListener('click', async () => {
  if (!deferred) return;
  deferred.prompt();
  await deferred.userChoice;
  deferred = null;
  $('#install').hidden = true;
});
addEventListener('appinstalled', () => { $('#install').hidden = true; });

// Service worker
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW no registrado', e));
}

updateBadge();
api.startSimulations();
setInterval(api.tick, 1000);
route();
