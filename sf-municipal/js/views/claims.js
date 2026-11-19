import * as api from '../api.js';
import { CLAIM_STAGES } from '../logic.js';
import { $, $$, esc, fmtDateTime, toast, getPosition } from '../ui.js';

// Reduce las fotos para no saturar el almacenamiento local (un backend real las subiría como archivos).
function compress(file, max = 720) {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => rej(new Error('No se pudo leer la imagen'));
    img.src = url;
  });
}

export default {
  title: 'Centro de reclamos',
  render(root) {
    let tab = 'new';
    let files = [];
    let coords = null;
    let q = '';
    let filter = -1;

    function drawNew() {
      return `<form class="card" id="cf" novalidate>
        <label>Categoría<select name="category"><option value="">Elegí una opción</option>${api.CLAIM_CATEGORIES.map((c) => `<option>${esc(c)}</option>`).join('')}</select></label>
        <label>Dirección o lugar<input name="address" placeholder="Calle y altura, o referencia" autocomplete="street-address"></label>
        <button class="btn small" type="button" id="gps" style="margin:-4px 0 10px">📍 Usar mi ubicación${coords ? ' ✓' : ''}</button>
        <label>Descripción<textarea name="description" placeholder="Contanos qué pasa, desde cuándo y cómo afecta"></textarea></label>
        <label>Fotos y documentos<input type="file" name="files" id="fi" accept="image/*,.pdf,.doc,.docx" multiple></label>
        <p class="hint">Hasta 4 archivos. Las fotos se reducen automáticamente.</p>
        <div class="thumbs">${files.map((f, i) => (f.img ? `<img src="${f.img}" alt="${esc(f.name)}">` : `<span class="doc">📄 ${esc(f.name)}</span>`)).join('')}</div>
        <p class="err" id="cerr" role="alert"></p>
        <button class="btn primary block" type="submit">Enviar reclamo</button></form>`;
    }

    function drawList() {
      const all = api.getClaims();
      const list = all.filter((c) => (filter < 0 || c.stage === filter) && (`${c.id} ${c.category} ${c.address} ${c.description}`.toLowerCase().includes(q.toLowerCase())));
      return `<input type="search" id="q" placeholder="Buscar por número, categoría o dirección" value="${esc(q)}" aria-label="Buscar reclamos">
        <div class="chips" style="margin-top:10px"><button class="chip" aria-pressed="${filter === -1}" data-f="-1">Todos</button>${CLAIM_STAGES.map((s, i) => `<button class="chip" aria-pressed="${filter === i}" data-f="${i}">${s}</button>`).join('')}</div>
        ${list.length ? list.map((c) => `<article class="card"><div style="display:flex;justify-content:space-between;gap:8px"><strong>${esc(c.category)}</strong><span class="pill ${c.stage === 3 ? 'ok' : ''}">${CLAIM_STAGES[c.stage]}</span></div>
          <div class="meta">${esc(c.id)} · ${fmtDateTime(c.createdAt)}<br>📍 ${esc(c.address)}</div>
          <p style="margin:6px 0">${esc(c.description)}</p>
          <div class="steps" aria-label="Progreso">${CLAIM_STAGES.map((s, i) => `<div class="${i <= c.stage ? 'done' : ''}">${s}</div>`).join('')}</div>
          ${c.files.length ? `<div class="thumbs">${c.files.map((f) => (f.img ? `<img src="${f.img}" alt="${esc(f.name)}">` : `<span class="doc">📄 ${esc(f.name)}</span>`)).join('')}</div>` : ''}</article>`).join('')
          : `<p class="empty">${all.length ? 'Sin resultados para ese filtro.' : 'Todavía no hiciste reclamos.'}</p>`}`;
    }

    function draw(keepFocus) {
      root.innerHTML = `<div class="tabs" role="tablist"><button role="tab" data-t="new" aria-selected="${tab === 'new'}">Nuevo reclamo</button><button role="tab" data-t="list" aria-selected="${tab === 'list'}">Mis reclamos</button></div>${tab === 'new' ? drawNew() : drawList()}`;
      if (keepFocus) { const i = $('#q', root); i?.focus(); i?.setSelectionRange(q.length, q.length); }
      bind();
    }

    function bind() {
      $$('[data-t]', root).forEach((b) => b.addEventListener('click', () => { tab = b.dataset.t; draw(); }));
      $$('[data-f]', root).forEach((b) => b.addEventListener('click', () => { filter = Number(b.dataset.f); draw(); }));
      $('#q', root)?.addEventListener('input', (e) => { q = e.target.value; draw(true); });
      const f = $('#cf', root);
      if (!f) return;
      $('#gps', root).addEventListener('click', async () => {
        try { coords = await getPosition(); f.address.value ||= `Lat ${coords.lat.toFixed(5)}, Lng ${coords.lng.toFixed(5)}`; toast('Ubicación adjuntada', 'success'); $('#gps', root).textContent = '📍 Usar mi ubicación ✓'; } catch (e) { toast(e.message, 'error'); }
      });
      $('#fi', root).addEventListener('change', async (e) => {
        const picked = [...e.target.files].slice(0, 4 - files.length);
        for (const file of picked) {
          if (file.size > 8e6) { toast(`${file.name} supera 8 MB`, 'error'); continue; }
          try {
            files.push(file.type.startsWith('image/') ? { name: file.name, img: await compress(file) } : { name: file.name, size: file.size });
          } catch (err) { toast(err.message, 'error'); }
        }
        const keep = { c: f.category.value, a: f.address.value, d: f.description.value };
        draw();
        const nf = $('#cf', root); nf.category.value = keep.c; nf.address.value = keep.a; nf.description.value = keep.d;
      });
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const b = f.querySelector('button[type=submit]'); b.disabled = true; b.textContent = 'Enviando...';
        try {
          const c = await api.createClaim({ category: f.category.value, description: f.description.value, address: f.address.value, coords, files });
          files = []; coords = null; tab = 'list';
          toast(`Reclamo ${c.id} registrado`, 'success'); draw();
        } catch (err) { $('#cerr', root).textContent = err.message; b.disabled = false; b.textContent = 'Enviar reclamo'; }
      });
    }

    draw();
    const on = () => { if (tab === 'list' && document.activeElement?.id !== 'q') draw(); };
    api.bus.addEventListener('claims', on);
    return () => api.bus.removeEventListener('claims', on);
  },
};
