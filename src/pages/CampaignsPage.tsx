import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';

export default function CampaignsPage() {
  return <div className="page-grid"><section className="stats-grid">{[['Campañas activas','4'],['Mensajes recibidos','240'],['Leads guardados','62'],['Interesados','31'],['Citas','17'],['Separaciones','6']].map(([l,v])=><StatCard key={l} label={l} value={v} />)}</section><SectionCard title="Rendimiento por campaña"><table><thead><tr><th>Campaña</th><th>Leads</th><th>Citas</th><th>Separaciones</th><th>Costo por lead</th></tr></thead><tbody><tr><td>Predio Norte - Meta Ads</td><td>28</td><td>9</td><td>4</td><td>$120 MXN (mock)</td></tr><tr><td>Predio Sur - WhatsApp Click</td><td>34</td><td>8</td><td>2</td><td>$98 MXN (mock)</td></tr></tbody></table></SectionCard></div>;
}
