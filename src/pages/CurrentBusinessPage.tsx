import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';

export default function CurrentBusinessPage() {
  return <div className="page-grid"><section className="stats-grid">{[['Clientes actuales','32'],['Predios','2'],['Manzanas','9'],['Lotes libres','47'],['Lotes vendidos','32'],['Lotes reservados','7']].map(([l,v])=><StatCard key={l} label={l} value={v} />)}</section><SectionCard title="Observaciones importantes"><table><thead><tr><th>Predio</th><th>Estado</th><th>Observación</th></tr></thead><tbody><tr><td>Predio Norte</td><td>Alto movimiento</td><td>Priorizar lotes cercanos a vialidad principal.</td></tr><tr><td>Predio Sur</td><td>Estable</td><td>Incrementar seguimiento de leads fríos.</td></tr></tbody></table></SectionCard></div>;
}
