import * as api from '../api.js';
import { taxStatus, daysUntil, surcharge, totalDue, barcodeBars } from '../logic.js';
import { $, $$, esc, money, fmtDate, fmtDateTime, toast, sheet, payFlow } from '../ui.js';

const STATUS = {
  paid: ['Pagado', 'ok'], due: ['A vencer', 'warn'], overdue: ['Vencido', 'bad'],
};

function receiptSheet(c) {
  const code = `${c.id.replace(/\W/g, '')}${Math.round(totalDue(c) * 100)}`.padEnd(24, '0');
  const bars = barcodeBars(code).map((w, i) => `<i class="${i % 2 ? 'gap' : ''}" style="width:${w * 1.6}px"></i>`).join('');
  const s = sheet(`<div class="receipt">
      <h2>Cedulón de pago</h2>
      <p><strong>${esc(c.tax)}</strong><br>${esc(c.period)}</p>
      <p>Contribuyente: ${esc(api.getTaxState().user?.id)}<br>Vencimiento: ${fmtDate(c.dueDate)}</p>
      <p>Importe: ${money(c.amount)}<br>Recargo por mora: ${money(surcharge(c))}<br><strong>Total: ${money(totalDue(c))}</strong></p>
      <div class="barcode" aria-hidden="true">${bars}</div><small>${code}</small>
      <p><small>Documento simulado con fines académicos. Sin validez fiscal.</small></p>
    </div>
    <button class="btn primary block noprint" id="print" style="margin-top:12px">Imprimir / Guardar PDF</button>`);
  $('#print', s.el).addEventListener('click', () => window.print());
}

export default {
  title: 'Tributos municipales',
  render(root) {
    let tab = 'pend';

    function draw() {
      const { user, cedulones, payments } = api.getTaxState();
      if (!user) {
        root.innerHTML = `<form class="card" id="qf" novalidate>
          <h2>Consultá tus tributos</h2>
          <p class="hint">Ingresá tu DNI, CUIT o número de partida para ver tus cedulones y tu estado de deuda.</p>
          <label>DNI, CUIT o partida<input name="id" inputmode="text" autocomplete="off" placeholder="Ej: 30123456" required></label>
          <p class="err" id="qerr" role="alert"></p>
          <button class="btn primary block" type="submit">Consultar</button></form>`;
        $('#qf', root).addEventListener('submit', async (e) => {
          e.preventDefault();
          const b = e.target.querySelector('button'); b.disabled = true; b.textContent = 'Consultando...';
          try { await api.queryTaxes(e.target.id.value); } catch (err) { $('#qerr', root).textContent = err.message; b.disabled = false; b.textContent = 'Consultar'; }
        });
        return;
      }
      const pend = cedulones.filter((c) => !c.paidAt);
      const debt = pend.reduce((a, c) => a + totalDue(c), 0);
      const overdue = pend.filter((c) => taxStatus(c) === 'overdue').length;
      root.innerHTML = `
        <section class="card"><div class="meta">Contribuyente ${esc(user.id)} · <a href="#" id="out">cambiar</a></div>
          <h2 style="margin-top:6px">${money(debt)}</h2>
          <span class="pill ${overdue ? 'bad' : pend.length ? 'warn' : 'ok'}">${overdue ? `${overdue} vencido(s)` : pend.length ? `${pend.length} pendiente(s)` : 'Sin deuda'}</span></section>
        <div class="tabs" role="tablist"><button role="tab" data-t="pend" aria-selected="${tab === 'pend'}">Pendientes</button><button role="tab" data-t="hist" aria-selected="${tab === 'hist'}">Historial de pagos</button></div>
        ${tab === 'pend' ? (pend.length ? pend.map((c) => {
          const st = taxStatus(c); const d = daysUntil(c.dueDate);
          return `<article class="card" data-id="${c.id}"><div style="display:flex;justify-content:space-between;gap:8px"><div><strong>${esc(c.tax)}</strong><div class="meta">${esc(c.period)} · vence ${fmtDate(c.dueDate)}</div></div><span class="pill ${STATUS[st][1]}">${STATUS[st][0]}</span></div>
            <p style="margin:8px 0">${money(totalDue(c))}${st === 'overdue' ? ` <small class="meta">(incluye recargo ${money(surcharge(c))})</small>` : d <= 7 ? ` <small class="meta">vence en ${d} día(s)</small>` : ''}</p>
            <div class="row2"><button class="btn" data-a="emit">Emitir cedulón</button><button class="btn primary" data-a="pay">Pagar online</button></div></article>`;
        }).join('') : '<p class="empty">No tenés cedulones pendientes. 🎉</p>')
        : (payments.length ? payments.map((p) => `<article class="card"><strong>${esc(p.tax)}</strong><div class="meta">${esc(p.period)} · ${fmtDateTime(p.ts)}</div><div>${money(p.amount)} · ${esc(p.method)}</div><small class="meta">Comprobante ${esc(p.id)}</small></article>`).join('') : '<p class="empty">Todavía no hay pagos registrados.</p>')}
        <p class="hint">Recordatorios de vencimiento: se envían como notificación cuando faltan 7 días o menos (podés desactivarlos en Notificaciones).</p>`;
    }

    draw();
    root.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-t]'); if (t) { tab = t.dataset.t; draw(); return; }
      if (e.target.id === 'out') { e.preventDefault(); api.logoutTax(); return; }
      const a = e.target.closest('[data-a]'); if (!a) return;
      const id = a.closest('[data-id]').dataset.id;
      const c = api.getTaxState().cedulones.find((x) => x.id === id);
      if (a.dataset.a === 'emit') receiptSheet(c);
      if (a.dataset.a === 'pay') {
        const r = await payFlow({ title: 'Pago de tributo', amount: totalDue(c), summary: `<p><strong>${esc(c.tax)}</strong><br>${esc(c.period)}</p>`, pay: (card) => api.payCedulon(id, card) });
        if (r) toast(`Pago acreditado. Comprobante ${r.id}`, 'success');
      }
    });
    const on = () => draw();
    api.bus.addEventListener('tax', on);
    return () => api.bus.removeEventListener('tax', on);
  },
};
