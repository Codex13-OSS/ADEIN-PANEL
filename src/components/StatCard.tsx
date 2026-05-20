type Props = { label: string; value: string; hint?: string };

function StatCard({ label, value, hint }: Props) {
  return (
    <article className="stat-card">
      <p>{label}</p>
      <h3>{value}</h3>
      {hint && <small>{hint}</small>}
    </article>
  );
}

export default StatCard;
