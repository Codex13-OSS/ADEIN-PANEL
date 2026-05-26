import { useEffect, useMemo, useState } from 'react';
import DecisionCard from '../components/DecisionCard';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import { Followup, Prospect, RecommendedAction } from '../types/crm';
import { useDbSnapshot } from '../context/DbSnapshotContext';
import { deriveLocalPipelineMetrics } from '../lib/crmPipelineLocal';
import { fetchProspectStagingReadonlySnapshot } from '../lib/crmProspectStagingReadonlyApiClient';
import { normalizeProspectStagingReadonlySnapshot, SAFE_STAGING_READONLY_FALLBACK, type StagingReadonlyViewModel } from '../lib/crmProspectStagingReadonlySnapshot';
import { WHATSAPP_TXT_DEMO_V077 } from '../fixtures/whatsappTxtDemoV077';
import { parseWhatsappTxtPreview, type WhatsappTxtPreviewResult } from '../lib/whatsappTxtPreviewParser';

type DataFeedUiState = 'demo_local' | 'live_preview_available';

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
  const readonlyFromAppliedSnapshot = useMemo(() => normalizeProspectStagingReadonlySnapshot(appliedSnapshot), [appliedSnapshot]);
  const [readonlyFromApi, setReadonlyFromApi] = useState<StagingReadonlyViewModel | null>(null);
  const [whatsappPreview, setWhatsappPreview] = useState<WhatsappTxtPreviewResult | null>(null);

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

  return (
    <div className="page-grid">
      <SectionCard title="Panel comercial ADEIN" subtitle="Vista previa para seguimiento de prospectos y conversaciones de WhatsApp.">
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

      <SectionCard title="Centro de decisiones" subtitle="Alertas comerciales prioritarias">
        <div className="decision-grid">
          <DecisionCard level="risk" title="Alerta de mayor riesgo" description={historicalMetrics.highestRiskAlert ? `Contrato ${historicalMetrics.highestRiskAlert.contract_id} con ${historicalMetrics.highestRiskAlert.days_overdue} días de atraso.` : 'Sin alertas de riesgo alto.'} />
          <DecisionCard level="opportunity" title="Oportunidad de recuperación" description={`Recuperación estimada: ${historicalMetrics.recoveryOpportunity}% del caso crítico si se atiende hoy.`} />
          <DecisionCard level="high" title="Prioridad alta" description={`${localMetrics.highIntentionProspects} prospectos con intención alta para atención comercial.`} />
          <DecisionCard level="recommendation" title="Recomendación" description={recommendedActions[0]?.suggestedAction ?? 'Priorizar seguimiento comercial del día.'} />
        </div>
      </SectionCard>



      <SectionCard title="Etapa actual" subtitle="Demo comercial operativa para dueño y vendedor.">
        <p className="muted">Esta versión usa datos simulados para validar el flujo antes de conectar conversaciones reales.</p>
        <p className="muted">Próximo paso: cargar archivos .txt exportados de WhatsApp para llenar este panel automáticamente.</p>
        <p className="muted"><strong>Estado de vista previa:</strong> {dataFeedUiState === 'live_preview_available' ? 'Vista previa de datos disponible' : 'Vista previa simulada activa'}</p>
        <p className="muted"><strong>Demo con datos simulados.</strong> No contiene datos reales todavía.</p>
      </SectionCard>

      <SectionCard title="Qué podrá ver el vendedor" subtitle="Operación diaria orientada a cierre.">
        <ul className="muted">
          <li>Prospectos que llegaron por WhatsApp.</li>
          <li>Qué cliente necesita seguimiento.</li>
          <li>Qué conversación está caliente o fría (simulación de análisis).</li>
          <li>Próxima acción recomendada para avanzar el cierre.</li>
        </ul>
      </SectionCard>

      <SectionCard title="Qué podrá ver el dueño" subtitle="Visión comercial consolidada.">
        <ul className="muted">
          <li>Cuántos prospectos llegaron en el periodo.</li>
          <li>Cuántas conversaciones se atendieron.</li>
          <li>Cuántos seguimientos están pendientes.</li>
          <li>Actividad comercial reciente del equipo.</li>
          <li>Preparación para campaña Facebook/WhatsApp.</li>
        </ul>
      </SectionCard>

      <SectionCard title="Carga de conversaciones .txt" subtitle="Demo local segura">
        <p className="muted">Prueba controlada para simular una carga de conversación de WhatsApp en formato .txt.</p>
        <button type="button" onClick={() => setWhatsappPreview(parseWhatsappTxtPreview(WHATSAPP_TXT_DEMO_V077))}>
          Probar .txt simulado
        </button>
        {!whatsappPreview ? (
          <p className="muted">Aún no se ejecuta la vista previa. Este botón usa únicamente una conversación sintética local.</p>
        ) : (
          <div className="muted">
            <p><strong>Vista previa con conversación simulada.</strong></p>
            <p><strong>No se subió ningún archivo real.</strong></p>
            <p><strong>No se guardaron datos reales.</strong></p>
            <p>Mensajes analizados: {whatsappPreview.messagesCount}</p>
            <p>Participantes detectados: {whatsappPreview.participants.join(', ')}</p>
            {whatsappPreview.previewProspects.map((prospect) => (
              <div key={prospect.name}>
                <p><strong>Prospecto detectado:</strong> {prospect.name}</p>
                <p><strong>Interés:</strong> {prospect.interest}</p>
                <p><strong>Temperatura simulada:</strong> {prospect.temperature}</p>
                <p><strong>Próxima acción sugerida:</strong> {prospect.nextAction}</p>
              </div>
            ))}
            <p><strong>Siguientes acciones recomendadas:</strong></p>
            <ul>
              {whatsappPreview.suggestedFollowups.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export default OwnerDashboardPage;
