// Utilidades de interfaz compartidas por las vistas.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);
export const fmtDate = (d) => new Date(typeof d === 'string' && d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
export const fmtDateTime = (d) => new Date(d).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
export const timeAgo = (ts) => {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} d`;
};

export function toast(msg, type = 'info') {
  const box = $('#toasts');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.setAttribute('role', type === 'error' ? 'alert' : 'status');
  t.textContent = msg;
  box.append(t);
  setTimeout(() => t.remove(), 4500);
}

export function sheet(html) {
  const back = document.createElement('div');
  back.className = 'backdrop';
  back.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><button class="close" aria-label="Cerrar">✕</button>${html}</div>`;
  document.body.append(back);
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('.close')) close(); });
  return { el: back.firstElementChild, close };
}

export function makeMap(el, { center = [-31.4275, -62.0827], zoom = 14 } = {}) {
  if (typeof L === 'undefined') { el.innerHTML = '<p class="empty">No se pudo cargar el mapa.</p>'; return null; }
  const map = L.map(el).setView(center, zoom);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  setTimeout(() => map.invalidateSize(), 80);
  return map;
}

export function getPosition() {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('Tu navegador no soporta geolocalización.'));
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => rej(new Error('No se pudo obtener tu ubicación. Revisá los permisos del navegador.')),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  });
}

export const cardFields = () => `
  <label>Titular<input name="name" autocomplete="cc-name" required placeholder="Como figura en la tarjeta"></label>
  <label>Número de tarjeta<input name="number" inputmode="numeric" autocomplete="cc-number" placeholder="4242 4242 4242 4242" maxlength="23" required></label>
  <div class="row2">
    <label>Vencimiento<input name="exp" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/AA" maxlength="5" required></label>
    <label>CVV<input name="cvv" type="password" inputmode="numeric" autocomplete="cc-csc" maxlength="4" required></label>
  </div>
  <p class="hint">Pasarela simulada. Probá con 4242 4242 4242 4242 (aprobada) o 4000 0000 0000 0002 (rechazada). Los datos de la tarjeta no se guardan.</p>`;

export function bindCard(form) {
  form.number?.addEventListener('input', () => { form.number.value = form.number.value.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim(); });
  form.exp?.addEventListener('input', () => {
    let v = form.exp.value.replace(/\D/g, '').slice(0, 4);
    if (v.length > 2) v = `${v.slice(0, 2)}/${v.slice(2)}`;
    form.exp.value = v;
  });
}
export const readCard = (f) => ({ name: f.name.value, number: f.number.value, exp: f.exp.value, cvv: f.cvv.value });

// Flujo de pago reutilizable. `pay(card)` debe devolver una promesa. Resuelve con el resultado o null si se cancela.
export function payFlow({ title, amount, summary, pay }) {
  return new Promise((resolve) => {
    const s = sheet(`<h2>${esc(title)}</h2>${summary}<p class="total">Total a pagar: <strong>${money(amount)}</strong></p>
      <form id="payform" novalidate>${cardFields()}<p class="err" id="payerr" role="alert"></p><button class="btn primary block" type="submit">Pagar ${money(amount)}</button></form>`);
    const form = $('#payform', s.el);
    bindCard(form);
    let done = false;
    new MutationObserver(() => { if (!document.body.contains(s.el) && !done) { done = true; resolve(null); } }).observe(document.body, { childList: true });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Procesando...';
      try {
        const r = await pay(readCard(form));
        done = true; s.close(); resolve(r);
      } catch (err) {
        $('#payerr', s.el).textContent = err.message;
        btn.disabled = false; btn.textContent = `Pagar ${money(amount)}`;
      }
    });
  });
}

export const skeleton = (n = 3) => Array.from({ length: n }, () => '<div class="skel"></div>').join('');
