import * as api from '../api.js';
import { sortByDistance, fmtDist } from '../logic.js';
import { $, $$, esc, toast, sheet, makeMap, getPosition, skeleton, timeAgo } from '../ui.js';

export default {
  title: 'Bicicletas públicas',
  render(root) {
    root.innerHTML = `
      <div class="map" id="map" role="application" aria-label="Mapa de estaciones"></div>
      <div class="toolbar"><button class="btn primary" id="loc">📍 Cerca de mí</button><button class="btn" id="report">⚠️ Reportar problema</button></div>
      <ul class="list" id="list">${skeleton()}</ul>`;
    const map = makeMap($('#map', root));
    const markers = new Map();
    let stations = [];
    let pos = api.getUserPos();
    let userMarker = null;
    const cls = (s) => (s.bikes === 0 ? 'none' : s.bikes <= 2 ? 'low' : 'ok');

    const popup = (s) => `<strong>${esc(s.name)}</strong><br>🚲 ${s.bikes} bicicletas · 🔓 ${s.docks} anclajes libres<br>
      <a target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}&travelmode=walking">Cómo llegar</a>`;

    function draw() {
      if (map) {
        stations.forEach((s) => {
          const icon = L.divIcon({ className: '', html: `<div class="pin ${cls(s)}">${s.bikes}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
          let m = markers.get(s.id);
          if (!m) { m = L.marker([s.lat, s.lng], { icon, title: s.name }).addTo(map); markers.set(s.id, m); m.bindPopup(popup(s)); }
          else { m.setIcon(icon); m.setPopupContent(popup(s)); }
        });
      }
      const list = pos ? sortByDistance(stations, pos) : stations;
      $('#list', root).innerHTML = list.map((s) => `
        <li class="item" tabindex="0" data-id="${s.id}">
          <div style="flex:1"><strong>${esc(s.name)}</strong>
            <div class="meta">${pos ? `${fmtDist(s.dist)} · ` : ''}🚲 ${s.bikes} · 🔓 ${s.docks} · act. ${timeAgo(s.updatedAt)}</div>
            <div class="meter" aria-hidden="true"><i style="width:${(s.bikes / s.cap) * 100}%"></i></div></div>
          <span class="pill ${s.bikes === 0 ? 'bad' : s.bikes <= 2 ? 'warn' : 'ok'}">${s.bikes === 0 ? 'Sin bicis' : s.bikes <= 2 ? 'Pocas' : 'Disponible'}</span>
        </li>`).join('');
    }

    async function load() { stations = await api.getStations(); draw(); }
    load();
    const onUpd = () => load();
    api.bus.addEventListener('stations', onUpd);

    $('#list', root).addEventListener('click', (e) => {
      const li = e.target.closest('.item'); if (!li || !map) return;
      const m = markers.get(li.dataset.id);
      map.flyTo(m.getLatLng(), 17); m.openPopup();
      $('#map', root).scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    $('#list', root).addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.click?.(); });

    $('#loc', root).addEventListener('click', async (e) => {
      const b = e.currentTarget; b.disabled = true;
      try {
        pos = await getPosition();
        api.setUserPos(pos);
        if (map) {
          userMarker?.remove();
          userMarker = L.circleMarker([pos.lat, pos.lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#1a73e8', fillOpacity: 1 }).addTo(map).bindPopup('Estás aquí');
          const near = sortByDistance(stations, pos)[0];
          map.fitBounds([[pos.lat, pos.lng], [near.lat, near.lng]], { padding: [40, 40], maxZoom: 17 });
        }
        draw();
        toast('Estaciones ordenadas por cercanía', 'success');
      } catch (err) { toast(err.message, 'error'); }
      b.disabled = false;
    });

    $('#report', root).addEventListener('click', () => {
      const s = sheet(`<h2>Reportar un problema</h2>
        <form id="rf" novalidate>
          <label>Estación<select name="station">${stations.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></label>
          <label>Tipo de problema<select name="kind"><option>Bicicleta dañada</option><option>Anclaje roto</option><option>Estación sin energía</option><option>Vandalismo</option><option>Otro</option></select></label>
          <label>Descripción<textarea name="description" required placeholder="Contanos qué pasó"></textarea></label>
          <p class="err" role="alert" id="rerr"></p>
          <button class="btn primary block" type="submit">Enviar reporte</button>
        </form>`);
      const f = $('#rf', s.el);
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const r = await api.reportBikeIssue({ stationId: f.station.value, kind: f.kind.value, description: f.description.value });
          s.close(); toast(`Reporte ${r.id} enviado. Gracias por avisar`, 'success');
        } catch (err) { $('#rerr', s.el).textContent = err.message; }
      });
    });

    return () => { api.bus.removeEventListener('stations', onUpd); map?.remove(); };
  },
};
