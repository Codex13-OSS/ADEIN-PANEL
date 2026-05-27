type Props = { label: string; value: string; hint?: string; accent?: string };

function StatCard({ label, value, hint, accent }: Props) {
  return (
    <article className="stat-card" style={accent ? { borderTopColor: accent } : undefined}>
      <p>{label}</p>
      <h3>{value}</h3>
      {hint && <small>{hint}</small>}
    </article>
  );
}

export default StatCard;
