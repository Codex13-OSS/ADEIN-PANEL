import { useEffect, useMemo, useState } from 'react';
import DecisionCard from '../components/DecisionCard';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import { Followup, Prospect, RecommendedAction } from '../types/crm';
import { useDbSnapshot } from '../context/DbSnapshotContext';
import { deriveLocalPipelineMetrics } from '../lib/crmPipelineLocal';
import { fetchProspectStagingReadonlySnapshot } from '../lib/crmProspectStagingReadonlyApiClient';
import { normalizeProspectStagingReadonlySnapshot, SAFE_STAGING_READONLY_FALLBACK, type StagingReadonlyViewModel } from '../lib/crmProspectStagingReadonlySnapshot';

type DataFeedUiState = 'demo_local' | 'live_preview_available';

const READONLY_API_SNAPSHOT_ENDPOINT = (import.meta.env.VITE_CRM_PROSPECT_STAGING_READONLY_SNAPSHOT_URL ?? '').trim();

type Props = {
  prospects: Prospect[];
  followups: Followup[];
  recommendedActions: RecommendedAction[];
  historicalMetrics: ReturnType<typeof import('../lib/historicalMetrics').getHistoricalMetrics>;
  onOpenWhatsAppAnalysis?: () => void;
};

function OwnerDashboardPage({ prospects, followups, recommendedActions, historicalMetrics, onOpenWhatsAppAnalysis }: Props) {
  const localMetrics = deriveLocalPipelineMetrics(prospects, followups, []);
  const { appliedSnapshot } = useDbSnapshot();
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

  const dataFeedUiState: DataFeedUiState = readonlyFromApi ? 'live_preview_available' : 'demo_local';
  const dashboardPreview = readonlyFromApi ?? readonlyFromAppliedSnapshot;
  const latestProspect = prospects[prospects.length - 1] ?? null;
  const nextPendingFollowup = followups.find((item) => !item.completed) ?? null;

  return (
    <div className="page-grid">
      <SectionCard title="Panel comercial ADEIN" subtitle="Vista ejecutiva de prospectos y actividad comercial.">
        <p className="muted"><strong>Demo con datos simulados.</strong> No contiene datos reales todavía.</p>
      </SectionCard>

      <section className="stats-grid">
        {[
          ['Prospectos nuevos', String(dashboardPreview.cards.totalProspects)],
          ['Conversaciones cargadas', String(dashboardPreview.cards.totalConversations)],
          ['Análisis listos', String(dashboardPreview.cards.totalAnalyses)],
          ['Seguimientos pendientes', String(dashboardPreview.cards.totalFollowups)],
          ['Actividad registrada', String(dashboardPreview.cards.totalHistoryEvents)],
        ].map(([label, value]) => <StatCard key={label} label={label} value={value} />)}
      </section>

      <SectionCard title="Análisis de WhatsApp" subtitle="CRM > Analizar WhatsApp es la fuente de captura de conversaciones.">
        <p className="muted">Los archivos .txt se cargan desde CRM &gt; Analizar WhatsApp.</p>
        <p className="muted">Aquí verás el resumen de prospectos, conversaciones y seguimientos.</p>
        <p className="muted"><strong>Último prospecto:</strong> {latestProspect ? `${latestProspect.name} · ${latestProspect.status}` : 'Sin prospectos nuevos todavía.'}</p>
        <p className="muted"><strong>Próximo seguimiento:</strong> {nextPendingFollowup ? `${nextPendingFollowup.prospectName} · ${nextPendingFollowup.suggestedTime}` : 'Sin seguimientos pendientes.'}</p>
        <button type="button" className="btn-primary" onClick={() => onOpenWhatsAppAnalysis?.()}>
          Analizar conversaciones en CRM
        </button>
        {!onOpenWhatsAppAnalysis ? <p className="muted">Abre CRM ventas y entra a Analizar WhatsApp.</p> : null}
      </SectionCard>

      <SectionCard title="Centro de decisiones" subtitle="Alertas comerciales prioritarias">
        <div className="decision-grid">
          <DecisionCard level="risk" title="Alerta de mayor riesgo" description={historicalMetrics.highestRiskAlert ? `Contrato ${historicalMetrics.highestRiskAlert.contract_id} con ${historicalMetrics.highestRiskAlert.days_overdue} días de atraso.` : 'Sin alertas de riesgo alto.'} />
          <DecisionCard level="opportunity" title="Oportunidad de recuperación" description={`Recuperación estimada: ${historicalMetrics.recoveryOpportunity}% del caso crítico si se atiende hoy.`} />
          <DecisionCard level="high" title="Prioridad alta" description={`${localMetrics.highIntentionProspects} prospectos con intención alta para atención comercial.`} />
          <DecisionCard level="recommendation" title="Recomendación" description={recommendedActions[0]?.suggestedAction ?? 'Priorizar seguimiento comercial del día.'} />
        </div>
      </SectionCard>

      <SectionCard title="Etapa actual" subtitle="Dashboard maestro como resumen ejecutivo.">
        <p className="muted">El análisis detallado de conversaciones se realiza en CRM &gt; Analizar WhatsApp.</p>
        <p className="muted"><strong>Estado de vista previa:</strong> {dataFeedUiState === 'live_preview_available' ? 'Vista previa de datos disponible' : 'Vista previa simulada activa'}</p>
        <p className="muted"><strong>Demo con datos simulados.</strong> No contiene datos reales todavía.</p>
      </SectionCard>
    </div>
  );
}

export default OwnerDashboardPage;
