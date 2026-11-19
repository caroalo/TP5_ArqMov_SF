import * as api from '../api.js';
import { parkingCost, isRegulated, pointInRect, formatCountdown, validPlate } from '../logic.js';
import { $, esc, money, fmtDateTime, toast, makeMap, getPosition, payFlow } from '../ui.js';

const DURATIONS = [15, 30, 60, 90, 120];
const COLORS = { A: '#c62828', B: '#e08a00', C: '#1b8a4b' };

export default {
  title: 'Estacionamiento medido',
  render(root) {
    let zoneId = 'A';
    let minutes = 60;
    let plate = '';
    let map = null;
    let timer = null;

    function drawZoneInfo() {
      const z = api.PARKING_ZONES.find((x) => x.id === zoneId);
      const reg = isRegulated(new Date(), api.PARKING_SCHEDULE);
      return `<p><strong>${esc(z.name)}</strong> · ${money(z.rate)}/hora (se cobra cada 15 min)<br><span class="meta">Lun a Vie 8 a 20 h · Sáb 8 a 13 h</span></p>
        <p>${reg ? '<span class="pill warn">Horario regulado ahora</span>' : '<span class="pill ok">Fuera de horario: no se cobra</span>'}</p>`;
    }

    function draw() {
      const { session: s, history } = api.getParking();
      const prefs = api.getPrefs();
      if (s) {
        const left = s.endsAt - Date.now();
        root.innerHTML = `
          <section class="card"><div class="meta">Patente ${esc(s.plate)} · ${esc(s.zoneName)}</div>
            <div class="countdown ${left <= prefs.parkingAlertMin * 60000 ? 'low' : ''}" id="cd" role="timer" aria-live="off">${left > 0 ? formatCountdown(left) : 'VENCIDO'}</div>
            <p class="meta" style="text-align:center">Vence a las ${new Date(s.endsAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} · Pagado ${money(s.paid)} (${esc(s.method)})</p>
            <h3 style="margin:12px 0 6px">Extender tiempo</h3>
            <div class="toolbar">${[15, 30, 60].map((m) => `<button class="btn" data-ext="${m}">+${m} min<br><small>${money(parkingCost(m, s.rate))}</small></button>`).join('')}</div>
            <label>Avisarme antes del vencimiento<select id="alert">${[2, 5, 10, 15].map((m) => `<option value="${m}" ${prefs.parkingAlertMin === m ? 'selected' : ''}>${m} minutos antes</option>`).join('')}</select></label>
            <button class="btn danger block" id="end">Finalizar estacionamiento</button></section>
          <h3>Zonas y tarifas</h3><div class="map" id="map" style="margin-top:8px"></div>`;
      } else {
        root.innerHTML = `
          <div class="map" id="map" role="application" aria-label="Mapa de zonas de estacionamiento"></div>
          <section class="card"><div id="zi">${drawZoneInfo()}</div>
            <div class="chips" id="zsel">${api.PARKING_ZONES.map((z) => `<button class="chip" data-z="${z.id}" aria-pressed="${z.id === zoneId}">${z.id}</button>`).join('')}<button class="chip" id="gps">📍 Mi zona</button></div>
            <form id="pf" novalidate>
              <label>Patente<input name="plate" value="${esc(plate)}" maxlength="9" autocapitalize="characters" autocomplete="off" placeholder="AB123CD" style="text-transform:uppercase"></label>
              <label>Tiempo<select name="min">${DURATIONS.map((m) => `<option value="${m}" ${m === minutes ? 'selected' : ''}>${m >= 60 ? `${m / 60 === Math.floor(m / 60) ? m / 60 : (m / 60).toFixed(1)} h` : `${m} min`}</option>`).join('')}</select></label>
              <p class="total">Costo: <strong id="cost"></strong></p><p class="err" id="perr" role="alert"></p>
              <button class="btn primary block" type="submit">Pagar y estacionar</button></form></section>
          ${history.length ? `<h3>Historial</h3>${history.slice(0, 5).map((h) => `<div class="item static"><div><strong>${esc(h.plate)}</strong><div class="meta">${esc(h.zoneName)} · ${fmtDateTime(h.startedAt)}</div></div><span>${money(h.paid)}</span></div>`).join('')}` : ''}`;
      }
      initMap();
      bind();
      updateCost();
    }

    const updateCost = () => {
      const z = api.PARKING_ZONES.find((x) => x.id === zoneId);
      const c = $('#cost', root);
      if (c) c.textContent = money(parkingCost(minutes, z.rate));
    };

    function initMap() {
      map?.remove();
      map = makeMap($('#map', root), { zoom: 15 });
      if (!map) return;
      api.PARKING_ZONES.forEach((z) => {
        const b = z.bounds;
        L.rectangle([[b.south, b.west], [b.north, b.east]], { color: COLORS[z.id], weight: z.id === zoneId ? 4 : 2, fillOpacity: z.id === zoneId ? 0.28 : 0.14 })
          .addTo(map).bindTooltip(`${z.name}: ${money(z.rate)}/h`, { sticky: true })
          .on('click', () => { zoneId = z.id; const s = api.getParking().session; if (!s) draw(); });
      });
    }

    function bind() {
      $('#zsel', root)?.addEventListener('click', async (e) => {
        const z = e.target.closest('[data-z]');
        if (z) { zoneId = z.dataset.z; plate = $('#pf', root).plate.value; draw(); return; }
        if (e.target.id === 'gps') {
          try {
            const p = await getPosition(); api.setUserPos(p);
            const hit = api.PARKING_ZONES.find((x) => pointInRect(p, x.bounds));
            if (hit) { zoneId = hit.id; plate = $('#pf', root).plate.value; draw(); toast(`Estás en ${hit.name}`, 'success'); } else toast('Tu ubicación está fuera de las zonas reguladas', 'info');
          } catch (err) { toast(err.message, 'error'); }
        }
      });
      const f = $('#pf', root);
      f?.min.addEventListener('change', () => { minutes = Number(f.min.value); updateCost(); });
      f?.addEventListener('submit', async (e) => {
        e.preventDefault();
        plate = f.plate.value;
        if (!validPlate(plate)) { $('#perr', root).textContent = 'Patente inválida. Ejemplos: AB123CD o ABC123.'; return; }
        const z = api.PARKING_ZONES.find((x) => x.id === zoneId);
        const r = await payFlow({ title: 'Pagar estacionamiento', amount: parkingCost(minutes, z.rate), summary: `<p>Patente <strong>${esc(plate.toUpperCase())}</strong><br>${esc(z.name)} · ${minutes} min</p>`, pay: (card) => api.startParking({ plate, zoneId, minutes, card }) });
        if (r) toast('Estacionamiento activado. Te avisaremos antes de que venza', 'success');
      });
      root.querySelectorAll('[data-ext]').forEach((b) => b.addEventListener('click', async () => {
        b.disabled = true;
        try { await api.extendParking(Number(b.dataset.ext)); toast(`Tiempo extendido ${b.dataset.ext} min`, 'success'); } catch (err) { toast(err.message, 'error'); b.disabled = false; }
      }));
      $('#alert', root)?.addEventListener('change', (e) => { api.setPrefs({ parkingAlertMin: Number(e.target.value) }); toast('Aviso actualizado', 'success'); });
      $('#end', root)?.addEventListener('click', () => { if (confirm('Finalizar el estacionamiento? No se reintegra el tiempo restante.')) api.endParking(); });
    }

    draw();
    timer = setInterval(() => {
      const s = api.getParking().session;
      const cd = $('#cd', root);
      if (s && cd) {
        const left = s.endsAt - Date.now();
        cd.textContent = left > 0 ? formatCountdown(left) : 'VENCIDO';
        cd.classList.toggle('low', left <= api.getPrefs().parkingAlertMin * 60000);
      }
    }, 1000);
    const on = () => draw();
    api.bus.addEventListener('parking', on);
    return () => { clearInterval(timer); api.bus.removeEventListener('parking', on); map?.remove(); };
  },
};
