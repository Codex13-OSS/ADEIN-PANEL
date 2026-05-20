import { ReactNode } from 'react';

type Props = { title: string; subtitle?: string; children: ReactNode };

function SectionCard({ title, subtitle, children }: Props) {
  return (
    <section className="section-card">
      <header>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

export default SectionCard;
