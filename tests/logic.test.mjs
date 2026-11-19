import test from 'node:test';
import assert from 'node:assert/strict';
import {
  haversine, sortByDistance, fmtDist, parkingCost, isRegulated, pointInRect, formatCountdown, taxStatus, surcharge, totalDue,
  luhn, validExpiry, validPlate, claimStage, daysUntil,
} from '../js/logic.js';

const SCHEDULE = [{ days: [1, 2, 3, 4, 5], from: 8, to: 20 }, { days: [6], from: 8, to: 13 }];

test('haversine: distancia nula y distancia conocida', () => {
  assert.equal(haversine({ lat: 0, lng: 0 }, { lat: 0, lng: 0 }), 0);
  const d = haversine({ lat: -31.4275, lng: -62.0827 }, { lat: -31.4375, lng: -62.0827 });
  assert.ok(d > 1100 && d < 1120, `d=${d}`);
});
test('sortByDistance ordena por cercanía', () => {
  const r = sortByDistance([{ id: 'far', lat: -31.5, lng: -62 }, { id: 'near', lat: -31.4276, lng: -62.0828 }], { lat: -31.4275, lng: -62.0827 });
  assert.equal(r[0].id, 'near');
});
test('fmtDist', () => { assert.equal(fmtDist(450), '450 m'); assert.equal(fmtDist(1500), '1.5 km'); });
test('parkingCost cobra por bloques de 15 min', () => {
  assert.equal(parkingCost(60, 600), 600);
  assert.equal(parkingCost(15, 600), 150);
  assert.equal(parkingCost(16, 600), 300);
  assert.equal(parkingCost(0, 600), 0);
});
test('isRegulated respeta días y horarios', () => {
  assert.equal(isRegulated(new Date(2026, 10, 18, 10, 0), SCHEDULE), true); // miércoles
  assert.equal(isRegulated(new Date(2026, 10, 18, 21, 0), SCHEDULE), false);
  assert.equal(isRegulated(new Date(2026, 10, 21, 12, 0), SCHEDULE), true); // sábado
  assert.equal(isRegulated(new Date(2026, 10, 21, 14, 0), SCHEDULE), false);
  assert.equal(isRegulated(new Date(2026, 10, 22, 10, 0), SCHEDULE), false); // domingo
});
test('pointInRect', () => {
  const b = { south: -2, north: 2, west: -2, east: 2 };
  assert.equal(pointInRect({ lat: 0, lng: 0 }, b), true);
  assert.equal(pointInRect({ lat: 3, lng: 0 }, b), false);
});
test('formatCountdown', () => { assert.equal(formatCountdown(65000), '01:05'); assert.equal(formatCountdown(3725000), '1:02:05'); assert.equal(formatCountdown(-5), '00:00'); });
test('estado de cedulón, recargo y total', () => {
  const now = new Date(2026, 10, 18, 12);
  const due = { amount: 1000, dueDate: '2026-11-25' };
  const over = { amount: 1000, dueDate: '2026-10-01' };
  assert.equal(taxStatus(due, now), 'due');
  assert.equal(taxStatus(over, now), 'overdue');
  assert.equal(taxStatus({ ...over, paidAt: 1 }, now), 'paid');
  assert.equal(surcharge(due, now), 0);
  assert.equal(surcharge(over, now), 40); // 2 meses de mora al 2%
  assert.equal(totalDue(over, now), 1040);
  assert.equal(daysUntil('2026-11-25', now), 7);
});
test('luhn', () => {
  assert.equal(luhn('4242 4242 4242 4242'), true);
  assert.equal(luhn('4242 4242 4242 4241'), false);
  assert.equal(luhn('abc'), false);
});
test('validExpiry', () => {
  const now = new Date(2026, 10, 18);
  assert.equal(validExpiry('12/26', now), true);
  assert.equal(validExpiry('10/26', now), false);
  assert.equal(validExpiry('13/30', now), false);
  assert.equal(validExpiry('1230', now), false);
});
test('validPlate (formatos argentinos)', () => {
  assert.equal(validPlate('AB123CD'), true);
  assert.equal(validPlate('abc123'), true);
  assert.equal(validPlate('AB 123 CD'), true);
  assert.equal(validPlate('1234567'), false);
});
test('claimStage avanza con el tiempo', () => {
  const t0 = 1_000_000;
  assert.equal(claimStage(t0, t0), 0);
  assert.equal(claimStage(t0, t0 + 25_000), 1);
  assert.equal(claimStage(t0, t0 + 70_000), 2);
  assert.equal(claimStage(t0, t0 + 999_000), 3);
});
