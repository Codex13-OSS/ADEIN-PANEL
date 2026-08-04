export function buildDashboardCharts(summary) {
  const total = Number(summary.total) || 0;
  const percentage = (value) => total > 0 ? Math.round((Number(value) / total) * 100) : 0;

  return [
    { key: 'attended', label: 'Prospectos atendidos', value: Number(summary.attended) || 0, percentage: percentage(summary.attended), tone: 'attended' },
    { key: 'appointments', label: 'Citas agendadas', value: Number(summary.appointments) || 0, percentage: percentage(summary.appointments), tone: 'appointments' },
    { key: 'manualReview', label: 'Revisión manual', value: Number(summary.manualReview) || 0, percentage: percentage(summary.manualReview), tone: 'review' },
  ];
}
