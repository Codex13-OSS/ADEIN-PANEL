import SectionCard from '../components/SectionCard';

export default function SellersPage() {
  return <div className="page-grid"><SectionCard title="Equipo de vendedores"><table><thead><tr><th>Vendedor</th><th>Leads asignados</th><th>Seguimientos pendientes</th><th>Conversión</th><th>Última actividad</th></tr></thead><tbody><tr><td>Vendedor A</td><td>18</td><td>4</td><td>26%</td><td>Hace 10 min</td></tr><tr><td>Vendedor B</td><td>16</td><td>6</td><td>20%</td><td>Hace 35 min</td></tr></tbody></table></SectionCard></div>;
}
