type Props = { title: string; description: string; level: 'high' | 'risk' | 'opportunity' | 'recommendation' };

function DecisionCard({ title, description, level }: Props) {
  return (
    <article className={`decision-card ${level}`}>
      <h4>{title}</h4>
      <p>{description}</p>
    </article>
  );
}

export default DecisionCard;
