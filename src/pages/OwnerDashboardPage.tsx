import DecisionCard from '../components/DecisionCard';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import { Followup, Prospect, RecommendedAction } from '../types/crm';

type Props = {
  prospects: Prospect[];
  followups: Followup[];
  recommendedActions: RecommendedAction[];
  historicalMetrics: ReturnType<typeof import('../lib/historicalMetrics').getHistoricalMetrics>;
};

function OwnerDashboardPage({ prospects, followups, recommendedActions, historicalMetrics }: Props) {
  const highIntention = prospects.filter((item) => item.intentionLevel === 'Alta').length;
  const pendingFollowups = followups.filter((item) => !item.completed).length;

  return (
    <div className="page-grid">
      <section className="stats-grid">
        {[
          ['Cobranza esperada mes', `$${historicalMetrics.expectedCollectionMonth.toLocaleString('es-MX')} MXN`],
          ['Clientes atrasados', String(historicalMetrics.clientsOverdue)],
          ['Pagos próximos (7 días)', String(historicalMetrics.upcomingPayments.length)],
          ['% promedio pagado', `${historicalMetrics.averagePaidPercentage}%`],
          ['Prospectos alta intención', String(highIntention)],
          ['Seguimientos pendientes', String(pendingFollowups)],
          ['Lotes libres', String(historicalMetrics.lotsAvailable)],
          ['Lotes vendidos', String(historicalMetrics.lotsSold)],
        ].map(([label, value]) => <StatCard key={label} label={label} value={value} />)}
      </section>

      <SectionCard title="Centro de decisiones" subtitle="Alertas comerciales prioritarias">
        <div className="decision-grid">
          <DecisionCard level="risk" title="Alerta de mayor riesgo" description={historicalMetrics.highestRiskAlert ? `Contrato ${historicalMetrics.highestRiskAlert.contract_id} con ${historicalMetrics.highestRiskAlert.days_overdue} días de atraso.` : 'Sin alertas de riesgo alto.'} />
          <DecisionCard level="opportunity" title="Oportunidad de recuperación" description={`Recuperación estimada: ${historicalMetrics.recoveryOpportunity}% del caso crítico si se atiende hoy.`} />
          <DecisionCard level="high" title="Prioridad alta" description={`${highIntention} prospectos con intención alta en CRM local.`} />
          <DecisionCard level="recommendation" title="Recomendación" description={recommendedActions[0]?.suggestedAction ?? 'Priorizar seguimiento comercial del día.'} />
        </div>
      </SectionCard>

      <SectionCard title="Resumen ejecutivo inteligente">
        <p className="executive-text">
          Capa histórica local activa con fixtures demo v018: {historicalMetrics.totalClients} clientes, {historicalMetrics.collectionRiskAlerts.length} alertas de cobranza y saldo pendiente de ${historicalMetrics.totalPendingBalance.toLocaleString('es-MX')} MXN.
        </p>
      </SectionCard>
    </div>
  );
}

export default OwnerDashboardPage;
