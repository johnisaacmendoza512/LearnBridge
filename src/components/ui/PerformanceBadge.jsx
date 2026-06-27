import Badge from './Badge';

const map = {
  good:             { label: 'Good',             variant: 'success' },
  improving:        { label: 'Improving',         variant: 'info'    },
  needs_improvement:{ label: 'Needs Improvement', variant: 'warning' },
};

export default function PerformanceBadge({ value }) {
  const { label, variant } = map[value] || map.improving;
  return <Badge variant={variant}>{label}</Badge>;
}
