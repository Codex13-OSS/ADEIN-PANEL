import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { filterProspects, summarizeProspects } from '../lib/crmProspectList.mjs';
import { waitForProspectRefresh } from '../lib/leadImportProgress.mjs';
import SectionCard from '../components/SectionCard';
import { Prospect } from '../types/crm';

export type CrmTab = 'prospectos' | 'whatsapp' | 'appointments';

type Props = {
  activeTab?: CrmTab;
  onTabChange?: (tab: CrmTab) => void;
  prospects: Prospect[];
  onProspectsLoaded?: (prospects: Prospect[]) => void;
};

const TAB_OPTIONS: { key: CrmTab; label: string }[] = [
  { key: 'prospectos', label: 'Prospectos' },
  { key: 'appointments', label: 'Citas' },
  { key: 'whatsapp', label: 'Analizar WhatsApp' },
];

export default function CrmPage({ activeTab = 'prospectos', onTabChange, prospects, onProspectsLoaded }: Props) {
  const [internalTab, setInternalTab] = useState<CrmTab>(activeTab);
  const [fileName, setFileName] = useState('');
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
  const [analysisSteps, setAnalysisSteps] = useState<string[]>([]);
  const currentTab = onTabChange ? activeTab : internalTab;
  const visibleProspects = useMemo(() => filterProspects(prospects, { query: prospectQuery, status: prospectStatus, priority: prospectPriority }), [prospects, prospectPriority, prospectQuery, prospectStatus]);
  const prospectSummary = useMemo(() => summarizeProspects(prospects), [prospects]);

  const refreshAppointments = async () => {
    try {
      const response = await fetch('http://127.0.0.1:3192/api/local/lead-agent/appointments');
      const payload = await response.json() as { ok?: boolean; appointments?: typeof appointments };
      if (response.ok && payload.ok && Array.isArray(payload.appointments)) setAppointments(payload.appointments);
    } catch { setAnalysisFeedback('No se pudieron cargar las citas.'); }
  };

  useEffect(() => { void refreshAppointments(); }, []);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.txt')) {
      setAnalysisFeedback('Sólo se permiten archivos .txt exportados desde WhatsApp.');
      return;
    }
    setFileName(file.name);
    setAnalysisProgress(0);
    setAnalyzedLead(null);
    setAnalysisSteps(['Recibiendo conversación…']);
    const reader = new FileReader();
    reader.onload = () => {
      setAnalysisSteps(s => [...s, 'Enviando a ADEIN Commercial Intelligence…']);
      void fetch('http://127.0.0.1:3192/api/local/lead-agent/queue', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, content: String(reader.result ?? '') }),
      }).then(async (response) => {
        if (!response.ok) throw new Error();
        const payload = await response.json() as { analysisStarted?: boolean };
        if (!payload.analysisStarted) throw new Error();
        setAnalysisSteps(s => [...s, 'Analizando conversación con IA…']);
        setAnalysisFeedback('Analizando ahora…');
        const refreshed = await waitForProspectRefresh({
          previousLeads: prospects,
          attempts: 80,
          onProgress: (p) => {
            setAnalysisProgress(p);
            if (p > 30 && !analysisSteps.includes('Extrayendo información comercial…'))
              setAnalysisSteps(s => [...s, 'Extrayendo información comercial…']);
            if (p > 60 && !analysisSteps.includes('Consultando memoria CRM…'))
              setAnalysisSteps(s => [...s, 'Consultando memoria CRM…']);
            if (p > 85 && !analysisSteps.includes('Actualizando prospecto…'))
              setAnalysisSteps(s => [...s, 'Actualizando prospecto…']);
          },
          listLeads: async () => {
            const leadsResponse = await fetch('http://127.0.0.1:3192/api/local/lead-agent/leads');
            if (!leadsResponse.ok) return prospects;
            const leadsPayload = await leadsResponse.json() as { ok?: boolean; leads?: Prospect[] };
            if (leadsPayload.ok && Array.isArray(leadsPayload.leads)) {
              // Capture the latest analyzed lead
              const newLeads = leadsPayload.leads.filter((l: Prospect) => 
                !prospects.some((p: Prospect) => p.id === l.id) || l.lastContact !== prospects.find((p: Prospect) => p.id === l.id)?.lastContact
              );
              if (newLeads.length > 0) setAnalyzedLead(newLeads[0]);
              else if (leadsPayload.leads.length > 0) setAnalyzedLead(leadsPayload.leads[0]);
              return leadsPayload.leads;
            }
            return prospects;
          },
        });
        if (!refreshed) {
          setAnalysisFeedback('El análisis sigue en curso. Actualizaremos automáticamente.');
          return;
        }
        onProspectsLoaded?.(refreshed);
        setAnalysisProgress(100);
        setAnalysisSteps(s => [...s, '✓ Análisis completado']);
        setAnalysisFeedback('Análisis completado.');
      }).catch(() => { setAnalysisProgress(null); setAnalysisFeedback('No se pudo enviar el archivo al subagente local.'); });
    };
    reader.readAsText(file);
  };

  const saveQuickFollowup = async () => {
    if (!selectedProspect) return;
    const appointment = followupKind === 'appointment';
    const endpoint = appointment ? 'appointment' : 'reminder';
    const body = appointment ? { date: appointmentDate, time: appointmentTime } : { days: followupKind === 'reminder-1' ? 1 : 3 };
    try {
      const response = await fetch(`http://127.0.0.1:3192/api/local/lead-agent/leads/${selectedProspect.id}/${endpoint}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(appointment ? { ...body, buyerName } : body),
      });
      if (!response.ok) throw new Error();
      setAnalysisFeedback(appointment ? 'Cita guardada.' : 'Recordatorio guardado. No se enviará ningún mensaje automáticamente.');
      setSelectedProspect(null);
      await refreshAppointments();
    } catch {
      setAnalysisFeedback('No se pudo guardar el seguimiento.');
    }
  };

  const completeAppointment = async (appointmentId: string) => {
    try {
      const response = await fetch(`http://127.0.0.1:3192/api/local/lead-agent/appointments/${appointmentId}/complete`, { method: 'POST' });
      if (!response.ok) throw new Error();
      setAnalysisFeedback('Cita marcada como realizada.');
      await refreshAppointments();
    } catch { setAnalysisFeedback('No se pudo actualizar la cita.'); }
  };

  const openAppointment = (prospect: Prospect) => {
    setSelectedProspect(prospect);
    setBuyerName(prospect.name === 'Por confirmar' ? '' : prospect.name);
    onTabChange ? onTabChange('appointments') : setInternalTab('appointments');
  };

  return <div className="page-grid">
    <SectionCard title="Ventas" subtitle="Administra tus prospectos y analiza conversaciones.">
      <div className="tabs-row">{TAB_OPTIONS.map((tab) => <button key={tab.key} className={currentTab === tab.key ? 'active' : ''} onClick={() => onTabChange ? onTabChange(tab.key) : setInternalTab(tab.key)}>{tab.label}</button>)}</div>
    </SectionCard>
    {currentTab === 'prospectos' ? <SectionCard title="Prospectos" subtitle="Todos tus prospectos en un solo lugar.">
      <div className="prospect-summary-grid"><article><span>Total</span><strong>{prospectSummary.total}</strong></article><article><span>Urgentes</span><strong>{prospectSummary.highPriority}</strong></article><article><span>Citas</span><strong>{prospectSummary.appointments}</strong></article><article><span>Por revisar</span><strong>{prospectSummary.manualReview}</strong></article></div>
      <div className="prospect-toolbar"><input value={prospectQuery} onChange={(event) => setProspectQuery(event.target.value)} placeholder="Buscar nombre, teléfono o predio" aria-label="Buscar prospectos" /><select value={prospectStatus} onChange={(event) => setProspectStatus(event.target.value as Prospect['status'] | 'Todos')}><option value="Todos">Todos los estatus</option><option>Nuevo</option><option>Contactado</option><option>Interesado</option><option>Cita agendada</option><option>Venta</option><option>Descartado</option><option>Revisión manual</option></select><select value={prospectPriority} onChange={(event) => setProspectPriority(event.target.value as Prospect['intentionLevel'] | 'Todas')}><option value="Todas">Todas las prioridades</option><option>Alta</option><option>Media</option><option>Baja</option></select></div>
      <div className="table-premium-wrap"><table className="table-premium prospect-table"><thead><tr><th>Prospecto</th><th>Prioridad</th><th>Predio</th><th>Estatus</th><th>Vendedor</th><th>Próxima acción</th><th></th></tr></thead><tbody>{visibleProspects.length ? visibleProspects.map((prospect) => <tr key={prospect.id}><td><strong>{prospect.name}</strong><small>{prospect.phone}</small></td><td><span className={`priority-label priority-${prospect.intentionLevel.toLowerCase()}`}>{prospect.intentionLevel}</span></td><td>{prospect.property}</td><td>{prospect.status}</td><td>{prospect.seller}</td><td>{prospect.nextAction}</td><td><button className="compact-action" onClick={() => openAppointment(prospect)}>Seguimiento</button></td></tr>) : <tr><td colSpan={7} className="empty-table-state">No hay prospectos que coincidan con estos filtros.</td></tr>}</tbody></table></div>
      {selectedProspect && <div className="quick-followup" role="region" aria-label="Programar seguimiento"><strong>{selectedProspect.name}</strong><select value={followupKind} onChange={(event) => setFollowupKind(event.target.value as typeof followupKind)}><option value="appointment">Agendar cita</option><option value="reminder-1">Recordar mañana</option><option value="reminder-3">Recordar en 3 días</option></select>{followupKind === 'appointment' && <><input type="date" value={appointmentDate} onChange={(event) => setAppointmentDate(event.target.value)} aria-label="Fecha de cita" /><input type="time" value={appointmentTime} onChange={(event) => setAppointmentTime(event.target.value)} aria-label="Hora de cita opcional" /></>}<button className="primary-action" onClick={saveQuickFollowup}>Guardar</button></div>}
    </SectionCard> : currentTab === 'appointments' ? <SectionCard title="Citas" subtitle="Próximas visitas a predios.">
      {selectedProspect && <div className="quick-followup"><strong>{selectedProspect.property}</strong><input value={buyerName} onChange={(event) => setBuyerName(event.target.value)} placeholder="Nombre del comprador" aria-label="Nombre del comprador" /><input type="date" value={appointmentDate} onChange={(event) => setAppointmentDate(event.target.value)} /><input type="time" value={appointmentTime} onChange={(event) => setAppointmentTime(event.target.value)} /><button className="primary-action" onClick={saveQuickFollowup}>Guardar cita</button></div>}
      <div className="table-premium-wrap"><table className="table-premium"><thead><tr><th>Comprador</th><th>Fecha</th><th>Hora</th><th>Predio</th><th>Estatus</th><th></th></tr></thead><tbody>{appointments.length ? appointments.map((item) => <tr key={item.id}><td>{item.buyerName}</td><td>{item.date}</td><td>{item.time || 'Por confirmar'}</td><td>{item.property}</td><td>{item.status}</td><td>{item.status !== 'Realizada' && <button className="compact-action" onClick={() => completeAppointment(item.id)}>Marcar realizada</button>}</td></tr>) : <tr><td colSpan={6} className="empty-table-state">No hay citas registradas.</td></tr>}</tbody></table></div>
    </SectionCard> : <SectionCard title="Analizar WhatsApp" subtitle="Sube un archivo de WhatsApp para analizarlo.">
      <label className="dropzone" htmlFor="whatsapp-file"><strong>Selecciona el archivo .txt exportado desde WhatsApp</strong><span>ADEIN analizará la conversación y clasificará al prospecto automáticamente.</span><input id="whatsapp-file" type="file" accept=".txt,text/plain" onChange={handleFile} /></label>
      {fileName && <p className="file-state"><strong>{fileName}</strong> seleccionado.</p>}
      {analysisSteps.length > 0 && analysisProgress !== null && analysisProgress < 100 && (
        <div className="analysis-steps">
          {analysisSteps.map((step, i) => (
            <div key={i} className={`analysis-step ${i === analysisSteps.length - 1 ? 'current' : 'done'}`}>
              <span className="step-icon">{i === analysisSteps.length - 1 ? '●' : '✓'}</span>
              <span>{step}</span>
            </div>
          ))}
          <div className="analysis-progress" role="progressbar" aria-label="Progreso del análisis" aria-valuemin={0} aria-valuemax={100} aria-valuenow={analysisProgress}><div className="analysis-progress-track"><span style={{ width: `${analysisProgress}%` }} /></div><strong>{analysisProgress}%</strong></div>
        </div>
      )}
      {analysisFeedback && analysisProgress === 100 && <p className="file-state success" role="status">✓ {analysisFeedback}</p>}
      {analysisFeedback && analysisProgress === null && <p className="file-state error" role="alert">{analysisFeedback}</p>}

      {/* Analysis Results */}
      {analyzedLead && analysisProgress === 100 && (
        <div className="analysis-results">
          <div className="analysis-results-header">
            <h3>Resultado del análisis</h3>
            <button className="compact-action" onClick={() => { onTabChange ? onTabChange('prospectos') : setInternalTab('prospectos'); }}>Ver en Prospectos →</button>
          </div>

          <div className="analysis-grid">
            <div className="analysis-field">
              <span className="field-label">Prospecto</span>
              <strong>{analyzedLead.name}</strong>
              <small>{analyzedLead.phone}</small>
            </div>
            <div className="analysis-field">
              <span className="field-label">Predio</span>
              <strong>{analyzedLead.property}</strong>
            </div>
            <div className="analysis-field">
              <span className="field-label">Etapa comercial</span>
              <span className={`pill-badge ${analyzedLead.intentionLevel === 'Alta' ? 'pill-red' : 'pill-green'}`}>{(analyzedLead as any).commercialStage || analyzedLead.status}</span>
            </div>
            <div className="analysis-field">
              <span className="field-label">Prioridad</span>
              <span className={`priority-label priority-${(analyzedLead.intentionLevel || 'media').toLowerCase()}`}>{analyzedLead.intentionLevel}</span>
            </div>
          </div>

          {(analyzedLead as any).summary && (
            <div className="analysis-section">
              <h4>Lo que entendió ADEIN</h4>
              <p>{(analyzedLead as any).summary}</p>
            </div>
          )}

          {(analyzedLead as any).stageReason && (
            <div className="analysis-section">
              <h4>Por qué lo clasificó así</h4>
              <p className="muted">{(analyzedLead as any).stageReason}</p>
            </div>
          )}

          {(analyzedLead as any).detectedSignals && (
            <div className="analysis-section">
              <h4>Señales detectadas</h4>
              <div className="signal-list">
                {(() => { try { return JSON.parse((analyzedLead as any).detectedSignals); } catch { return []; } })().map((s: string, i: number) => (
                  <span key={i} className="signal-tag">✓ {s}</span>
                ))}
              </div>
            </div>
          )}

          {(analyzedLead as any).missingInformation && (
            <div className="analysis-section">
              <h4>Información que todavía falta</h4>
              <div className="signal-list">
                {(() => { try { return JSON.parse((analyzedLead as any).missingInformation); } catch { return []; } })().map((s: string, i: number) => (
                  <span key={i} className="signal-tag missing">○ {s}</span>
                ))}
              </div>
            </div>
          )}

          <div className="analysis-section">
            <h4>Siguiente acción</h4>
            <p><strong>{analyzedLead.nextAction}</strong></p>
          </div>

          {(analyzedLead as any).suggestedMessage && (
            <div className="analysis-section">
              <h4>Mensaje sugerido</h4>
              <div className="suggested-message-box">
                <p>{(analyzedLead as any).suggestedMessage}</p>
                <div className="message-actions">
                  <button className="compact-action" onClick={() => { navigator.clipboard.writeText((analyzedLead as any).suggestedMessage || ''); }}>Copiar</button>
                  <small className="muted">Borrador — no se ha enviado ningún mensaje</small>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {analysisProgress !== null && <div className="analysis-progress" role="progressbar" aria-label="Progreso del análisis" aria-valuemin={0} aria-valuemax={100} aria-valuenow={analysisProgress}><div className="analysis-progress-track"><span style={{ width: `${analysisProgress}%` }} /></div><strong>{analysisProgress}%</strong></div>}
      {analysisFeedback && <p className="file-state" role="status">{analysisFeedback}</p>}
    </SectionCard>}
  </div>;
}