import * as api from '../api.js';
import { $, esc, toast, makeMap } from '../ui.js';

export default {
  title: 'Alarmas comunitarias',
  render(root) {
    root.innerHTML = `
      <div class="map" id="map" role="application" aria-label="Mapa de alarmas"></div>
      <section class="card"><h3>Suscribirme a zonas</h3><p class="hint">Recibís una notificación cuando se active una alarma en las zonas elegidas o a menos de 1 km de tu ubicación.</p><div class="chips" id="zones"></div>
        <button class="btn small" id="sim">Simular activación (demo)</button></section>
      <div id="sum"></div><ul class="list" id="list"></ul>`;
    const map = makeMap($('#map', root));
    const markers = new Map();
    let alarms = [];

    function draw() {
      const subs = api.getAlarmSubs();
      $('#zones', root).innerHTML = api.ZONES.map((z) => `<button class="chip" data-z="${z}" aria-pressed="${subs.includes(z)}">${z}</button>`).join('');
      const act = alarms.filter((a) => a.active).length;
      $('#sum', root).innerHTML = `<p><span class="pill ${act ? 'bad' : 'ok'}">${act ? `${act} activada(s)` : 'Todas desactivadas'}</span> <small class="meta">de ${alarms.length} alarmas instaladas</small></p>`;
      if (map) alarms.forEach((a) => {
        const icon = L.divIcon({ className: '', html: `<div class="pin alarm ${a.active ? 'on' : ''}">🔔</div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
        let m = markers.get(a.id);
        const html = `<strong>${esc(a.name)}</strong><br>${esc(a.street)}<br>Zona ${esc(a.zone)}: <b>${a.active ? 'ACTIVADA' : 'desactivada'}</b>`;
        if (!m) { m = L.marker([a.lat, a.lng], { icon, title: a.name }).addTo(map).bindPopup(html); markers.set(a.id, m); } else { m.setIcon(icon); m.setPopupContent(html); }
      });
      $('#list', root).innerHTML = [...alarms].sort((a, b) => b.active - a.active).map((a) => `<li class="item static"><div><strong>${esc(a.name)}</strong><div class="meta">${esc(a.street)} · zona ${esc(a.zone)}</div></div><span class="pill ${a.active ? 'bad' : 'ok'}">${a.active ? 'Activada' : 'Desactivada'}</span></li>`).join('');
    }

    async function load() { alarms = await api.getAlarms(); draw(); }
    load();
    const on = () => load();
    api.bus.addEventListener('alarms', on);
    root.addEventListener('click', (e) => {
      const z = e.target.closest('[data-z]');
      if (z) { const subs = api.toggleAlarmSub(z.dataset.z); toast(subs.includes(z.dataset.z) ? `Suscripto a zona ${z.dataset.z}` : `Baja de zona ${z.dataset.z}`, 'success'); }
      if (e.target.id === 'sim') api.simulateAlarm();
    });
    return () => { api.bus.removeEventListener('alarms', on); map?.remove(); };
  },
};
