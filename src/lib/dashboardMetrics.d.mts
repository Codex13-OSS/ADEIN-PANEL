export type DashboardSummary = {
  total: number;
  highPriority: number;
  appointments: number;
  manualReview: number;
  attended: number;
};

export type DashboardChart = {
  key: 'attended' | 'appointments' | 'manualReview';
  label: string;
  value: number;
  percentage: number;
  tone: 'attended' | 'appointments' | 'review';
};

export function buildDashboardCharts(summary: DashboardSummary): DashboardChart[];
