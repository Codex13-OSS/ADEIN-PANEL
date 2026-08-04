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
    <SectionCard title="Negocio actual" subtitle="Actividad comercial registrada en el CRM.">
      <p className="muted">Inventario, cobranza y saldos se mostrarán cuando exista una fuente operativa autorizada. Esta vista no usa estimaciones.</p>
    </SectionCard>
    <section className="stats-grid">{[
      ['Prospectos registrados', String(summary.total)],
      ['Predios con interés', String(properties.length)],
      ['Prioridad alta', String(summary.highPriority)],
      ['Citas agendadas', String(summary.appointments)],
      ['Revisión manual', String(summary.manualReview)],
    ].map(([l, v]) => <StatCard key={l} label={l} value={v} />)}</section>
    <SectionCard title="Predios con actividad"><p className="muted">{properties.length ? properties.join(' · ') : 'Aún no hay predios registrados en el CRM.'}</p></SectionCard>
  </div>;
}
