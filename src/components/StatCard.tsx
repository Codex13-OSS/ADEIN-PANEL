import CardIcon from './CardIcon';
import { iconForLabel } from '../lib/cardIconMap.mjs';

type Props = { label: string; value: string; hint?: string; accent?: string };

function StatCard({ label, value, hint, accent }: Props) {
  return (
    <article className="stat-card" style={accent ? { borderLeft: `3px solid ${accent}30`, borderLeftStyle: 'solid' } : undefined}>
      <div className="stat-card-top"><p>{label}</p><CardIcon name={iconForLabel(label)} /></div>
      <h3>{value}</h3>
      {hint && <small>{hint}</small>}
    </article>
  );
}

export default StatCard;
