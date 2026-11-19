import * as api from '../api.js';
import { $, esc, toast } from '../ui.js';

export default {
  title: 'Atención al vecino',
  render(root) {
    let q = '';
    const areas = ['Todas', ...new Set(api.CONTACTS.map((c) => c.area))];
    let area = 'Todas';

    function list() {
      const items = api.CONTACTS.filter((c) => (area === 'Todas' || c.area === area) && `${c.name} ${c.area}`.toLowerCase().includes(q.toLowerCase()));
      return items.length ? items.map((c) => `<article class="card">
        <div style="display:flex;justify-content:space-between;gap:8px"><strong>${esc(c.name)}</strong><span class="pill">${esc(c.area)}</span></div>
        <div class="meta">📞 ${esc(c.phone)} · 🕒 ${esc(c.hours)}</div>
        <div class="toolbar" style="margin:10px 0 0">
          <a class="btn primary small" href="tel:${esc(c.phone)}">Llamar</a>
          ${c.email ? `<a class="btn small" href="mailto:${esc(c.email)}?subject=${encodeURIComponent('Consulta de vecino')}">Email</a>` : ''}
          ${c.wa ? `<a class="btn small" target="_blank" rel="noopener" href="https://wa.me/${esc(c.wa)}?text=${encodeURIComponent('Hola, quisiera hacer una consulta.')}">WhatsApp</a>` : ''}
          <button class="btn small" data-share="${c.id}">Compartir</button></div></article>`).join('') : '<p class="empty">No hay contactos para esa búsqueda.</p>';
    }

    root.innerHTML = `<input type="search" id="q" placeholder="Buscar área o servicio" aria-label="Buscar contactos">
      <div class="chips" style="margin:10px 0" id="areas">${areas.map((a) => `<button class="chip" data-a="${esc(a)}" aria-pressed="${a === area}">${esc(a)}</button>`).join('')}</div>
      <div id="l">${list()}</div><p class="hint">Los números locales y correos son de ejemplo. Los de emergencia (100, 101, 103, 107) y el 147 son los reales.</p>`;

    const refresh = () => { $('#l', root).innerHTML = list(); };
    $('#q', root).addEventListener('input', (e) => { q = e.target.value; refresh(); });
    $('#areas', root).addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      area = b.dataset.a;
      root.querySelectorAll('#areas .chip').forEach((x) => x.setAttribute('aria-pressed', x === b));
      refresh();
    });
    root.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-share]'); if (!b) return;
      const c = api.CONTACTS.find((x) => x.id === b.dataset.share);
      const text = `${c.name}: ${c.phone} (${c.hours})`;
      try {
        if (navigator.share) await navigator.share({ title: c.name, text });
        else { await navigator.clipboard.writeText(text); toast('Contacto copiado', 'success'); }
      } catch { /* cancelado */ }
    });
  },
};
