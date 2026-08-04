import assert from 'node:assert/strict';
import { iconForLabel } from '../src/lib/cardIconMap.mjs';

assert.equal(iconForLabel('Prospectos'), 'users');
assert.equal(iconForLabel('Citas agendadas'), 'calendar');
assert.equal(iconForLabel('Revisión manual'), 'review');
assert.equal(iconForLabel('Prospectos atendidos'), 'check');
assert.equal(iconForLabel('Sin icono'), 'spark');
console.log(JSON.stringify({ ok: true, checks: ['card_icon_mapping'] }));
