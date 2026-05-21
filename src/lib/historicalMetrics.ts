import { historicalFixtures } from '../data/historicalFixtures';

const toDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

export function getHistoricalMetrics(referenceDate = new Date('2026-05-21T12:00:00.000Z')) {
  const { clients, lots, contracts, paymentSchedule, collectionStatus, sellers } = historicalFixtures;
  const start = new Date(referenceDate);
  start.setUTCHours(0, 0, 0, 0);
  const weekEnd = new Date(start);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  const monthStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));

  const expectedToday = paymentSchedule.filter((i) => toDate(i.due_date).getTime() === start.getTime()).reduce((sum, i) => sum + i.expected_amount, 0);
  const expectedWeek = paymentSchedule.filter((i) => toDate(i.due_date) >= start && toDate(i.due_date) < weekEnd).reduce((sum, i) => sum + i.expected_amount, 0);
  const expectedMonth = paymentSchedule.filter((i) => toDate(i.due_date) >= monthStart && toDate(i.due_date) < monthEnd).reduce((sum, i) => sum + i.expected_amount, 0);

  const totalContractAmount = contracts.reduce((sum, i) => sum + i.total_amount, 0);
  const totalPaidAmount = contracts.reduce((sum, i) => sum + i.paid_amount, 0);

  const sellerMetrics = sellers.map((seller) => {
    const assignedClients = clients.filter((client) => client.seller_id === seller.id).length;
    const riskCount = collectionStatus.filter((item) => item.seller_id === seller.id && item.risk_level !== 'bajo').length;
    return {
      sellerName: seller.name,
      assignedClients,
      pendingFollowups: riskCount + 1,
      collectionAtRisk: riskCount,
      lastActivity: seller.id === 'seller-a' ? 'Hoy 09:40' : 'Hoy 09:05',
    };
  });

  const highestRisk = collectionStatus.find((item) => item.risk_level === 'alto');

  return {
    totalClients: clients.length,
    lotsSold: lots.filter((lot) => lot.status === 'vendido').length,
    lotsAvailable: lots.filter((lot) => lot.status === 'libre').length,
    lotsReserved: lots.filter((lot) => lot.status === 'reservado').length,
    expectedCollectionToday: expectedToday,
    expectedCollectionWeek: expectedWeek,
    expectedCollectionMonth: expectedMonth,
    clientsOverdue: clients.filter((client) => client.status === 'atrasado').length,
    clientsCurrent: clients.filter((client) => client.status === 'al_corriente').length,
    upcomingPayments: paymentSchedule.filter((item) => toDate(item.due_date) >= start && toDate(item.due_date) < weekEnd),
    averagePaidPercentage: totalContractAmount ? Math.round((totalPaidAmount / totalContractAmount) * 100) : 0,
    totalPendingBalance: totalContractAmount - totalPaidAmount,
    collectionRiskAlerts: collectionStatus.filter((item) => item.risk_level !== 'bajo'),
    highestRiskAlert: highestRisk,
    recoveryOpportunity: highestRisk ? Math.round((highestRisk.days_overdue / 30) * 100) : 0,
    properties: historicalFixtures.properties,
    sellerMetrics,
  };
}
