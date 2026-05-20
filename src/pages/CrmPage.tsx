import { ChangeEvent, useMemo, useState } from 'react';
import SectionCard from '../components/SectionCard';
import { AnalyzedConversation, Followup, Prospect, RecommendedAction } from '../types/crm';

export type CrmTab = 'prospectos' | 'whatsapp' | 'seguimientos' | 'acciones';

type Props = {
  activeTab?: CrmTab;
  onTabChange?: (tab: CrmTab) => void;
  role: 'owner' | 'seller';
  prospects: Prospect[];
  followups: Followup[];
  recommendedActions: RecommendedAction[];
  analyzedConversation: AnalyzedConversation;
  onSaveProspect: (analysis: AnalyzedConversation) => void;
  onCreateFollowup: (analysis: AnalyzedConversation) => void;
  onCompleteFollowup: (id: string) => void;
};

const TAB_OPTIONS: { key: CrmTab; label: string }[] = [
  { key: 'prospectos', label: 'Prospectos' },
  { key: 'whatsapp', label: 'Analizar WhatsApp' },
  { key: 'seguimientos', label: 'Seguimientos' },
  { key: 'acciones', label: 'Acciones recomendadas' },
];

function CrmPage({ activeTab = 'prospectos', onTabChange, role, prospects, followups, recommendedActions, analyzedConversation, onSaveProspect, onCreateFollowup, onCompleteFollowup }: Props) {
  const [internalTab, setInternalTab] = useState<CrmTab>(activeTab);
  const [fileName, setFileName] = useState('');
  const [filePreview, setFilePreview] = useState('');
  const [saveFeedback, setSaveFeedback] = useState('');
  const [followupFeedback, setFollowupFeedback] = useState('');
  const [copyFeedback, setCopyFeedback] = useState('');

  const currentTab = onTabChange ? activeTab : internalTab;

  const handleTabChange = (tab: CrmTab) => {
    if (onTabChange) {
      onTabChange(tab);
      return;
    }
    setInternalTab(tab);
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      setFilePreview(text.split('\n').slice(0, 5).join('\n'));
    };
    reader.readAsText(file);
  };

  const handleCopyMessage = async () => {
    const text = analyzedConversation.suggestedMessage;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopyFeedback('Mensaje copiado.');
      } else {
        throw new Error('Clipboard API no disponible');
      }
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
      setCopyFeedback('Mensaje copiado con fallback.');
    }
  };

  const tabBody = useMemo(() => {
    if (currentTab === 'prospectos') {
      return (
        <SectionCard title="Prospectos activos" subtitle="Pipeline comercial del equipo de ventas">
          <div className="controls-row">
            <input placeholder="Buscar prospecto, predio o estatus" />
            <select><option>Estatus: Todos</option><option>Nuevo</option><option>Interesado</option><option>Cita agendada</option><option>No responde</option></select>
            <select><option>Vendedor: Todos</option><option>Vendedor A</option><option>Vendedor B</option></select>
          </div>
          <div className="table-premium-wrap">
            <table className="table-premium"><thead><tr><th>Prospecto</th><th>Predio</th><th>Estatus</th><th>Vendedor</th><th>Último contacto</th><th>Próxima acción</th><th>Acciones</th></tr></thead>
              <tbody>
                {prospects.map((prospect) => <tr key={prospect.id}><td>{prospect.name}</td><td>{prospect.property}</td><td><span className="badge">{prospect.status}</span></td><td>{prospect.seller}</td><td>{prospect.lastContact}</td><td>{prospect.nextAction}</td><td><div className="inline-actions"><button className="btn-outline">WhatsApp</button><button className="btn-outline">Seguimiento</button><button className="btn-outline">Detalle</button></div></td></tr>)}
              </tbody>
            </table>
          </div>
        </SectionCard>
      );
    }

    if (currentTab === 'whatsapp') {
      return (
        <SectionCard title="Analizar conversación de WhatsApp" subtitle="Sube el .txt exportado desde WhatsApp o pega la conversación para extraer datos comerciales.">
          <label className="dropzone" htmlFor="whatsapp-file">
            <strong>Sube aquí el archivo .txt exportado desde WhatsApp</strong>
            <span>Formato permitido: .txt / text/plain</span>
            <input id="whatsapp-file" type="file" accept=".txt,text/plain" onChange={handleFile} />
          </label>
          {fileName ? <p className="file-state"><strong>{fileName}</strong> · Archivo listo para análisis mock.</p> : null}
          {filePreview ? <pre className="file-preview">{filePreview}</pre> : null}
          <textarea rows={6} placeholder="O pega aquí la conversación manualmente"></textarea>
          <button className="btn-primary">Analizar conversación</button>
          <div className="analysis-grid">
            {[
              ['Nombre detectado', analyzedConversation.name], ['Teléfono detectado', analyzedConversation.phone], ['Predio de interés', analyzedConversation.property],
              ['Presupuesto aproximado', analyzedConversation.budget], ['Intención', analyzedConversation.intention], ['Objeciones', analyzedConversation.objections],
              ['Nivel de interés', analyzedConversation.interestLevel], ['Estatus sugerido', analyzedConversation.suggestedStatus], ['Próxima acción', analyzedConversation.nextAction],
              ['Fecha sugerida de seguimiento', analyzedConversation.suggestedFollowupDate], ['Resumen comercial', analyzedConversation.summary],
            ].map(([k, v]) => <article key={k} className="analysis-item"><h4>{k}</h4><p>{v}</p></article>)}
          </div>
          <article className="assistant-card">
            <h3>Asistente de seguimiento</h3>
            <p><strong>Prioridad:</strong> Alta</p>
            <p><strong>Acción recomendada:</strong> {analyzedConversation.nextAction}</p>
            <p><strong>Mensaje sugerido:</strong> “{analyzedConversation.suggestedMessage}”</p>
            <p><strong>Seguimiento recomendado:</strong> {analyzedConversation.suggestedFollowupDate}</p>
          </article>
          <div className="inline-actions"><button className="btn-primary" onClick={() => { onSaveProspect(analyzedConversation); setSaveFeedback('Prospecto guardado o ya existente.'); }}>Guardar como prospecto</button><button className="btn-outline" onClick={() => { onCreateFollowup(analyzedConversation); setFollowupFeedback('Seguimiento creado o ya existente.'); }}>Crear seguimiento</button><button className="btn-outline" onClick={handleCopyMessage}>Copiar mensaje sugerido</button></div>
          {saveFeedback ? <p className="file-state">{saveFeedback}</p> : null}
          {followupFeedback ? <p className="file-state">{followupFeedback}</p> : null}
          {copyFeedback ? <p className="file-state">{copyFeedback}</p> : null}
        </SectionCard>
      );
    }

    if (currentTab === 'seguimientos') {
      return <SectionCard title="Seguimientos comerciales" subtitle="Prioriza acciones de hoy para no perder cierres"><div className="analysis-grid">{followups.filter((item) => !item.completed).map((item) => <article className="analysis-item" key={item.id}><h4>{item.state}</h4><p><strong>Prospecto:</strong> {item.prospectName}</p><p><strong>Acción sugerida:</strong> {item.action}</p><p><strong>Hora sugerida:</strong> {item.suggestedTime}</p><p><strong>Prioridad:</strong> {item.priority}</p><button className="btn-outline" onClick={() => onCompleteFollowup(item.id)}>Marcar como realizado</button></article>)}</div></SectionCard>;
    }

    return <SectionCard title="Acciones recomendadas" subtitle="Motor visual de enfoque comercial diario"><div className="analysis-grid">{recommendedActions.map((item) => <article className="analysis-item" key={item.id}><h4>{item.title}</h4><p><strong>Prioridad:</strong> {item.priority}</p><p><strong>Motivo:</strong> {item.reason}</p><p><strong>Acción sugerida:</strong> {item.suggestedAction}</p><button className="btn-outline">Ejecutar acción mock</button></article>)}</div></SectionCard>;
  }, [currentTab, fileName, filePreview, prospects, analyzedConversation, saveFeedback, followupFeedback, copyFeedback, followups, onCompleteFollowup, recommendedActions, onCreateFollowup, onSaveProspect]);

  return (
    <div className="page-grid">
      <SectionCard title="CRM de ventas guiado" subtitle={role === 'owner' ? 'Vista administrativa con control por vendedor' : 'Vista vendedor con foco en acción comercial'}>
        <div className="tabs-row">{TAB_OPTIONS.map((tab) => <button key={tab.key} className={currentTab === tab.key ? 'active' : ''} onClick={() => handleTabChange(tab.key)}>{tab.label}</button>)}</div>
      </SectionCard>
      {tabBody}
    </div>
  );
}

export default CrmPage;
