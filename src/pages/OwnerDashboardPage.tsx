import DecisionCard from '../components/DecisionCard';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';

function OwnerDashboardPage() {
  return (
    <div className="page-grid">
      <section className="stats-grid">
        {[
          ['Prospectos nuevos', '34'], ['Interesados', '21'], ['Citas agendadas', '14'], ['Separaciones', '5'],
          ['Lotes libres', '47'], ['Lotes vendidos', '32'], ['Seguimientos vencidos', '5'], ['Conversión general', '24%'],
        ].map(([label, value]) => <StatCard key={label} label={label} value={value} />)}
      </section>

      <SectionCard title="Centro de decisiones" subtitle="Alertas comerciales prioritarias">
        <div className="decision-grid">
          <DecisionCard level="high" title="Prioridad alta" description="8 prospectos interesados sin cita programada." />
          <DecisionCard level="risk" title="Riesgo comercial" description="5 seguimientos vencidos hoy requieren contacto inmediato." />
          <DecisionCard level="opportunity" title="Oportunidad" description="Predio Norte concentra mayor intención de compra esta semana." />
          <DecisionCard level="recommendation" title="Recomendación" description="Reasignar leads calientes al vendedor con mejor cierre." />
        </div>
      </SectionCard>

      <SectionCard title="Resumen ejecutivo inteligente">
        <p className="executive-text">El foco operativo del día es convertir interesados en visitas guiadas. Se recomienda atender primero vencidos, confirmar citas de hoy y cerrar seguimiento con leads de presupuesto definido.</p>
      </SectionCard>

      <SectionCard title="Embudo comercial visual">
        <div className="funnel-steps">{[['Mensajes', 100], ['Prospectos', 72], ['Interesados', 58], ['Citas', 39], ['Separaciones', 21], ['Clientes', 16]].map((item) => <div key={item[0]}><label>{item[0]}</label><span style={{ width: `${item[1]}%` }} /></div>)}</div>
      </SectionCard>

      <SectionCard title="Rendimiento por vendedor">
        <div className="table-premium-wrap"><table className="table-premium"><thead><tr><th>Vendedor</th><th>Leads</th><th>Citas</th><th>Separaciones</th><th>Conversión</th><th>Pendientes</th></tr></thead>
          <tbody>
            <tr><td>Vendedor A</td><td>18</td><td>8</td><td>3</td><td>26%</td><td>4</td></tr>
            <tr><td>Vendedor B</td><td>16</td><td>6</td><td>2</td><td>20%</td><td>6</td></tr>
          </tbody>
        </table></div>
      </SectionCard>
    </div>
  );
}

export default OwnerDashboardPage;
