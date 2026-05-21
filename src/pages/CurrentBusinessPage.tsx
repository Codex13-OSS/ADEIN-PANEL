import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';

type Props = {
  historicalMetrics: ReturnType<typeof import('../lib/historicalMetrics').getHistoricalMetrics>;
};

export default function CurrentBusinessPage({ historicalMetrics }: Props) {
  return <div className="page-grid"><section className="stats-grid">{[['Clientes actuales', String(historicalMetrics.totalClients)], ['Predios', String(historicalMetrics.properties.length)], ['Lotes libres', String(historicalMetrics.lotsAvailable)], ['Lotes vendidos', String(historicalMetrics.lotsSold)], ['Lotes reservados', String(historicalMetrics.lotsReserved)], ['% promedio pagado', `${historicalMetrics.averagePaidPercentage}%`], ['Saldo pendiente total', `$${historicalMetrics.totalPendingBalance.toLocaleString('es-MX')} MXN`]].map(([l, v]) => <StatCard key={l} label={l} value={v} />)}</section><SectionCard title="Observaciones importantes"><table><thead><tr><th>Predio</th><th>Estado</th><th>Observación</th></tr></thead><tbody><tr><td>Predio Demo Norte</td><td>Movimiento medio</td><td>Priorizar cobranza preventiva en contratos reservados.</td></tr><tr><td>Predio Demo Sur</td><td>Estable</td><td>Empujar cierres de lotes libres con seguimiento comercial.</td></tr></tbody></table></SectionCard></div>;
}
