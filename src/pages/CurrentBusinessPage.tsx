import { useMemo } from 'react';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import { getHistoricalSalesStore, isHistoricalSalesStoreValid } from '../lib/historicalSalesStorage';

type Props = {
  historicalMetrics: ReturnType<typeof import('../lib/historicalMetrics').getHistoricalMetrics>;
};

export default function CurrentBusinessPage({ historicalMetrics }: Props) {
  const historicalSales = useMemo(() => getHistoricalSalesStore(), []);
  const hasHistoricalSource = isHistoricalSalesStoreValid(historicalSales);

  const metrics = hasHistoricalSource && historicalSales ? {
    totalClients: historicalSales.summary.currentClients,
    properties: historicalSales.summary.totalProperties ?? historicalSales.summary.topProperties.length,
    lotsAvailable: historicalSales.summary.availableLots ?? historicalSales.summary.freeLots,
    lotsSold: historicalSales.summary.soldLots ?? historicalSales.summary.currentClients,
    lotsReserved: historicalSales.summary.reservedLots ?? historicalSales.summary.reservedOrInternalLots,
    averagePaidPercentage: 'Pendiente',
    totalPendingBalance: 'Pendiente',
  } : {
    totalClients: historicalMetrics.totalClients,
    properties: historicalMetrics.properties.length,
    lotsAvailable: historicalMetrics.lotsAvailable,
    lotsSold: historicalMetrics.lotsSold,
    lotsReserved: historicalMetrics.lotsReserved,
    averagePaidPercentage: `${historicalMetrics.averagePaidPercentage}% (referencia local)`,
    totalPendingBalance: `$${historicalMetrics.totalPendingBalance.toLocaleString('es-MX')} MXN (referencia local)`,
  };

  const observations = hasHistoricalSource && historicalSales ? [
    `Predio principal: ${historicalSales.summary.topProperties[0]?.name ?? 'N/A'}. Sugerencia: concentrar seguimiento comercial en este predio.`,
    `Lotes libres: ${historicalSales.summary.freeLots}. Sugerencia: priorizar cierres y apartados esta semana.`,
    `Vendedor líder: ${historicalSales.summary.topSellers[0]?.name ?? 'N/A'}. Sugerencia: revisión de cartera por vendedor.`,
  ] : [
    'Predio Norte: Priorizar cobranza preventiva en contratos reservados locales.',
    'Predio Sur: Empujar cierres de lotes libres con seguimiento comercial local.',
  ];

  return <div className="page-grid">
    <SectionCard title="Negocio actual" subtitle="Resumen comercial construido con el histórico local cargado desde Excel.">
      <p className="muted"><strong>Histórico local disponible.</strong> Los datos se muestran desde la carga local del navegador.</p>
    </SectionCard>
    <section className="stats-grid">{[
      ['Clientes actuales', String(metrics.totalClients)],
      ['Predios', String(metrics.properties)],
      ['Lotes libres', String(metrics.lotsAvailable)],
      ['Lotes vendidos', String(metrics.lotsSold)],
      ['Lotes reservados', String(metrics.lotsReserved)],
      ['% promedio pagado', String(metrics.averagePaidPercentage)],
      ['Saldo pendiente total', String(metrics.totalPendingBalance)],
    ].map(([l, v]) => <StatCard key={l} label={l} value={v} />)}</section>
    <SectionCard title="Fuente de datos"><p className="muted"><strong>{hasHistoricalSource ? 'Histórico cargado desde Excel.' : 'Información cargada en este navegador.'}</strong></p></SectionCard>
    <SectionCard title="Observaciones importantes"><ul>{observations.map((obs) => <li key={obs}>{obs}</li>)}</ul></SectionCard>
  </div>;
}
