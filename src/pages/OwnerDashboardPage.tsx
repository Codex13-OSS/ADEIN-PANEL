import { useEffect, useMemo, useState } from 'react';
import DecisionCard from '../components/DecisionCard';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import { Followup, Prospect, RecommendedAction } from '../types/crm';
import { useDbSnapshot } from '../context/DbSnapshotContext';
import { deriveLocalPipelineMetrics } from '../lib/crmPipelineLocal';
import { fetchProspectStagingReadonlySnapshot } from '../lib/crmProspectStagingReadonlyApiClient';
import { normalizeProspectStagingReadonlySnapshot, SAFE_STAGING_READONLY_FALLBACK, type StagingReadonlyViewModel } from '../lib/crmProspectStagingReadonlySnapshot';



type BridgeUiState = 'fallback_local' | 'api_snapshot_available';

const READONLY_API_SNAPSHOT_ENDPOINT = (import.meta.env.VITE_CRM_PROSPECT_STAGING_READONLY_SNAPSHOT_URL ?? '').trim();

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
  const readonlyFromAppliedSnapshot = useMemo(() => normalizeProspectStagingReadonlySnapshot(appliedSnapshot), [appliedSnapshot]);
  const [readonlyFromApi, setReadonlyFromApi] = useState<StagingReadonlyViewModel | null>(null);

  useEffect(() => {
    let active = true;
    if (!READONLY_API_SNAPSHOT_ENDPOINT) return () => {
      active = false;
    };

    fetchProspectStagingReadonlySnapshot({ endpointUrl: READONLY_API_SNAPSHOT_ENDPOINT, timeoutMs: 1800 }).then((result) => {
      if (!active) return;
      const isFallback = result === SAFE_STAGING_READONLY_FALLBACK || result.warnings.includes(SAFE_STAGING_READONLY_FALLBACK.warnings[0]);
      setReadonlyFromApi(isFallback ? null : result);
    });

    return () => {
      active = false;
    };
  }, []);

  const bridgeUiState: BridgeUiState = readonlyFromApi ? 'api_snapshot_available' : 'fallback_local';
  const readonlyStaging = readonlyFromApi ?? readonlyFromAppliedSnapshot;

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



      <SectionCard title={readonlyStaging.title} subtitle="Capa preparada para snapshot controlado sin conexión automática desde frontend.">
        <p className="muted"><strong>{readonlyStaging.statusLabel}</strong></p>
        <p className="muted"><strong>Read-only API bridge:</strong> Preparado · Controlado · Sin escritura · Sin producción.</p>
        <p className="muted"><strong>Estado de consumo:</strong> {bridgeUiState === 'api_snapshot_available' ? 'Snapshot API disponible' : 'Fallback local activo'}</p>
        <p className="muted">Bridge read-only preparado (v069): endpoint HTTP controlado server-side, sin conexión directa navegador→MariaDB.</p>
        <p className="muted">Prospectos: {readonlyStaging.cards.totalProspects} · Conversaciones: {readonlyStaging.cards.totalConversations} · Análisis: {readonlyStaging.cards.totalAnalyses}</p>
        <p className="muted">Followups: {readonlyStaging.cards.totalFollowups} · Eventos: {readonlyStaging.cards.totalHistoryEvents} · Sintéticos detectados: {readonlyStaging.cards.syntheticRowsDetected}</p>
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
