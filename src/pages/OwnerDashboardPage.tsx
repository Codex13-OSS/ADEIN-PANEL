import { useEffect, useMemo, useState } from 'react';
import DecisionCard from '../components/DecisionCard';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import { Followup, Prospect, RecommendedAction } from '../types/crm';
import { useDbSnapshot } from '../context/DbSnapshotContext';
import { deriveLocalPipelineMetrics } from '../lib/crmPipelineLocal';
import { fetchProspectStagingReadonlySnapshot } from '../lib/crmProspectStagingReadonlyApiClient';
import { normalizeProspectStagingReadonlySnapshot, SAFE_STAGING_READONLY_FALLBACK, type StagingReadonlyViewModel } from '../lib/crmProspectStagingReadonlySnapshot';
import { detectLegacyBrokenHistoricalSalesStore, getHistoricalSalesStore } from '../lib/historicalSalesStorage';

type DataFeedUiState = 'demo_local' | 'live_preview_available';

const READONLY_API_SNAPSHOT_ENDPOINT = (import.meta.env.VITE_CRM_PROSPECT_STAGING_READONLY_SNAPSHOT_URL ?? '').trim();

type Props = {
  prospects: Prospect[];
  followups: Followup[];
  historyEventsCount?: number;
  recommendedActions: RecommendedAction[];
  historicalMetrics: ReturnType<typeof import('../lib/historicalMetrics').getHistoricalMetrics>;
  onOpenWhatsAppAnalysis?: () => void;
};

