import DecisionCard from '../components/DecisionCard';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import { Followup, Prospect, RecommendedAction } from '../types/crm';
import { useDbSnapshot } from '../context/DbSnapshotContext';
import { deriveLocalPipelineMetrics } from '../lib/crmPipelineLocal';

type Props = {
  prospects: Prospect[];
  followups: Followup[];
  recommendedActions: RecommendedAction[];
  historicalMetrics: ReturnType<typeof import('../lib/historicalMetrics').getHistoricalMetrics>;
};

function OwnerDashboardPage({ prospects, followups, recommendedActions, historicalMetrics }: Props) {
  const localMetrics = deriveLocalPipelineMetrics(prospects, followups, []);
  const { appliedSnapshot } = useDbSnapshot();
  const syntheticSnapshot = appliedSnapshot as (typeof appliedSnapshot & { syntheticToken?: string; counts?: Record<string, number>; relationship?: Record<string, unknown> }) | null;

  return (
    <div className="page-grid">
      <SectionCard title="CRM local activo" subtitle="Los prospectos guardados desde WhatsApp actualizan esta vista en localStorage.">
        <p className="muted">Esta capa no escribe en BD real en v062. Sirve para operación comercial local/readiness.</p>
      </SectionCard>

      <section className="stats-grid">
        {[
          ['Prospectos activos (CRM local)', String(localMetrics.activeProspects)],
          ['Prospectos alta intención (CRM local)', String(localMetrics.highIntentionProspects)],
          ['Seguimientos pendientes (CRM local)', String(localMetrics.pendingFollowups)],
          ['Seguimientos vencidos (CRM local)', String(localMetrics.overdueFollowups)],
          ['Cobranza esperada mes (demo/histórico)', `$${historicalMetrics.expectedCollectionMonth.toLocaleString('es-MX')} MXN`],
          ['Clientes atrasados (demo/histórico)', String(historicalMetrics.clientsOverdue)],
          ['Lotes libres (demo/histórico)', String(historicalMetrics.lotsAvailable)],
          ['Lotes vendidos (demo/histórico)', String(historicalMetrics.lotsSold)],
        ].map(([label, value]) => <StatCard key={label} label={label} value={value} />)}
      </section>

      <SectionCard title="Centro de decisiones" subtitle="Alertas comerciales prioritarias">
        <div className="decision-grid">
          <DecisionCard level="risk" title="Alerta de mayor riesgo" description={historicalMetrics.highestRiskAlert ? `Contrato ${historicalMetrics.highestRiskAlert.contract_id} con ${historicalMetrics.highestRiskAlert.days_overdue} días de atraso.` : 'Sin alertas de riesgo alto.'} />
          <DecisionCard level="opportunity" title="Oportunidad de recuperación" description={`Recuperación estimada: ${historicalMetrics.recoveryOpportunity}% del caso crítico si se atiende hoy.`} />
          <DecisionCard level="high" title="Prioridad alta" description={`${localMetrics.highIntentionProspects} prospectos con intención alta en CRM local.`} />
          <DecisionCard level="recommendation" title="Recomendación" description={recommendedActions[0]?.suggestedAction ?? 'Priorizar seguimiento comercial del día.'} />
        </div>
      </SectionCard>

      <SectionCard title="Snapshot BD read-only" subtitle="Puente controlado desde Configuración">
        {!appliedSnapshot ? (
          <p className="muted">Sin snapshot aplicado. Genera npm run db:snapshot y aplícalo desde Configuración.</p>
        ) : (
          <>
            <p className="muted">Snapshot aplicado manualmente. Es lectura controlada; no hay escritura MariaDB desde navegador.</p>
            <p className="muted"><strong>database:</strong> {appliedSnapshot.database}</p>
            <p className="muted"><strong>mode:</strong> {appliedSnapshot.mode}</p>
            <p className="muted"><strong>writesEnabled:</strong> {String(appliedSnapshot.writesEnabled)}</p>
            <p className="muted"><strong>generatedAt:</strong> {appliedSnapshot.generatedAt}</p>
            {appliedSnapshot.mode === 'read_only_synthetic_dashboard' ? (
              <>
                <p className="muted"><strong>Estado:</strong> READ-ONLY / STAGING / SYNTHETIC</p>
                <p className="muted"><strong>Datos sintéticos persistidos:</strong> NO REAL</p>
                <p className="muted"><strong>Token:</strong> {syntheticSnapshot?.syntheticToken ?? 'n/a'}</p>
              </>
            ) : null}
          </>
        )}
      </SectionCard>
    </div>
  );
}

export default OwnerDashboardPage;
