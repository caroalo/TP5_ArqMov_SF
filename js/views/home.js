import * as api from '../api.js';
import { formatCountdown } from '../logic.js';
import { esc } from '../ui.js';

const TILES = [
  ['bikes', '🚲', 'Bicicletas públicas', 'Estaciones y disponibilidad'],
  ['tax', '🧾', 'Tributos', 'Cedulones y pagos'],
  ['claims', '📣', 'Centro de reclamos', 'Reclamá y hacé seguimiento'],
  ['contacts', '📞', 'Atención al vecino', 'Teléfonos, mail y WhatsApp'],
  ['alarms', '🚨', 'Alarmas comunitarias', 'Estado en tiempo real'],
  ['parking', '🅿️', 'Estacionamiento medido', 'Zonas, tarifas y pago'],
  ['notifications', '🔔', 'Notificaciones', 'Alertas y preferencias'],
];

export default {
  title: 'San Francisco Digital',
  render(root) {
    const draw = () => {
      const unread = api.unreadCount();
      const s = api.getParking().session;
      const left = s ? s.endsAt - Date.now() : 0;
      root.innerHTML = `
        <section class="hero"><h2>Hola, vecino</h2><p>Todos los servicios de la Municipalidad de San Francisco en un solo lugar.</p></section>
        ${s ? `<a class="card" style="display:block;text-decoration:none;color:inherit" href="#/parking">🅿️ Estacionamiento activo (${esc(s.plate)}): <strong>${left > 0 ? formatCountdown(left) : 'vencido'}</strong></a>` : ''}
        <div class="grid">${TILES.map(([k, ic, t, d]) => `
          <a class="tile" href="#/${k}"><span class="ic" aria-hidden="true">${ic}</span><strong>${t}</strong><small>${d}</small>
          ${k === 'notifications' && unread ? `<span class="pill bad">${unread} nuevas</span>` : ''}</a>`).join('')}</div>
        <p class="hint" style="text-align:center;margin-top:16px">Datos de ejemplo con fines académicos. Los servicios se simulan mediante una capa de API mock.</p>`;
    };
    draw();
    const t = setInterval(draw, 1000);
    const on = () => draw();
    api.bus.addEventListener('notify', on);
    return () => { clearInterval(t); api.bus.removeEventListener('notify', on); };
  },
};
