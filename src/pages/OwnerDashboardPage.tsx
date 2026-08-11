import { Prospect } from '../types/crm';
import { summarizeProspects } from '../lib/crmProspectList.mjs';
import { buildDashboardCharts } from '../lib/dashboardMetrics.mjs';

const ProspectsIcon = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>;
const UrgentIcon = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 22h20L12 2z"/><line x1="12" y1="10" x2="12" y2="16"/><circle cx="12" cy="19.5" r=".5" fill="currentColor" stroke="none"/></svg>;
const CalendarIcon = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const ReviewIcon = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;

type Props = { prospects: Prospect[] };

const KPI_CARDS = [
  { key: 'total', label: 'Total de prospectos', hint: 'Registrados en el CRM', icon: <ProspectsIcon />, colorClass: 'kpi-green' },
  { key: 'highPriority', label: 'Urgentes', hint: 'Requieren atención inmediata', icon: <UrgentIcon />, colorClass: 'kpi-amber' },
  { key: 'appointments', label: 'Citas agendadas', hint: 'Confirmar y atender', icon: <CalendarIcon />, colorClass: 'kpi-blue' },
  { key: 'manualReview', label: 'Por revisar', hint: 'Información incompleta', icon: <ReviewIcon />, colorClass: 'kpi-violet' },
];

const CHART_LABELS: Record<string, { label: string; colorClass: string }> = {
  attended: { label: 'Atendidos', colorClass: 'chart-green' },
  appointments: { label: 'Citas', colorClass: 'chart-blue' },
  manualReview: { label: 'Revisión', colorClass: 'chart-violet' },
};

export default function OwnerDashboardPage({ prospects }: Props) {
  const summary = summarizeProspects(prospects);
  const charts = buildDashboardCharts(summary);
  const attentionList = prospects.filter((item) => item.intentionLevel === 'Alta' || item.status === 'Cita agendada' || item.status === 'Revisión manual').slice(0, 8);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* KPI Row */}
      <div className="kpi-row">
        {KPI_CARDS.map((card) => {
          const value = summary[card.key as keyof typeof summary] ?? 0;
          return (
            <div className={`kpi-card ${card.colorClass}`} key={card.key}>
              <div className="kpi-icon">{card.icon}</div>
              <div className="kpi-text">
                <span className="kpi-value">{String(value)}</span>
                <span className="kpi-label">{card.label}</span>
                <span className="kpi-hint">{card.hint}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress Rings Row */}
      <div className="rings-row-v2">
        {charts.map((chart) => {
          const cfg = CHART_LABELS[chart.key] || { label: chart.label, colorClass: 'chart-green' };
          const r = 36;
          const circ = 2 * Math.PI * r;
          const offset = circ - (chart.percentage / 100) * circ;
          return (
            <div className={`ring-card-v2 ${cfg.colorClass}`} key={chart.key}>
              <svg width="88" height="88" viewBox="0 0 88 88" className="ring-svg-v2">
                <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(0,0,0,.06)" strokeWidth="6" />
                <circle cx="44" cy="44" r={r} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={circ} strokeDashoffset={offset}
                  transform="rotate(-90 44 44)" style={{ transition: 'stroke-dashoffset .5s ease' }} />
                <text x="44" y="40" textAnchor="middle" className="ring-pct">{chart.percentage}%</text>
                <text x="44" y="56" textAnchor="middle" className="ring-sub">{chart.value}</text>
              </svg>
              <div>
                <strong>{cfg.label}</strong>
                <span>Del total en CRM</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Attention Panel */}
      <div className="attention-panel">
        <div className="attention-header">
          <h2>Requiere tu atención ahora</h2>
          <p>Estos prospectos necesitan seguimiento prioritario</p>
        </div>
        <div className="table-glass-wrap">
          <table className="table-glass">
            <thead><tr><th>Prospecto</th><th>Prioridad</th><th>Estatus</th><th>Acción sugerida</th></tr></thead>
            <tbody>
              {attentionList.length > 0 ? attentionList.map((item) => (
                <tr key={item.id}>
                  <td className="td-name">{item.name}</td>
                  <td><span className={`pill-badge ${item.intentionLevel === 'Alta' ? 'pill-red' : item.intentionLevel === 'Media' ? 'pill-amber' : 'pill-green'}`}>{item.intentionLevel}</span></td>
                  <td>{item.status}</td>
                  <td className="td-action">{item.nextAction}</td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="empty-cell">No hay nada urgente. ¡Buen trabajo!</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
