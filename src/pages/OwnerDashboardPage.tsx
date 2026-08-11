import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import { Prospect } from '../types/crm';
import { summarizeProspects } from '../lib/crmProspectList.mjs';
import { buildDashboardCharts } from '../lib/dashboardMetrics.mjs';

type Props = {
  prospects: Prospect[];
};

function OwnerDashboardPage({ prospects }: Props) {
  const summary = summarizeProspects(prospects);
  const charts = buildDashboardCharts(summary);
  const attentionList = prospects.filter((item) => item.intentionLevel === 'Alta' || item.status === 'Cita agendada' || item.status === 'Revisión manual').slice(0, 6);

  return (
    <div className="page-grid">
      <SectionCard title="¿Qué necesita tu atención?" subtitle="Resumen en tiempo real de tus prospectos.">
        <p className="muted">Datos del CRM local, sin estimaciones.</p>
      </SectionCard>
      <section className="stats-grid">
        <StatCard label="Total de prospectos" value={String(summary.total)} hint="Registrados en el CRM" />
        <StatCard label="Urgentes" value={String(summary.highPriority)} hint="Prioridad alta" />
        <StatCard label="Citas agendadas" value={String(summary.appointments)} hint="Confirmar y atender" />
        <StatCard label="Por revisar" value={String(summary.manualReview)} hint="Información incompleta" />
      </section>
      <section className="dashboard-chart-grid" aria-label="Distribución actual del CRM">
        {charts.map((chart) => {
          const circumference = 264;
          const progress = (chart.percentage / 100) * circumference;
          return (
            <article className={`dashboard-chart-card dashboard-chart-${chart.tone}`} key={chart.key}>
              <svg className="dashboard-donut" viewBox="0 0 100 100" role="img" aria-label={`${chart.label}: ${chart.percentage}% de los prospectos`}>
                <circle className="dashboard-donut-track" cx="50" cy="50" r="42" />
                <circle className="dashboard-donut-value" cx="50" cy="50" r="42" pathLength="264" strokeDasharray={`${progress} 264`} />
                <text x="50" y="47" className="dashboard-donut-percent">{chart.percentage}%</text>
                <text x="50" y="61" className="dashboard-donut-count">{chart.value} prospectos</text>
              </svg>
              <div><strong>{chart.label}</strong><span>Del total registrado en CRM</span></div>
            </article>
          );
        })}
      </section>
      <SectionCard title="Requiere tu atención ahora" subtitle="Prospectos con prioridad alta, cita o revisión pendiente.">
        <div className="table-premium-wrap">
          <table className="table-premium"><thead><tr><th>Prospecto</th><th>Prioridad</th><th>Estatus</th><th>Próxima acción</th></tr></thead>
            <tbody>{attentionList.length > 0 ? attentionList.map((item) => <tr key={item.id}><td>{item.name}</td><td><span className={`priority-label priority-${item.intentionLevel.toLowerCase()}`}>{item.intentionLevel}</span></td><td>{item.status}</td><td>{item.nextAction}</td></tr>) : <tr><td colSpan={4} className="empty-table-state">No hay nada urgente. ¡Buen trabajo!</td></tr>}</tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

export default OwnerDashboardPage;
