import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { filterProspects, summarizeProspects } from '../lib/crmProspectList.mjs';
import { waitForProspectRefresh } from '../lib/leadImportProgress.mjs';
import SectionCard from '../components/SectionCard';
import { Prospect } from '../types/crm';
import { LEAD_AGENT_API } from '../lib/runtimeConfig';

export type CrmTab = 'prospectos' | 'whatsapp' | 'appointments';

type Props = {
  activeTab?: CrmTab;
  onTabChange?: (tab: CrmTab) => void;
  prospects: Prospect[];
  onProspectsLoaded?: (prospects: Prospect[]) => void;
  ownerToken?: string;
};

type InventoryProperty = { id: string; name: string; location: string; status: string };
type InventoryLot = { id: string; lotCode: string; status: string; totalPrice: number; currency: string };
type InventoryInterest = { propertyInterest?: string; propertyId: string | null; lotId: string | null };

const TAB_OPTIONS: { key: CrmTab; label: string }[] = [
  { key: 'prospectos', label: 'Prospectos' },
  { key: 'appointments', label: 'Citas' },
  { key: 'whatsapp', label: 'Analizar WhatsApp' },
];

const ANALYSIS_STEPS = [
  'Conversación recibida',
  'Prospecto identificado',
  'Memoria CRM consultada',
  'Información comercial analizada',
  'CRM actualizado',
  'Siguiente acción preparada',
];

