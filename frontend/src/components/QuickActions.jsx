import { Icons } from "./Icons";

export function QuickActions({ onNavigate, pendingReview = 0 }) {
  const actions = [
    {
      id: "ingestion",
      title: "Upload PDFs",
      description: "Start a new extraction run",
      icon: Icons.Upload,
      accent: "cyan",
    },
    {
      id: "approval",
      title: "Review Queue",
      description: pendingReview ? `${pendingReview} cases waiting` : "No pending reviews",
      icon: Icons.Review,
      accent: "amber",
      badge: pendingReview || null,
    },
    {
      id: "search",
      title: "Search Vault",
      description: "Find processed documents",
      icon: Icons.Search,
      accent: "indigo",
    },
  ];

  return (
    <div className="quick-actions">
      {actions.map(({ id, title, description, icon: Icon, accent, badge }) => (
        <button key={id} className={`quick-action-card ${accent}`} onClick={() => onNavigate(id)}>
          <div className="quick-action-icon">
            <Icon />
          </div>
          <div className="quick-action-text">
            <span className="quick-action-title">
              {title}
              {badge ? <span className="nav-badge">{badge}</span> : null}
            </span>
            <span className="quick-action-desc">{description}</span>
          </div>
          <Icons.ChevronRight />
        </button>
      ))}
    </div>
  );
}
