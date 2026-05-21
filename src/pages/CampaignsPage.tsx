import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';

type Props = {
  historicalMetrics: ReturnType<typeof import('../lib/historicalMetrics').getHistoricalMetrics>;
};

export default function CampaignsPage({ historicalMetrics }: Props) {
  return <div className="page-grid"><section className="stats-grid">{[['Campañas activas', '4'], ['Mensajes recibidos', '240'], ['Leads guardados', '62'], ['Interesados', '31'], ['Pagos próximos', String(historicalMetrics.upcomingPayments.length)], ['Cobranza semana', `$${historicalMetrics.expectedCollectionWeek.toLocaleString('es-MX')} MXN`]].map(([l, v]) => <StatCard key={l} label={l} value={v} />)}</section><SectionCard title="Rendimiento por campaña"><table><thead><tr><th>Campaña</th><th>Leads</th><th>Citas</th><th>Separaciones</th><th>Costo por lead</th></tr></thead><tbody><tr><td>Predio Demo Norte - Meta Ads</td><td>28</td><td>9</td><td>4</td><td>$120 MXN (mock)</td></tr><tr><td>Predio Demo Sur - WhatsApp Click</td><td>34</td><td>8</td><td>2</td><td>$98 MXN (mock)</td></tr></tbody></table></SectionCard></div>;
}
