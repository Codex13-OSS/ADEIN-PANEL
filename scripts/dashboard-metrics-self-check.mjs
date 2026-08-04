import assert from 'node:assert/strict';
import { buildDashboardCharts } from '../src/lib/dashboardMetrics.mjs';

const charts = buildDashboardCharts({ total: 8, highPriority: 2, appointments: 1, manualReview: 0, attended: 5 });
assert.deepEqual(charts.map((chart) => chart.percentage), [63, 13, 0]);
assert.deepEqual(charts.map((chart) => chart.value), [5, 1, 0]);
assert.deepEqual(charts.map((chart) => chart.label), ['Prospectos atendidos', 'Citas agendadas', 'Revisión manual']);
assert.deepEqual(buildDashboardCharts({ total: 0, highPriority: 0, appointments: 0, manualReview: 0, attended: 0 }).map((chart) => chart.percentage), [0, 0, 0]);

console.log(JSON.stringify({ ok: true, checks: ['dashboard_chart_percentages', 'zero_prospect_chart_state'] }));
