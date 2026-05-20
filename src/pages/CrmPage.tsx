import SectionCard from '../components/SectionCard';

function CrmPage() {
  return (
    <div className="page-grid">
      <SectionCard title="CRM operativo" subtitle="Mesa de seguimiento comercial">
        <div className="controls-row">
          <input placeholder="Buscar prospecto, predio o estatus..." />
          <select><option>Estatus: Todos</option><option>Nuevo</option><option>Contactado</option><option>Interesado</option><option>Cita agendada</option><option>Separado</option><option>Cliente</option><option>No responde</option><option>Perdido</option></select>
          <select><option>Vendedor: Todos</option><option>Vendedor A</option><option>Vendedor B</option></select>
        </div>
        <table><thead><tr><th>Prospecto</th><th>Predio</th><th>Estatus</th><th>Vendedor</th><th>Acciones</th></tr></thead>
          <tbody><tr><td>Prospecto Demo</td><td>Predio Norte</td><td>Interesado</td><td>Vendedor A</td><td><div className="inline-actions"><button className="btn-outline">WhatsApp</button><button className="btn-outline">Seguimiento</button><button className="btn-outline">Detalle</button></div></td></tr></tbody></table>
      </SectionCard>
      <SectionCard title="Analizar conversación" subtitle="Flujo visual futuro para WhatsApp + IA">
        <textarea rows={8} placeholder="Pega aquí la conversación de WhatsApp..."></textarea>
        <div className="inline-actions"><button className="btn-primary">Analizar conversación</button></div>
        <div className="analysis-box"><p><strong>Nombre:</strong> Prospecto Demo</p><p><strong>Teléfono:</strong> +52 000 000 0000 (mock)</p><p><strong>Predio de interés:</strong> Predio Sur</p><p><strong>Presupuesto aproximado:</strong> $650,000 MXN</p><p><strong>Intención:</strong> Compra en 30-60 días</p><p><strong>Objeciones:</strong> Tiempo de traslado</p><p><strong>Nivel de interés:</strong> Alto</p><p><strong>Próximo paso:</strong> Agendar visita guiada</p><p><strong>Resumen comercial:</strong> Prospecto con interés alto y disposición de cierre si se resuelven tiempos.</p></div>
        <button className="btn-primary">Guardar como prospecto</button>
      </SectionCard>
    </div>
  );
}

export default CrmPage;
