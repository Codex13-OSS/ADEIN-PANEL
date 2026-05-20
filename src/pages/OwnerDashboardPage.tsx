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
          <DecisionCard level="high" title="Prioridad alta" description="8 prospectos interesados sin cita." />
          <DecisionCard level="risk" title="Riesgo comercial" description="5 seguimientos vencidos hoy." />
          <DecisionCard level="opportunity" title="Oportunidad" description="Predio Norte con mayor demanda esta semana." />
          <DecisionCard level="recommendation" title="Recomendación" description="Reasignar leads al vendedor con mejor conversión." />
        </div>
      </SectionCard>

      <SectionCard title="Resumen inteligente del día">
        <p className="executive-text">Hoy la operación muestra buen volumen de prospectos, pero la prioridad está en convertir interesados a citas. Se recomienda atender primero los seguimientos vencidos y los leads con intención alta.</p>
      </SectionCard>

      <SectionCard title="Embudo comercial visual">
        <div className="funnel">{['Mensajes', 'Prospectos', 'Interesados', 'Citas', 'Separaciones', 'Clientes'].map((s) => <span key={s}>{s}</span>)}</div>
      </SectionCard>

      <SectionCard title="Rendimiento por vendedor">
        <table><thead><tr><th>Vendedor</th><th>Leads</th><th>Citas</th><th>Separaciones</th><th>Conversión</th><th>Pendientes</th></tr></thead>
          <tbody>
            <tr><td>Vendedor A</td><td>18</td><td>8</td><td>3</td><td>26%</td><td>4</td></tr>
            <tr><td>Vendedor B</td><td>16</td><td>6</td><td>2</td><td>20%</td><td>6</td></tr>
          </tbody>
        </table>
      </SectionCard>

      <SectionCard title="Actividad reciente">
        <ul className="activity-list">
          <li>Vendedor A registró seguimiento para Prospecto Demo.</li>
          <li>Nuevo lead entrante desde campaña Predio Sur.</li>
          <li>Se confirmó cita para mañana en Predio Norte.</li>
        </ul>
      </SectionCard>
    </div>
  );
}

export default OwnerDashboardPage;
