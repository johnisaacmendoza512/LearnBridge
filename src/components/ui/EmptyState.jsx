export default function EmptyState({ icon = '📭', title, description, action }) {
  return (
    <div className="empty-state">
      <div className="icon">{icon}</div>
      <h3>{title}</h3>
      {description && <p className="text-sm text-muted mt-8">{description}</p>}
      {action && <div className="mt-16">{action}</div>}
    </div>
  );
}