function OwnerDashboardPage({ prospects, followups, historyEventsCount = 0, recommendedActions, historicalMetrics, onOpenWhatsAppAnalysis }: Props) {
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
  const hasLocalData = prospects.length > 0 || followups.length > 0 || historyEventsCount > 0;

  const cards = hasLocalData ? {
    totalProspects: prospects.length,
    totalConversations: prospects.length,
    totalAnalyses: prospects.length,
    totalFollowups: followups.filter((item) => !item.completed).length,
    totalHistoryEvents: historyEventsCount,
  } : {
    totalProspects: dashboardPreview.cards.totalProspects,
    totalConversations: dashboardPreview.cards.totalConversations,
    totalAnalyses: dashboardPreview.cards.totalAnalyses,
    totalFollowups: dashboardPreview.cards.totalFollowups,
    totalHistoryEvents: dashboardPreview.cards.totalHistoryEvents,
  };

  const historicalSales = useMemo(() => getHistoricalSalesStore(), []);
  const brokenLegacyHistorical = detectLegacyBrokenHistoricalSalesStore(historicalSales);
  const pendingFollowups = followups.filter((item) => !item.completed);

  const funnel = [
    { label: 'Contactos', value: cards.totalConversations },
    { label: 'Calificados', value: cards.totalAnalyses },
    { label: 'Visitas', value: Math.max(0, Math.round(cards.totalAnalyses * 0.5)) },
    { label: 'Propuestas', value: Math.max(0, Math.round(cards.totalAnalyses * 0.35)) },
    { label: 'Cierres', value: Math.max(0, Math.round(cards.totalAnalyses * 0.2)) },
  ];
  const funnelMax = Math.max(...funnel.map((step) => step.value), 1);

  const recentProspects = prospects.slice(-5).reverse();

  const propertyPerformance = historicalSales && !brokenLegacyHistorical
    ? historicalSales.summary.topProperties.slice(0, 4).map((item, index) => ({
      name: item.name,
      score: Math.max(10, 100 - index * 18),
    }))
    : historicalMetrics.properties.slice(0, 4).map((item, index) => ({
      name: item,
      score: Math.max(10, 100 - index * 18),
    }));

  return (
    <div className="page-grid dashboard-premium-grid">
      <SectionCard title="Panel comercial ADEIN" subtitle="Vista comercial con CRM local activo e histórico desde Excel.">
        <div className="inline-actions">
          <span className="badge badge-success">En operación</span>
          <span className="badge badge-success">Beta comercial</span>
          <span className="badge">Datos locales activos</span>
        </div>
      </SectionCard>

      <section className="stats-grid metrics-top-grid">
        <StatCard label="Clientes actuales" value={String(historicalSales?.summary.currentClients ?? historicalMetrics.totalClients ?? 0)} hint="Histórico desde Excel" accent="#08733B" />
        <StatCard label="Lotes libres" value={String(historicalSales?.summary.freeLots ?? historicalMetrics.lotsAvailable ?? 0)} hint="Disponibilidad comercial" accent="#7BAA92" />
        <StatCard label="Prospectos activos" value={String(cards.totalProspects)} hint="CRM local activo" accent="#5D8F76" />
        <StatCard label="Seguimientos pendientes" value={String(cards.totalFollowups)} hint="Atención del día" accent="#B68A2C" />
      </section>

      <section className="dashboard-main-grid">
        <SectionCard title="Embudo de conversión" subtitle="Contactos a cierres con datos locales activos.">
          <div className="funnel-premium">
            {funnel.map((step) => (
              <div key={step.label} className="funnel-row">
                <div className="funnel-meta">
                  <strong>{step.label}</strong>
                  <span>{step.value}</span>
                </div>
                <div className="funnel-track"><span style={{ width: `${Math.max(6, Math.round((step.value / funnelMax) * 100))}%` }} /></div>
              </div>
            ))}
          </div>

          <div className="table-premium-wrap">
            <table className="table-premium">
              <thead>
                <tr><th>Prospecto</th><th>Predio</th><th>Estatus</th></tr>
              </thead>
              <tbody>
                {recentProspects.length > 0 ? recentProspects.map((item) => (
                  <tr key={item.id}><td>{item.name}</td><td>{item.property}</td><td>{item.status}</td></tr>
                )) : <tr><td colSpan={3}>Información cargada en este navegador.</td></tr>}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Decisiones del día" subtitle="Prioridades comerciales para ejecutar hoy.">
          <div className="decision-grid">
            <DecisionCard level="risk" title="Seguimiento vencido" description={pendingFollowups[0] ? `${pendingFollowups[0].prospectName} · ${pendingFollowups[0].suggestedTime}` : 'Sin seguimientos vencidos en la carga local.'} />
            <DecisionCard level="opportunity" title="Prospecto listo para cierre" description={localMetrics.highIntentionProspects > 0 ? `${localMetrics.highIntentionProspects} prospectos con alta intención.` : 'Sin prospectos de cierre inmediato.'} />
            <DecisionCard level="high" title="Actualizar estatus del CRM" description={recommendedActions[0]?.suggestedAction ?? 'Registrar estatus y notas del contacto actual.'} />
          </div>
          <button type="button" className="btn-primary" onClick={() => onOpenWhatsAppAnalysis?.()}>Ir a CRM ventas</button>
          <p className="muted">{dataFeedUiState === 'live_preview_available' ? 'Vista comercial activa.' : 'Información cargada en este navegador.'}</p>
        </SectionCard>
      </section>

      <section className="dashboard-bottom-grid">
        <SectionCard title="Rendimiento de predios" subtitle="Referencia comercial del portafolio activo.">
          <div className="funnel-premium">
            {propertyPerformance.map((item) => (
              <div key={item.name} className="funnel-row">
                <div className="funnel-meta"><strong>{item.name}</strong><span>{item.score}%</span></div>
                <div className="funnel-track"><span style={{ width: `${item.score}%` }} /></div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Histórico comercial" subtitle="Resumen compacto del histórico desde Excel.">
          {!historicalSales || brokenLegacyHistorical ? <p className="muted">Histórico desde Excel pendiente de recarga.</p> : (
            <div className="mini-kpi-grid">
              <StatCard label="Base histórica" value={String(historicalSales.summary.totalRows)} hint="Clientes actuales" />
              <StatCard label="Con teléfono" value={String(historicalSales.summary.clientsWithPhone)} hint="Contacto válido" />
              <StatCard label="Lotes libres" value={String(historicalSales.summary.freeLots)} hint="Inventario" />
              <StatCard label="Predios" value={String(historicalSales.summary.totalProperties ?? historicalSales.summary.topProperties.length)} hint="Cobertura" />
            </div>
          )}
        </SectionCard>
      </section>
    </div>
  );
}

export default OwnerDashboardPage;
