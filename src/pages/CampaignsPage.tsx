import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';

type Props = {
  historicalMetrics: ReturnType<typeof import('../lib/historicalMetrics').getHistoricalMetrics>;
};

export default function CampaignsPage({ historicalMetrics }: Props) {
  return <div className="page-grid"><section className="stats-grid">{[['Campañas activas', '0'], ['Mensajes recibidos', '0'], ['Leads guardados', '0'], ['Interesados', '0'], ['Pagos próximos', String(historicalMetrics.upcomingPayments.length)], ['Cobranza semana', `$${historicalMetrics.expectedCollectionWeek.toLocaleString('es-MX')} MXN`]].map(([l, v]) => <StatCard key={l} label={l} value={v} />)}</section><SectionCard title="Rendimiento por campaña"><p className="muted">Sin campañas registradas. Los datos se cargarán cuando exista una fuente operativa autorizada.</p></SectionCard></div>;
}
