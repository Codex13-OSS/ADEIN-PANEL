import { ChangeEvent, useMemo, useState } from 'react';
import SectionCard from '../components/SectionCard';

type CrmTab = 'prospectos' | 'whatsapp' | 'seguimientos' | 'acciones';
type Props = { initialTab?: CrmTab; role: 'owner' | 'seller' };

const TAB_OPTIONS: { key: CrmTab; label: string }[] = [
  { key: 'prospectos', label: 'Prospectos' },
  { key: 'whatsapp', label: 'Analizar WhatsApp' },
  { key: 'seguimientos', label: 'Seguimientos' },
  { key: 'acciones', label: 'Acciones recomendadas' },
];

function CrmPage({ initialTab = 'prospectos', role }: Props) {
  const [activeTab, setActiveTab] = useState<CrmTab>(initialTab);
  const [fileName, setFileName] = useState('');
  const [filePreview, setFilePreview] = useState('');

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

  const tabBody = useMemo(() => {
    if (activeTab === 'prospectos') {
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
                <tr><td>Prospecto Horizonte</td><td>Predio Norte</td><td><span className="badge">Interesado</span></td><td>Vendedor A</td><td>Hoy 10:30</td><td>Enviar ubicación</td><td><div className="inline-actions"><button className="btn-outline">WhatsApp</button><button className="btn-outline">Seguimiento</button><button className="btn-outline">Detalle</button></div></td></tr>
                <tr><td>Prospecto Alameda</td><td>Predio Sur</td><td><span className="badge badge-warning">Cita agendada</span></td><td>Vendedor B</td><td>Ayer 17:15</td><td>Confirmar visita</td><td><div className="inline-actions"><button className="btn-outline">WhatsApp</button><button className="btn-outline">Seguimiento</button><button className="btn-outline">Detalle</button></div></td></tr>
              </tbody>
            </table>
          </div>
        </SectionCard>
      );
    }

    if (activeTab === 'whatsapp') {
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
              ['Nombre detectado', 'Prospecto Horizonte'], ['Teléfono detectado', 'Contacto móvil mock'], ['Predio de interés', 'Predio Norte'],
              ['Presupuesto aproximado', '$680,000 MXN'], ['Intención', 'Compra en 30 días'], ['Objeciones', 'Tiempo de traslado'],
              ['Nivel de interés', 'Alto'], ['Estatus sugerido', 'Interesado calificado'], ['Próxima acción', 'Agendar visita guiada'],
              ['Fecha sugerida de seguimiento', 'Hoy 5:30 PM'], ['Resumen comercial', 'Lead con alta disposición de cierre si se confirma acceso y ubicación.'],
            ].map(([k, v]) => <article key={k} className="analysis-item"><h4>{k}</h4><p>{v}</p></article>)}
          </div>
          <article className="assistant-card">
            <h3>Asistente de seguimiento</h3>
            <p><strong>Prioridad:</strong> Alta</p>
            <p><strong>Acción recomendada:</strong> Agendar visita guiada</p>
            <p><strong>Mensaje sugerido:</strong> “Hola, con gusto puedo apoyarle con disponibilidad y ubicación del predio. ¿Le parece si agendamos una visita?”</p>
            <p><strong>Seguimiento recomendado:</strong> Hoy antes de las 6:00 PM</p>
          </article>
          <div className="inline-actions"><button className="btn-primary">Guardar como prospecto</button><button className="btn-outline">Crear seguimiento</button><button className="btn-outline">Copiar mensaje sugerido</button></div>
        </SectionCard>
      );
    }

    if (activeTab === 'seguimientos') {
      return <SectionCard title="Seguimientos comerciales" subtitle="Prioriza acciones de hoy para no perder cierres"><div className="analysis-grid">{[
        ['Pendiente de hoy', 'Prospecto Horizonte', 'Enviar ubicación y rango de precios', '11:30 AM', 'Alta'],
        ['Vencido', 'Prospecto Alameda', 'Confirmar visita programada', 'Ayer 6:00 PM', 'Alta'],
        ['Próximo', 'Prospecto Bosques', 'Llamada de validación de presupuesto', 'Mañana 10:00 AM', 'Media'],
      ].map((item) => <article className="analysis-item" key={item[1]}><h4>{item[0]}</h4><p><strong>Prospecto:</strong> {item[1]}</p><p><strong>Acción sugerida:</strong> {item[2]}</p><p><strong>Hora sugerida:</strong> {item[3]}</p><p><strong>Prioridad:</strong> {item[4]}</p><button className="btn-outline">Marcar como realizado</button></article>)}</div></SectionCard>;
    }

    return <SectionCard title="Acciones recomendadas" subtitle="Motor visual de enfoque comercial diario"><div className="analysis-grid">{[
      ['Alta', 'Contactar interesados sin cita', 'Hay prospectos con intención alta sin visita asignada.', 'Enviar propuesta de horario hoy.'],
      ['Media', 'Revisar prospectos con presupuesto definido', 'Ya calificaron rango de inversión, falta empuje comercial.', 'Compartir opciones por predio.'],
      ['Alta', 'Agendar visita para leads calientes', 'Conversaciones recientes con señales de cierre cercano.', 'Confirmar visita guiada este día.'],
      ['Media', 'Dar seguimiento a no respondidos', 'No hubo respuesta en últimas 48 horas.', 'Enviar recordatorio corto y directo.'],
      ['Baja', 'Actualizar estatus de conversaciones analizadas', 'Mantener CRM limpio mejora decisiones del equipo.', 'Registrar estatus sugerido en cada lead.'],
    ].map((item) => <article className="analysis-item" key={item[1]}><h4>{item[1]}</h4><p><strong>Prioridad:</strong> {item[0]}</p><p><strong>Motivo:</strong> {item[2]}</p><p><strong>Acción sugerida:</strong> {item[3]}</p><button className="btn-outline">Ejecutar acción mock</button></article>)}</div></SectionCard>;
  }, [activeTab, fileName, filePreview]);

  return (
    <div className="page-grid">
      <SectionCard title="CRM de ventas guiado" subtitle={role === 'owner' ? 'Vista administrativa con control por vendedor' : 'Vista vendedor con foco en acción comercial'}>
        <div className="tabs-row">{TAB_OPTIONS.map((tab) => <button key={tab.key} className={activeTab === tab.key ? 'active' : ''} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>)}</div>
      </SectionCard>
      {tabBody}
    </div>
  );
}

export default CrmPage;
