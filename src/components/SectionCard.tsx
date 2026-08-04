import { ReactNode } from 'react';
import CardIcon from './CardIcon';
import { iconForLabel } from '../lib/cardIconMap.mjs';

type Props = { title: string; subtitle?: string; children: ReactNode };

function SectionCard({ title, subtitle, children }: Props) {
  return (
    <section className="section-card">
      <header>
        <div className="card-heading"><CardIcon name={iconForLabel(title)} /><h2>{title}</h2></div>
        {subtitle && <p>{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

export default SectionCard;