export default function CrmPage({ activeTab = 'prospectos', onTabChange, prospects, onProspectsLoaded, ownerToken }: Props) {
  const [internalTab, setInternalTab] = useState<CrmTab>(activeTab);
  const [fileName, setFileName] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [inputMode, setInputMode] = useState<'txt' | 'paste'>('txt');
  const [analysisFeedback, setAnalysisFeedback] = useState('');
  const [analysisProgress, setAnalysisProgress] = useState<number | null>(null);
  const [prospectQuery, setProspectQuery] = useState('');
  const [prospectStatus, setProspectStatus] = useState<Prospect['status'] | 'Todos'>('Todos');
  const [prospectPriority, setProspectPriority] = useState<Prospect['intentionLevel'] | 'Todas'>('Todas');
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [followupKind, setFollowupKind] = useState<'appointment' | 'reminder-1' | 'reminder-3'>('appointment');
  const [appointmentDate, setAppointmentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [appointmentTime, setAppointmentTime] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [appointments, setAppointments] = useState<{ id: string; leadId: string; buyerName: string; date: string; time: string; property: string; status: string }[]>([]);
  const [analyzedLead, setAnalyzedLead] = useState<Prospect | null>(null);
  const [analysisStepIndex, setAnalysisStepIndex] = useState(0);
  const [inventoryLeadId, setInventoryLeadId] = useState('');
  const [inventoryProperties, setInventoryProperties] = useState<InventoryProperty[]>([]);
  const [inventoryPropertyId, setInventoryPropertyId] = useState('');
  const [inventoryLots, setInventoryLots] = useState<InventoryLot[]>([]);
  const [inventoryLotId, setInventoryLotId] = useState('');
  const [inventoryInterest, setInventoryInterest] = useState<InventoryInterest | null>(null);
  const [inventoryFeedback, setInventoryFeedback] = useState('');
  const currentTab = onTabChange ? activeTab : internalTab;
  const visibleProspects = useMemo(() => filterProspects(prospects, { query: prospectQuery, status: prospectStatus, priority: prospectPriority }), [prospects, prospectPriority, prospectQuery, prospectStatus]);
  const prospectSummary = useMemo(() => summarizeProspects(prospects), [prospects]);
  const prospectsRef = useRef(prospects);
  prospectsRef.current = prospects;

  const refreshAppointments = async () => {
    try {
      const response = await fetch(`${LEAD_AGENT_API}/appointments`);
      const payload = await response.json() as { ok?: boolean; appointments?: typeof appointments };
      if (response.ok && payload.ok && Array.isArray(payload.appointments)) setAppointments(payload.appointments);
    } catch { /* silent */ }
  };

  useEffect(() => { void refreshAppointments(); }, []);

  useEffect(() => {
    if (!ownerToken) return;
    const inventoryApi = LEAD_AGENT_API.replace('/lead-agent', '');
    void fetch(`${inventoryApi}/properties`, { headers: { 'X-ADEIN-Owner-Authorization': `Bearer ${ownerToken}` } })
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => { if (Array.isArray(payload?.properties)) setInventoryProperties(payload.properties); })
      .catch(() => setInventoryFeedback('No se pudo leer el inventario real.'));
  }, [ownerToken]);

  useEffect(() => {
    if (!ownerToken || !inventoryLeadId) { setInventoryInterest(null); return; }
    void fetch(`${LEAD_AGENT_API}/leads/${inventoryLeadId}/inventory-interest`, { headers: { 'X-ADEIN-Owner-Authorization': `Bearer ${ownerToken}` } })
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!payload?.interest) return;
        const interest = payload.interest as InventoryInterest;
        setInventoryInterest(interest); setInventoryPropertyId(interest.propertyId || ''); setInventoryLotId(interest.lotId || '');
      }).catch(() => setInventoryFeedback('No se pudo leer la asignación del prospecto.'));
  }, [inventoryLeadId, ownerToken]);

  useEffect(() => {
    if (!ownerToken || !inventoryPropertyId) { setInventoryLots([]); return; }
    const inventoryApi = LEAD_AGENT_API.replace('/lead-agent', '');
    void fetch(`${inventoryApi}/properties/${inventoryPropertyId}/lots`, { headers: { 'X-ADEIN-Owner-Authorization': `Bearer ${ownerToken}` } })
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => { if (Array.isArray(payload?.lots)) setInventoryLots(payload.lots); })
      .catch(() => setInventoryFeedback('No se pudieron leer los lotes de la propiedad.'));
  }, [inventoryPropertyId, ownerToken]);

  const runAnalysis = async (fileNameParam: string, content: string) => {
    setFileName(fileNameParam);
    setAnalysisProgress(0);
    setAnalyzedLead(null);
    setAnalysisStepIndex(0);
    setAnalysisFeedback('');
    try {
      const response = await fetch(`${LEAD_AGENT_API}/queue`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: fileNameParam, content }),
      });
      if (!response.ok) throw new Error('Error del servidor');
      const payload = await response.json() as { analysisStarted?: boolean };
      if (!payload.analysisStarted) throw new Error('No se pudo iniciar el análisis');
      const refreshed = await waitForProspectRefresh({
        previousLeads: prospectsRef.current,
        attempts: 80, intervalMs: 750,
        onProgress: (p: number) => {
          setAnalysisProgress(p);
          if (p >= 12 && analysisStepIndex < 1) setAnalysisStepIndex(1);
          if (p >= 28 && analysisStepIndex < 2) setAnalysisStepIndex(2);
          if (p >= 44 && analysisStepIndex < 3) setAnalysisStepIndex(3);
          if (p >= 60 && analysisStepIndex < 4) setAnalysisStepIndex(4);
          if (p >= 76 && analysisStepIndex < 5) setAnalysisStepIndex(5);
          if (p >= 92 && analysisStepIndex < 6) setAnalysisStepIndex(6);
        },
        listLeads: async () => {
          const r = await fetch(`${LEAD_AGENT_API}/leads`);
          if (!r.ok) return prospectsRef.current;
          const d = await r.json() as { ok?: boolean; leads?: Prospect[] };
          return d.ok && Array.isArray(d.leads) ? d.leads : prospectsRef.current;
        },
      });
      if (refreshed) {
        onProspectsLoaded?.(refreshed);
        setAnalysisProgress(100); setAnalysisStepIndex(6); setAnalysisFeedback('Análisis completado.');
        const previousIds = new Set(prospectsRef.current.map((p: Prospect) => p.id));
        const newOrUpdated = refreshed.find((l: Prospect) => { if (!previousIds.has(l.id)) return true; const prev = prospectsRef.current.find((p: Prospect) => p.id === l.id); return prev && prev.lastContact !== l.lastContact; });
        if (newOrUpdated) setAnalyzedLead(newOrUpdated); else if (refreshed.length > 0) setAnalyzedLead(refreshed[0]);
        void refreshAppointments();
      } else {
        setAnalysisProgress(100); setAnalysisStepIndex(6);
        try {
          const r = await fetch(`${LEAD_AGENT_API}/leads`);
          const d = await r.json() as { ok?: boolean; leads?: Prospect[] };
          if (d.ok && Array.isArray(d.leads) && d.leads.length > 0) { onProspectsLoaded?.(d.leads); setAnalyzedLead(d.leads[0]); setAnalysisFeedback('Análisis completado.'); }
          else { setAnalysisFeedback('Revisa Prospectos en unos momentos.'); }
        } catch { setAnalysisFeedback('Revisa Prospectos en unos momentos.'); }
        void refreshAppointments();
      }
    } catch (err) { setAnalysisProgress(null); setAnalysisFeedback(err instanceof Error ? err.message : 'No se pudo enviar.'); }
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.txt')) { setAnalysisFeedback('Sólo archivos .txt'); return; }
    const reader = new FileReader();
    reader.onload = () => { void runAnalysis(file.name, String(reader.result ?? '')); };
    reader.readAsText(file);
  };

  const handlePasteSubmit = () => { const text = pastedText.trim(); if (!text) return; void runAnalysis(`pasted-${Date.now()}.txt`, text); };
  const saveQuickFollowup = async () => {
    if (!selectedProspect) return;
    const appointment = followupKind === 'appointment';
    const endpoint = appointment ? 'appointment' : 'reminder';
    const body = appointment ? { date: appointmentDate, time: appointmentTime } : { days: followupKind === 'reminder-1' ? 1 : 3 };
    try {
      const response = await fetch(`${LEAD_AGENT_API}/leads/${selectedProspect.id}/${endpoint}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(appointment ? { ...body, buyerName } : body) });
      if (!response.ok) throw new Error();
      setAnalysisFeedback(appointment ? 'Cita guardada.' : 'Recordatorio guardado.');
      setSelectedProspect(null); await refreshAppointments();
    } catch { setAnalysisFeedback('No se pudo guardar.'); }
  };
  const completeAppointment = async (appointmentId: string) => {
    try {
      const response = await fetch(`${LEAD_AGENT_API}/appointments/${appointmentId}/complete`, { method: 'POST' });
      if (!response.ok) throw new Error();
      setAnalysisFeedback('Cita marcada como realizada.'); await refreshAppointments();
    } catch { setAnalysisFeedback('No se pudo actualizar.'); }
  };
  const saveInventoryInterest = async () => {
    if (!ownerToken || !inventoryLeadId) return;
    setInventoryFeedback('');
    try {
      const response = await fetch(`${LEAD_AGENT_API}/leads/${inventoryLeadId}/inventory-interest`, {
        method: 'PATCH',
        headers: { 'X-ADEIN-Owner-Authorization': `Bearer ${ownerToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ propertyId: inventoryPropertyId || null, lotId: inventoryLotId || null }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'No se pudo guardar la asignación.');
      setInventoryInterest(payload.interest as InventoryInterest);
      const refreshed = await fetch(`${LEAD_AGENT_API}/leads`).then((r) => r.json()) as { ok?: boolean; leads?: Prospect[] };
      if (refreshed.ok && Array.isArray(refreshed.leads)) onProspectsLoaded?.(refreshed.leads);
      setInventoryFeedback('Inventario real asignado al prospecto.');
    } catch (error) { setInventoryFeedback(error instanceof Error ? error.message : 'No se pudo guardar la asignación.'); }
  };
  const openAppointment = (prospect: Prospect) => { setSelectedProspect(prospect); setBuyerName(prospect.name === 'Por confirmar' ? '' : prospect.name); onTabChange ? onTabChange('appointments') : setInternalTab('appointments'); };
  const resetAnalyzer = () => { setFileName(''); setPastedText(''); setAnalysisProgress(null); setAnalyzedLead(null); setAnalysisStepIndex(0); setAnalysisFeedback(''); };

  const InventoryInterestCard = () => {
    if (!ownerToken || currentTab !== 'prospectos') return null;
    const selectedLead = prospects.find((prospect) => prospect.id === inventoryLeadId);
    return <SectionCard title="Inventario del prospecto" subtitle="Vincula el interés CRM con propiedad y lote reales.">
      <div className="prospect-toolbar">
        <select value={inventoryLeadId} onChange={(event) => setInventoryLeadId(event.target.value)} aria-label="Seleccionar prospecto para inventario"><option value="">Selecciona un prospecto</option>{prospects.map((prospect) => <option key={prospect.id} value={prospect.id}>{prospect.name} · {prospect.phone}</option>)}</select>
        <select value={inventoryPropertyId} onChange={(event) => { setInventoryPropertyId(event.target.value); setInventoryLotId(''); }} disabled={!inventoryLeadId} aria-label="Seleccionar propiedad real"><option value="">Sin propiedad asignada</option>{inventoryProperties.map((property) => <option key={property.id} value={property.id}>{property.name} · {property.location}</option>)}</select>
        <select value={inventoryLotId} onChange={(event) => setInventoryLotId(event.target.value)} disabled={!inventoryPropertyId} aria-label="Seleccionar lote compatible"><option value="">Sin lote asignado</option>{inventoryLots.map((lot) => <option key={lot.id} value={lot.id}>{lot.lotCode} · {lot.status} · {lot.totalPrice} {lot.currency}</option>)}</select>
        <button className="compact-action" disabled={!inventoryLeadId} onClick={() => { void saveInventoryInterest(); }}>Guardar inventario</button>
      </div>
      {selectedLead && <p className="muted">Interés histórico: {(inventoryInterest?.propertyInterest ?? (selectedLead as any).propertyInterest ?? selectedLead.property) || 'Sin especificar'}</p>}
      {inventoryFeedback && <p className="muted">{inventoryFeedback}</p>}
    </SectionCard>;
  };

  const AnalysisResults = () => (analyzedLead ? <div className="analysis-results"><div className="analysis-results-header"><h3>Resultado del análisis</h3><button className="compact-action" onClick={() => { onTabChange ? onTabChange('prospectos') : setInternalTab('prospectos'); }}>Ver en Prospectos →</button></div><div className="analysis-grid"><div className="analysis-field"><span className="field-label">Prospecto</span><strong>{analyzedLead.name}</strong><small>{analyzedLead.phone}</small></div><div className="analysis-field"><span className="field-label">Predio</span><strong>{analyzedLead.property}</strong></div><div className="analysis-field"><span className="field-label">Etapa comercial</span><span className={`pill-badge ${analyzedLead.intentionLevel === 'Alta' ? 'pill-red' : 'pill-green'}`}>{(analyzedLead as any).commercialStage || analyzedLead.status}</span></div><div className="analysis-field"><span className="field-label">Prioridad</span><span className={`priority-label priority-${(analyzedLead.intentionLevel || 'media').toLowerCase()}`}>{analyzedLead.intentionLevel}</span></div></div>{(analyzedLead as any).summary && <div className="analysis-section"><h4>Lo que entendió ADEIN</h4><p>{(analyzedLead as any).summary}</p></div>}{(analyzedLead as any).stageReason && <div className="analysis-section"><h4>Por qué lo clasificó así</h4><p className="muted">{(analyzedLead as any).stageReason}</p></div>}{(analyzedLead as any).detectedSignals && <div className="analysis-section"><h4>Señales detectadas</h4><div className="signal-list">{(() => { try { return JSON.parse((analyzedLead as any).detectedSignals); } catch { return []; } })().map((s: string, i: number) => <span key={i} className="signal-tag">✓ {s}</span>)}</div></div>}{(analyzedLead as any).missingInformation && <div className="analysis-section"><h4>Información que todavía falta</h4><div className="signal-list">{(() => { try { return JSON.parse((analyzedLead as any).missingInformation); } catch { return []; } })().map((s: string, i: number) => <span key={i} className="signal-tag missing">○ {s}</span>)}</div></div>}<div className="analysis-section"><h4>Siguiente acción</h4><p><strong>{analyzedLead.nextAction}</strong></p></div>{(analyzedLead as any).suggestedMessage && <div className="analysis-section"><h4>Mensaje sugerido</h4><div className="suggested-message-box"><p>{(analyzedLead as any).suggestedMessage}</p><div className="message-actions"><button className="compact-action" onClick={() => { navigator.clipboard.writeText((analyzedLead as any).suggestedMessage || ''); }}>Copiar</button><small className="muted">Borrador — no se ha enviado ningún mensaje</small></div></div></div>}<div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem', flexWrap: 'wrap' }}><button className="primary-action" onClick={resetAnalyzer}>Analizar otra conversación</button>{analyzedLead.status === 'Cita agendada' && <button className="compact-action" onClick={() => { onTabChange ? onTabChange('appointments') : setInternalTab('appointments'); }}>Ir a Citas</button>}</div></div> : null);

  return <div className="page-grid">
    <InventoryInterestCard />
    <SectionCard title="Ventas" subtitle="Administra tus prospectos y analiza conversaciones."><div className="tabs-row">{TAB_OPTIONS.map((tab) => <button key={tab.key} className={currentTab === tab.key ? 'active' : ''} onClick={() => onTabChange ? onTabChange(tab.key) : setInternalTab(tab.key)}>{tab.label}</button>)}</div></SectionCard>
    {currentTab === 'prospectos' ? <SectionCard title="Prospectos" subtitle="Todos tus prospectos en un solo lugar."><div className="prospect-summary-grid"><article><span>Total</span><strong>{prospectSummary.total}</strong></article><article><span>Urgentes</span><strong>{prospectSummary.highPriority}</strong></article><article><span>Citas</span><strong>{prospectSummary.appointments}</strong></article><article><span>Por revisar</span><strong>{prospectSummary.manualReview}</strong></article></div><div className="prospect-toolbar"><input value={prospectQuery} onChange={(event) => setProspectQuery(event.target.value)} placeholder="Buscar nombre, teléfono o predio" aria-label="Buscar prospectos" /><select value={prospectStatus} onChange={(event) => setProspectStatus(event.target.value as Prospect['status'] | 'Todos')}><option value="Todos">Todos los estatus</option><option>Nuevo</option><option>Contactado</option><option>Interesado</option><option>Cita agendada</option><option>Venta</option><option>Descartado</option><option>Revisión manual</option></select><select value={prospectPriority} onChange={(event) => setProspectPriority(event.target.value as Prospect['intentionLevel'] | 'Todas')}><option value="Todas">Todas las prioridades</option><option>Alta</option><option>Media</option><option>Baja</option></select></div><div className="table-premium-wrap"><table className="table-premium prospect-table"><thead><tr><th>Prospecto</th><th>Prioridad</th><th>Predio</th><th>Estatus</th><th>Vendedor</th><th>Próxima acción</th><th></th></tr></thead><tbody>{visibleProspects.length ? visibleProspects.map((prospect) => <tr key={prospect.id}><td><strong>{prospect.name}</strong><small>{prospect.phone}</small></td><td><span className={`priority-label priority-${prospect.intentionLevel.toLowerCase()}`}>{prospect.intentionLevel}</span></td><td>{prospect.property}</td><td>{prospect.status}</td><td>{prospect.seller}</td><td>{prospect.nextAction}</td><td><button className="compact-action" onClick={() => openAppointment(prospect)}>Seguimiento</button></td></tr>) : <tr><td colSpan={7} className="empty-table-state">No hay prospectos que coincidan con estos filtros.</td></tr>}</tbody></table></div>{selectedProspect && <div className="quick-followup" role="region" aria-label="Programar seguimiento"><strong>{selectedProspect.name}</strong><select value={followupKind} onChange={(event) => setFollowupKind(event.target.value as typeof followupKind)}><option value="appointment">Agendar cita</option><option value="reminder-1">Recordar mañana</option><option value="reminder-3">Recordar en 3 días</option></select>{followupKind === 'appointment' && <><input type="date" value={appointmentDate} onChange={(event) => setAppointmentDate(event.target.value)} aria-label="Fecha de cita" /><input type="time" value={appointmentTime} onChange={(event) => setAppointmentTime(event.target.value)} aria-label="Hora de cita opcional" /></>}<button className="primary-action" onClick={saveQuickFollowup}>Guardar</button></div>}</SectionCard> : currentTab === 'appointments' ? <SectionCard title="Citas" subtitle="Próximas visitas a predios.">{selectedProspect && <div className="quick-followup"><strong>{selectedProspect.property}</strong><input value={buyerName} onChange={(event) => setBuyerName(event.target.value)} placeholder="Nombre del comprador" aria-label="Nombre del comprador" /><input type="date" value={appointmentDate} onChange={(event) => setAppointmentDate(event.target.value)} /><input type="time" value={appointmentTime} onChange={(event) => setAppointmentTime(event.target.value)} /><button className="primary-action" onClick={saveQuickFollowup}>Guardar cita</button></div>}<div className="table-premium-wrap"><table className="table-premium"><thead><tr><th>Comprador</th><th>Fecha</th><th>Hora</th><th>Predio</th><th>Estatus</th><th></th></tr></thead><tbody>{appointments.length ? appointments.map((item) => <tr key={item.id}><td>{item.buyerName}</td><td>{item.date}</td><td>{item.time || 'Por confirmar'}</td><td>{item.property}</td><td>{item.status}</td><td>{item.status !== 'Realizada' && <button className="compact-action" onClick={() => completeAppointment(item.id)}>Marcar realizada</button>}</td></tr>) : <tr><td colSpan={6} className="empty-table-state">No hay citas registradas.</td></tr>}</tbody></table></div></SectionCard> : <SectionCard title="Analizar WhatsApp" subtitle="Sube un archivo o pega una conversación."><div className="input-mode-tabs"><button className={inputMode === 'txt' ? 'active' : ''} onClick={() => setInputMode('txt')}>Subir archivo .TXT</button><button className={inputMode === 'paste' ? 'active' : ''} onClick={() => setInputMode('paste')}>Pegar conversación</button></div>{inputMode === 'txt' && <label className="dropzone" htmlFor="whatsapp-file"><strong>Selecciona el archivo .txt exportado desde WhatsApp</strong><span>ADEIN analizará la conversación y clasificará al prospecto automáticamente.</span><input id="whatsapp-file" type="file" accept=".txt,text/plain" onChange={handleFile} /></label>}{inputMode === 'paste' && <div className="paste-area"><p className="paste-help">Copia una conversación completa de WhatsApp y pégala aquí.</p><textarea className="paste-textarea" value={pastedText} onChange={(e) => setPastedText(e.target.value)} placeholder={`12/08/2026, 10:32 - Cliente: Hola, quisiera información…\n12/08/2026, 10:34 - Asesor: Claro, ¿qué zona buscas?`} rows={10} /><div className="paste-actions"><small className="muted">{pastedText.length} caracteres</small><div style={{ display: 'flex', gap: '.5rem' }}><button className="compact-action" onClick={() => setPastedText('')} disabled={!pastedText.trim()}>Limpiar</button><button className="primary-action" onClick={handlePasteSubmit} disabled={!pastedText.trim()}>Analizar conversación</button></div></div></div>}{fileName && <p className="file-state"><strong>{fileName}</strong> seleccionado.</p>}{analysisProgress !== null && analysisProgress < 100 && <div className="analysis-steps">{ANALYSIS_STEPS.map((step, i) => <div key={i} className={`analysis-step ${i < analysisStepIndex ? 'done' : i === analysisStepIndex ? 'current' : 'pending'}`}><span className="step-icon">{i < analysisStepIndex ? '✓' : i === analysisStepIndex ? '●' : '○'}</span><span>{step}</span></div>)}<div className="analysis-progress" role="progressbar" aria-label="Progreso del análisis" aria-valuemin={0} aria-valuemax={100} aria-valuenow={analysisProgress}><div className="analysis-progress-track"><span style={{ width: `${analysisProgress}%` }} /></div><strong>{analysisProgress}%</strong></div></div>}{analysisProgress === 100 && analysisFeedback && <p className="file-state success" role="status">✓ {analysisFeedback}</p>}{analysisProgress === null && analysisFeedback && <p className="file-state error" role="alert">{analysisFeedback}</p>}{analyzedLead && analysisProgress === 100 && <AnalysisResults />}</SectionCard>}
  </div>;
}
