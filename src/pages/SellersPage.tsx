import SectionCard from '../components/SectionCard';

type Props = {
  historicalMetrics: ReturnType<typeof import('../lib/historicalMetrics').getHistoricalMetrics>;
};

export default function SellersPage({ historicalMetrics }: Props) {
  return <div className="page-grid"><SectionCard title="Equipo de vendedores"><table><thead><tr><th>Vendedor</th><th>Clientes asignados</th><th>Seguimientos pendientes</th><th>Cobranza en riesgo</th><th>Última actividad</th></tr></thead><tbody>{historicalMetrics.sellerMetrics.map((item) => <tr key={item.sellerName}><td>{item.sellerName}</td><td>{item.assignedClients}</td><td>{item.pendingFollowups}</td><td>{item.collectionAtRisk}</td><td>{item.lastActivity}</td></tr>)}</tbody></table></SectionCard></div>;
}
