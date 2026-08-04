import assert from 'node:assert/strict';
import { filterProspects, summarizeProspects } from '../src/lib/crmProspectList.mjs';

const prospects = [
  { id: '1', name: 'Ana Cedros', phone: '5511111111', property: 'Cedros', status: 'Nuevo', seller: 'Vendedor 1', lastContact: '2026-08-03T10:00:00Z', nextAction: 'Llamar hoy', intentionLevel: 'Alta' },
  { id: '2', name: 'Luis Norte', phone: '5522222222', property: 'Norte', status: 'Cita agendada', seller: 'Vendedor 1', lastContact: '2026-08-02T10:00:00Z', nextAction: 'Confirmar visita', intentionLevel: 'Media' },
  { id: '3', name: 'Mara Sur', phone: '5533333333', property: 'Sur', status: 'Revisión manual', seller: 'Vendedor 1', lastContact: '2026-08-01T10:00:00Z', nextAction: 'Validar teléfono', intentionLevel: 'Baja' },
];

assert.deepEqual(
  filterProspects(prospects, { query: 'cedros', status: 'Todos', priority: 'Todas' }).map((item) => item.id),
  ['1'],
);
assert.deepEqual(
  filterProspects(prospects, { query: '', status: 'Cita agendada', priority: 'Media' }).map((item) => item.id),
  ['2'],
);
assert.deepEqual(summarizeProspects(prospects), { total: 3, highPriority: 1, appointments: 1, manualReview: 1, attended: 1 });

console.log(JSON.stringify({ ok: true, checks: ['text_search', 'status_priority_filters', 'operational_summary'] }));
