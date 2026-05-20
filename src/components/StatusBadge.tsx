type Props = { tone?: 'success' | 'warning' | 'danger'; children: string };

function StatusBadge({ tone = 'success', children }: Props) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export default StatusBadge;
