import * as api from '../api.js';
import { $, $$, esc, timeAgo, toast } from '../ui.js';

export default {
  title: 'Notificaciones',
  render(root) {
    let tab = 'hist';
    let filter = 'all';

    function history() {
      const all = api.getNotifications();
      const list = filter === 'all' ? all : all.filter((n) => n.type === filter);
      return `<div class="chips"><button class="chip" data-f="all" aria-pressed="${filter === 'all'}">Todas</button>${Object.entries(api.NOTIF_TYPES).map(([k, v]) => `<button class="chip" data-f="${k}" aria-pressed="${filter === k}">${v.icon} ${v.label}</button>`).join('')}</div>
        <div class="toolbar"><button class="btn small" id="readall">Marcar todo como leído</button><button class="btn small danger" id="clear">Borrar historial</button></div>
        ${list.length ? list.map((n) => `<article class="item static ${n.read ? '' : 'unread'}" data-id="${n.id}"><div><span aria-hidden="true">${api.NOTIF_TYPES[n.type]?.icon || '🔔'}</span> <strong>${esc(n.title)}</strong>
          <div>${esc(n.body)}</div><div class="meta">${timeAgo(n.ts)}${n.zone ? ` · zona ${esc(n.zone)}` : ''} · <a href="${esc(n.url)}" ${n.url.startsWith('http') ? 'target="_blank" rel="noopener"' : ''} data-open="${n.id}">Más información</a></div></div></article>`).join('')
          : '<p class="empty">No hay notificaciones.</p>'}`;
    }

    function prefs() {
      const p = api.getPrefs();
      const perm = 'Notification' in window ? Notification.permission : 'unsupported';
      return `<section class="card"><h3>Notificaciones del dispositivo</h3>
          <p class="hint">${perm === 'granted' ? 'Activadas. Se muestran incluso con la app en segundo plano.' : perm === 'denied' ? 'Bloqueadas en el navegador. Habilitalas desde los ajustes del sitio.' : perm === 'unsupported' ? 'Tu navegador no las soporta; se verán dentro de la app.' : 'Activalas para recibir alertas fuera de la app.'}</p>
          ${perm === 'default' ? '<button class="btn primary" id="perm">Activar notificaciones</button>' : ''}</section>
        <section class="card"><h3>Tipos de alerta</h3>${Object.entries(api.NOTIF_TYPES).map(([k, v]) => `<label style="display:flex;justify-content:space-between;align-items:center;margin:0;min-height:44px"><span>${v.icon} ${v.label}</span><input type="checkbox" data-type="${k}" ${p.types[k] ? 'checked' : ''} style="width:24px;min-height:24px;margin:0"></label>`).join('')}</section>
        <section class="card"><h3>Frecuencia</h3>
          <label style="margin:8px 0"><input type="radio" name="freq" value="inmediata" ${p.frequency === 'inmediata' ? 'checked' : ''} style="display:inline;width:auto;min-height:0"> Inmediata</label>
          <label style="margin:8px 0"><input type="radio" name="freq" value="resumen" ${p.frequency === 'resumen' ? 'checked' : ''} style="display:inline;width:auto;min-height:0"> Resumen (solo en el historial, sin avisos; las emergencias siempre llegan)</label></section>
        <section class="card"><h3>Zonas de interés</h3><p class="hint">Aplica a cortes de agua, obras y eventos.</p><div class="chips">${api.ZONES.map((z) => `<button class="chip" data-zone="${z}" aria-pressed="${p.zones.includes(z)}">${z}</button>`).join('')}</div></section>
        <section class="card"><h3>Probar (demo)</h3><div class="toolbar">${['agua', 'obras', 'eventos', 'emergencias'].map((k) => `<button class="btn small" data-demo="${k}">${api.NOTIF_TYPES[k].icon} ${api.NOTIF_TYPES[k].label}</button>`).join('')}</div></section>`;
    }

    function draw() {
      root.innerHTML = `<div class="tabs" role="tablist"><button role="tab" data-t="hist" aria-selected="${tab === 'hist'}">Historial</button><button role="tab" data-t="prefs" aria-selected="${tab === 'prefs'}">Preferencias</button></div>${tab === 'hist' ? history() : prefs()}`;
    }

    draw();
    root.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-t]'); if (t) { tab = t.dataset.t; draw(); return; }
      const f = e.target.closest('[data-f]'); if (f) { filter = f.dataset.f; draw(); return; }
      const o = e.target.closest('[data-open]'); if (o) api.markRead(o.dataset.open);
      if (e.target.id === 'readall') api.markAllRead();
      if (e.target.id === 'clear') { if (confirm('Borrar todo el historial?')) api.clearNotifications(); }
      const z = e.target.closest('[data-zone]');
      if (z) { const p = api.getPrefs(); const zones = p.zones.includes(z.dataset.zone) ? p.zones.filter((x) => x !== z.dataset.zone) : [...p.zones, z.dataset.zone]; api.setPrefs({ zones }); draw(); }
      const d = e.target.closest('[data-demo]');
      if (d) { const r = api.simulateNotification(d.dataset.demo); if (!r) toast('Ese tipo o zona está desactivado en tus preferencias', 'info'); }
      if (e.target.id === 'perm') { await Notification.requestPermission(); draw(); }
    });
    root.addEventListener('change', (e) => {
      if (e.target.dataset.type) { const p = api.getPrefs(); api.setPrefs({ types: { ...p.types, [e.target.dataset.type]: e.target.checked } }); }
      if (e.target.name === 'freq') api.setPrefs({ frequency: e.target.value });
    });
    const on = () => { if (tab === 'hist') draw(); };
    api.bus.addEventListener('notify', on);
    return () => api.bus.removeEventListener('notify', on);
  },
};
