import { ChangeEvent, useMemo, useState } from 'react';
import { filterProspects, summarizeProspects } from '../lib/crmProspectList.mjs';
import SectionCard from '../components/SectionCard';
import { Prospect } from '../types/crm';

export type CrmTab = 'prospectos' | 'whatsapp' | 'seguimientos' | 'acciones' | 'historial';

type Props = {
  activeTab?: CrmTab;
  onTabChange?: (tab: CrmTab) => void;
  prospects: Prospect[];
};

const TAB_OPTIONS: { key: CrmTab; label: string }[] = [
  { key: 'prospectos', label: 'Prospectos' },
  { key: 'whatsapp', label: 'Analizar WhatsApp' },
];

export default function CrmPage({ activeTab = 'prospectos', onTabChange, prospects }: Props) {
  const [internalTab, setInternalTab] = useState<CrmTab>(activeTab);
  const [fileName, setFileName] = useState('');
  const [analysisFeedback, setAnalysisFeedback] = useState('');
  const [prospectQuery, setProspectQuery] = useState('');
  const [prospectStatus, setProspectStatus] = useState<Prospect['status'] | 'Todos'>('Todos');
  const [prospectPriority, setProspectPriority] = useState<Prospect['intentionLevel'] | 'Todas'>('Todas');
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [followupKind, setFollowupKind] = useState<'appointment' | 'reminder-1' | 'reminder-3'>('appointment');
  const [appointmentDate, setAppointmentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [appointmentTime, setAppointmentTime] = useState('');
  const currentTab = onTabChange ? activeTab : internalTab;
  const visibleProspects = useMemo(() => filterProspects(prospects, { query: prospectQuery, status: prospectStatus, priority: prospectPriority }), [prospects, prospectPriority, prospectQuery, prospectStatus]);
  const prospectSummary = useMemo(() => summarizeProspects(prospects), [prospects]);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.txt')) {
      setAnalysisFeedback('Sólo se permiten archivos .txt exportados desde WhatsApp.');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      void fetch('http://127.0.0.1:3192/api/local/lead-agent/queue', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, content: String(reader.result ?? '') }),
      }).then(async (response) => {
        if (!response.ok) throw new Error();
        const payload = await response.json() as { analysisStarted?: boolean };
        setAnalysisFeedback(payload.analysisStarted ? 'Analizando ahora. Prospectos se actualizará automáticamente al terminar.' : 'Archivo enviado al subagente local.');
      }).catch(() => setAnalysisFeedback('No se pudo enviar el archivo al subagente local.'));
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
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error();
      setAnalysisFeedback(appointment ? 'Cita guardada.' : 'Recordatorio guardado. No se enviará ningún mensaje automáticamente.');
      setSelectedProspect(null);
    } catch {
      setAnalysisFeedback('No se pudo guardar el seguimiento.');
    }
  };

  return <div className="page-grid">
    <SectionCard title="CRM comercial" subtitle="Prospectos y análisis autorizado de archivos .txt de WhatsApp.">
      <div className="tabs-row">{TAB_OPTIONS.map((tab) => <button key={tab.key} className={currentTab === tab.key ? 'active' : ''} onClick={() => onTabChange ? onTabChange(tab.key) : setInternalTab(tab.key)}>{tab.label}</button>)}</div>
    </SectionCard>
    {currentTab === 'prospectos' ? <SectionCard title="Prospectos" subtitle="Datos comerciales mínimos registrados por el CRM.">
      <div className="prospect-summary-grid"><article><span>Total</span><strong>{prospectSummary.total}</strong></article><article><span>Alta prioridad</span><strong>{prospectSummary.highPriority}</strong></article><article><span>Citas</span><strong>{prospectSummary.appointments}</strong></article><article><span>Por revisar</span><strong>{prospectSummary.manualReview}</strong></article></div>
      <div className="prospect-toolbar"><input value={prospectQuery} onChange={(event) => setProspectQuery(event.target.value)} placeholder="Buscar nombre, teléfono o predio" aria-label="Buscar prospectos" /><select value={prospectStatus} onChange={(event) => setProspectStatus(event.target.value as Prospect['status'] | 'Todos')}><option value="Todos">Todos los estatus</option><option>Nuevo</option><option>Contactado</option><option>Interesado</option><option>Cita agendada</option><option>Venta</option><option>Descartado</option><option>Revisión manual</option></select><select value={prospectPriority} onChange={(event) => setProspectPriority(event.target.value as Prospect['intentionLevel'] | 'Todas')}><option value="Todas">Todas las prioridades</option><option>Alta</option><option>Media</option><option>Baja</option></select></div>
      <div className="table-premium-wrap"><table className="table-premium prospect-table"><thead><tr><th>Prospecto</th><th>Prioridad</th><th>Predio</th><th>Estatus</th><th>Vendedor</th><th>Próxima acción</th><th></th></tr></thead><tbody>{visibleProspects.length ? visibleProspects.map((prospect) => <tr key={prospect.id}><td><strong>{prospect.name}</strong><small>{prospect.phone}</small></td><td><span className={`priority-label priority-${prospect.intentionLevel.toLowerCase()}`}>{prospect.intentionLevel}</span></td><td>{prospect.property}</td><td>{prospect.status}</td><td>{prospect.seller}</td><td>{prospect.nextAction}</td><td><button className="compact-action" onClick={() => setSelectedProspect(prospect)}>Seguimiento</button></td></tr>) : <tr><td colSpan={7} className="empty-table-state">No hay prospectos que coincidan con estos filtros.</td></tr>}</tbody></table></div>
      {selectedProspect && <div className="quick-followup" role="region" aria-label="Programar seguimiento"><strong>{selectedProspect.name}</strong><select value={followupKind} onChange={(event) => setFollowupKind(event.target.value as typeof followupKind)}><option value="appointment">Agendar cita</option><option value="reminder-1">Recordar mañana</option><option value="reminder-3">Recordar en 3 días</option></select>{followupKind === 'appointment' && <><input type="date" value={appointmentDate} onChange={(event) => setAppointmentDate(event.target.value)} aria-label="Fecha de cita" /><input type="time" value={appointmentTime} onChange={(event) => setAppointmentTime(event.target.value)} aria-label="Hora de cita opcional" /></>}<button className="primary-action" onClick={saveQuickFollowup}>Guardar</button></div>}
    </SectionCard> : <SectionCard title="Analizar WhatsApp" subtitle="Carga un .txt exportado. No se muestran ni guardan conversaciones completas en el CRM.">
      <label className="dropzone" htmlFor="whatsapp-file"><strong>Selecciona el archivo .txt exportado desde WhatsApp</strong><span>El subagente clasificará sólo datos comerciales autorizados.</span><input id="whatsapp-file" type="file" accept=".txt,text/plain" onChange={handleFile} /></label>
      {fileName && <p className="file-state"><strong>{fileName}</strong> seleccionado.</p>}
      {analysisFeedback && <p className="file-state" role="status">{analysisFeedback}</p>}
    </SectionCard>}
  </div>;
}