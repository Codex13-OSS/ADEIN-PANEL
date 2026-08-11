import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import { Prospect } from '../types/crm';
import { summarizeProspects } from '../lib/crmProspectList.mjs';

type Props = {
  prospects: Prospect[];
};

export default function CurrentBusinessPage({ prospects }: Props) {
  const summary = summarizeProspects(prospects);
  const properties = [...new Set(prospects.map((item) => item.property).filter(Boolean))];

  return <div className="page-grid">
    <SectionCard title="Mi negocio" subtitle="Así va tu operación hoy.">
      <p className="muted">Solo mostramos datos que ya están en tu CRM. Pronto se integrarán ventas, inventario y cobranza.</p>
    </SectionCard>
    <section className="stats-grid">{[
      ['Prospectos registrados', String(summary.total)],
      ['Predios con interés', String(properties.length)],
      ['Por atender', String(summary.total - summary.attended - summary.manualReview)],
      ['Citas agendadas', String(summary.appointments)],
      ['Prospectos atendidos', String(summary.attended)],
      ['Por revisar', String(summary.manualReview)],
    ].map(([l, v]) => <StatCard key={l} label={l} value={v} />)}</section>
    <SectionCard title="Predios con actividad"><p className="muted">{properties.length ? properties.join(' · ') : 'Aún no hay predios registrados.'}</p></SectionCard>
  </div>;
}
