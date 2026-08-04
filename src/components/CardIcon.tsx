import { ReactNode } from 'react';
import { CardIconName } from '../lib/cardIconMap.mjs';

type Props = { name: CardIconName };

export default function CardIcon({ name }: Props) {
  const paths: Record<CardIconName, ReactNode> = {
    users: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20c.6-3.2 2.5-5 5.5-5s4.9 1.8 5.5 5" /><path d="M16 11c2.4.2 3.8 1.7 4.3 4.4" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4M17 3v4M3 10h18" /><path d="M8 14h3M13 14h3M8 18h3" /></>,
    alert: <><path d="M12 3 22 20H2L12 3Z" /><path d="M12 9v5M12 17h.01" /></>,
    review: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4M11 8v3l2 2" /></>,
    property: <><path d="m3 11 9-7 9 7v10H3V11Z" /><path d="M9 21v-6h6v6" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
    spark: <><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z" /></>,
  };
  return <span className="card-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg></span>;
}
