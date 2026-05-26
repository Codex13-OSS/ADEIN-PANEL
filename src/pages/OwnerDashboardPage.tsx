import DecisionCard from '../components/DecisionCard';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import { Followup, Prospect, RecommendedAction } from '../types/crm';
import { useDbSnapshot } from '../context/DbSnapshotContext';

type Props = {
  prospects: Prospect[];
  followups: Followup[];
  recommendedActions: RecommendedAction[];
  historicalMetrics: ReturnType<typeof import('../lib/historicalMetrics').getHistoricalMetrics>;
};

function OwnerDashboardPage({ prospects, followups, recommendedActions, historicalMetrics }: Props) {
  const highIntention = prospects.filter((item) => item.intentionLevel === 'Alta').length;
  const pendingFollowups = followups.filter((item) => !item.completed).length;
  const { appliedSnapshot } = useDbSnapshot();
  const syntheticSnapshot = appliedSnapshot as (typeof appliedSnapshot & { syntheticToken?: string; counts?: Record<string, number>; relationship?: Record<string, unknown> }) | null;

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


      <SectionCard title="Snapshot BD read-only" subtitle="Puente controlado desde Configuración">
        {!appliedSnapshot ? (
          <p className="muted">Sin snapshot aplicado. Genera npm run db:snapshot y aplícalo desde Configuración.</p>
        ) : (
          <>
            <p className="muted">Esta sección usa un snapshot aplicado manualmente desde Configuración. No conecta con MariaDB desde el navegador.</p>
            <p className="muted"><strong>database:</strong> {appliedSnapshot.database}</p>
            <p className="muted"><strong>mode:</strong> {appliedSnapshot.mode}</p>
            <p className="muted"><strong>writesEnabled:</strong> {String(appliedSnapshot.writesEnabled)}</p>
            <p className="muted"><strong>generatedAt:</strong> {appliedSnapshot.generatedAt}</p>
            {appliedSnapshot.mode === 'read_only_synthetic_dashboard' ? (
              <>
                <p className="muted"><strong>Estado:</strong> READ-ONLY / STAGING / SYNTHETIC</p>
                <p className="muted"><strong>Datos sintéticos persistidos:</strong> NO REAL</p>
                <p className="muted"><strong>Token:</strong> {syntheticSnapshot?.syntheticToken ?? 'n/a'}</p>
                <ul style={{ paddingLeft: 18 }}>
                  <li>Conteos: {JSON.stringify(syntheticSnapshot?.counts ?? {})}</li>
                  <li>Propiedad sintética: {JSON.stringify(syntheticSnapshot?.relationship?.property ?? null)}</li>
                  <li>Lote sintético: {JSON.stringify(syntheticSnapshot?.relationship?.lot ?? null)}</li>
                  <li>Cliente sintético: {JSON.stringify(syntheticSnapshot?.relationship?.client ?? null)}</li>
                  <li>Contrato sintético: {JSON.stringify(syntheticSnapshot?.relationship?.contract ?? null)}</li>
                  <li>Pago programado sintético: {JSON.stringify(syntheticSnapshot?.relationship?.paymentSchedule ?? null)}</li>
                </ul>
              </>
            ) : (
            <ul style={{ paddingLeft: 18 }}>
              <li>Clientes: {appliedSnapshot.summaryCards.clients.value}</li>
              <li>Lotes: {appliedSnapshot.summaryCards.lots.value}</li>
              <li>Contratos: {appliedSnapshot.summaryCards.contracts.value}</li>
              <li>Cobranza esperada: {appliedSnapshot.summaryCards.expectedCollection.value} {appliedSnapshot.summaryCards.expectedCollection.currency ?? ''}</li>
              <li>Cobranza pendiente: {appliedSnapshot.summaryCards.pendingCollection.value} {appliedSnapshot.summaryCards.pendingCollection.currency ?? ''}</li>
            </ul>
            )}
            <h4>Warnings</h4>
            {appliedSnapshot.warnings.length === 0 ? <p className="muted">Sin warnings.</p> : (
              <ul style={{ paddingLeft: 18 }}>{appliedSnapshot.warnings.map((item) => <li key={item}>⚠️ {item}</li>)}</ul>
            )}
          </>
        )}
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
