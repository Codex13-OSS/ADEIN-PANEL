import { ChangeEvent, useMemo, useState } from 'react';
import { parseWhatsAppConversation } from '../lib/whatsappParser';
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
  onSaveProspect: (analysis: AnalyzedConversation) => 'created' | 'duplicate';
  onCreateFollowup: (analysis: AnalyzedConversation) => 'created' | 'duplicate';
  onCompleteFollowup: (id: string) => void;
  onResetCrmDemo: () => void;
};

const TAB_OPTIONS: { key: CrmTab; label: string }[] = [
  { key: 'prospectos', label: 'Prospectos' },
  { key: 'whatsapp', label: 'Analizar WhatsApp' },
  { key: 'seguimientos', label: 'Seguimientos' },
  { key: 'acciones', label: 'Acciones recomendadas' },
];

function CrmPage({ activeTab = 'prospectos', onTabChange, role, prospects, followups, recommendedActions, analyzedConversation, onSaveProspect, onCreateFollowup, onCompleteFollowup, onResetCrmDemo }: Props) {
  const [internalTab, setInternalTab] = useState<CrmTab>(activeTab);
  const [fileName, setFileName] = useState('');
  const [filePreview, setFilePreview] = useState('');
  const [fileText, setFileText] = useState('');
  const [saveFeedback, setSaveFeedback] = useState('');
  const [followupFeedback, setFollowupFeedback] = useState('');
  const [copyFeedback, setCopyFeedback] = useState('');
  const [analysisFeedback, setAnalysisFeedback] = useState('');
  const [lastAnalysisLabel, setLastAnalysisLabel] = useState('Análisis demo');
  const [pastedText, setPastedText] = useState('');
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalyzedConversation>(analyzedConversation);
  const [reviewAnalysis, setReviewAnalysis] = useState<AnalyzedConversation>(analyzedConversation);

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
      setFileText(text);
      setFilePreview(text.split('\n').slice(0, 7).join('\n'));
      const parsed = parseWhatsAppConversation(text, analyzedConversation);
      setCurrentAnalysis(parsed);
      setReviewAnalysis(parsed);
      setAnalysisFeedback(parsed === analyzedConversation ? 'No se detectó texto válido. Se mantiene análisis demo.' : 'Archivo analizado correctamente.');
      setLastAnalysisLabel(`Archivo analizado: ${file.name}`);
    };
    reader.readAsText(file);
  };

  const handleCopyMessage = async () => {
    const text = reviewAnalysis.suggestedMessage;
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

  const handleAnalyzeConversation = () => {
    const pastedInput = pastedText.trim();
    const fileInput = fileText.trim();
    const sourceText = pastedInput || fileInput;
    const parsed = parseWhatsAppConversation(sourceText, analyzedConversation);
    setCurrentAnalysis(parsed);
    setReviewAnalysis(parsed);
    if (parsed === analyzedConversation) {
      setAnalysisFeedback('No se detectó texto válido. Se mantiene análisis demo.');
      return;
    }
    if (pastedInput) {
      setAnalysisFeedback('Texto pegado analizado. Datos comerciales listos.');
      setLastAnalysisLabel('Texto pegado analizado');
      return;
    }
    setAnalysisFeedback('Archivo analizado correctamente.');
    setLastAnalysisLabel(`Archivo analizado: ${fileName || 'archivo .txt'}`);
  };

  const updateReviewField = (field: keyof AnalyzedConversation, value: string) => {
    setReviewAnalysis((current) => ({ ...current, [field]: value }));
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
          {fileName ? <p className="file-state"><strong>{fileName}</strong> · Archivo cargado para análisis local.</p> : null}
          {filePreview ? <pre className="file-preview">{filePreview}</pre> : null}
          <textarea rows={6} placeholder="Pega aquí la conversación exportada o copiada de WhatsApp…" value={pastedText} onChange={(event) => setPastedText(event.target.value)}></textarea>
          <button className="btn-primary" onClick={handleAnalyzeConversation}>Analizar conversación cargada</button>
          {analysisFeedback ? <p className="file-state">{analysisFeedback}</p> : null}
          {lastAnalysisLabel ? <p className="file-state"><strong>Último análisis:</strong> {lastAnalysisLabel}</p> : null}
          <div className="analysis-grid">
            {[
              ['Nombre detectado', currentAnalysis.name], ['Teléfono detectado', currentAnalysis.phone], ['Predio de interés', currentAnalysis.property],
              ['Presupuesto aproximado', currentAnalysis.budget], ['Intención', currentAnalysis.intention], ['Objeciones', currentAnalysis.objections],
              ['Nivel de interés', currentAnalysis.interestLevel], ['Estatus sugerido', currentAnalysis.suggestedStatus], ['Próxima acción', currentAnalysis.nextAction],
              ['Fecha sugerida de seguimiento', currentAnalysis.suggestedFollowupDate], ['Resumen comercial', currentAnalysis.summary],
            ].map(([k, v]) => <article key={k} className="analysis-item"><h4>{k}</h4><p>{v}</p></article>)}
          </div>
          <article className="assistant-card">
            <h3>Asistente de seguimiento</h3>
            <p><strong>Prioridad:</strong> Alta</p>
            <p><strong>Acción recomendada:</strong> {currentAnalysis.nextAction}</p>
            <p><strong>Mensaje sugerido:</strong> “{currentAnalysis.suggestedMessage}”</p>
            <p><strong>Seguimiento recomendado:</strong> {currentAnalysis.suggestedFollowupDate}</p>
          </article>
          <article className="assistant-card">
            <h3>Revisar y completar antes de guardar</h3>
            <p>Puedes corregir los datos detectados antes de guardarlos en el CRM.</p>
            <div className="analysis-grid">
              <label className="analysis-item"><h4>Nombre</h4><input value={reviewAnalysis.name} onChange={(event) => updateReviewField('name', event.target.value)} /></label>
              <label className="analysis-item"><h4>Teléfono</h4><input value={reviewAnalysis.phone} onChange={(event) => updateReviewField('phone', event.target.value)} /></label>
              <label className="analysis-item"><h4>Predio de interés</h4><input value={reviewAnalysis.property} onChange={(event) => updateReviewField('property', event.target.value)} /></label>
              <label className="analysis-item"><h4>Presupuesto aproximado</h4><input value={reviewAnalysis.budget} onChange={(event) => updateReviewField('budget', event.target.value)} /></label>
              <label className="analysis-item"><h4>Estatus sugerido</h4><input value={reviewAnalysis.suggestedStatus} onChange={(event) => updateReviewField('suggestedStatus', event.target.value)} /></label>
              <label className="analysis-item"><h4>Próxima acción</h4><input value={reviewAnalysis.nextAction} onChange={(event) => updateReviewField('nextAction', event.target.value)} /></label>
              <label className="analysis-item"><h4>Fecha de seguimiento</h4><input value={reviewAnalysis.suggestedFollowupDate} onChange={(event) => updateReviewField('suggestedFollowupDate', event.target.value)} /></label>
              <label className="analysis-item"><h4>Mensaje sugerido</h4><textarea rows={4} value={reviewAnalysis.suggestedMessage} onChange={(event) => updateReviewField('suggestedMessage', event.target.value)} /></label>
            </div>
          </article>
          <div className="inline-actions"><button className="btn-primary" onClick={() => { const result = onSaveProspect(reviewAnalysis); setSaveFeedback(result === 'created' ? 'Prospecto agregado al CRM.' : 'Este prospecto ya existe en CRM.'); }}>Guardar como prospecto</button><button className="btn-outline" onClick={() => { const result = onCreateFollowup(reviewAnalysis); setFollowupFeedback(result === 'created' ? 'Seguimiento agregado.' : 'Seguimiento ya existente.'); }}>Crear seguimiento</button><button className="btn-outline" onClick={handleCopyMessage}>Copiar mensaje sugerido</button></div>
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
  }, [currentTab, fileName, filePreview, prospects, currentAnalysis, reviewAnalysis, saveFeedback, followupFeedback, copyFeedback, followups, onCompleteFollowup, recommendedActions, onCreateFollowup, onSaveProspect, pastedText, analysisFeedback, lastAnalysisLabel, fileText]);

  return (
    <div className="page-grid">
      <SectionCard title="CRM de ventas guiado" subtitle={role === 'owner' ? 'Vista administrativa con control por vendedor' : 'Vista vendedor con foco en acción comercial'}>
        <div className="tabs-row">{TAB_OPTIONS.map((tab) => <button key={tab.key} className={currentTab === tab.key ? 'active' : ''} onClick={() => handleTabChange(tab.key)}>{tab.label}</button>)}</div>
        <div className="inline-actions">
          <button className="btn-outline" onClick={onResetCrmDemo}>Restablecer CRM demo</button>
        </div>
      </SectionCard>
      {tabBody}
    </div>
  );
}

export default CrmPage;
