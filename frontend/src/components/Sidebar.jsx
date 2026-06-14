import { NAV_ICONS } from "./Icons";
import { NAV_SECTIONS } from "../lib/constants";

export function Sidebar({
  view,
  onNavigate,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  badges = {},
}) {
  return (
    <>
      {mobileOpen ? <button className="sidebar-overlay" aria-label="Close menu" onClick={onCloseMobile} /> : null}
      <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-mark">K1</div>
            {!collapsed ? (
              <div>
                <div className="brand-title">K-1 Intelligence</div>
                <div className="brand-subtitle">Tax Document Console</div>
              </div>
            ) : null}
          </div>

          <button
            className="btn icon-btn collapse-btn desktop-only"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>

        <nav className="nav" aria-label="Main navigation">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="nav-section">
              {!collapsed ? <div className="nav-section-label">{section.label}</div> : null}
              {section.items.map((item) => {
                const Icon = NAV_ICONS[item.id];
                const badge = item.badgeKey ? badges[item.badgeKey] : null;
                return (
                  <button
                    key={item.id}
                    className={`nav-button ${view === item.id ? "active" : ""}`}
                    onClick={() => {
                      onNavigate(item.id);
                      onCloseMobile?.();
                    }}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon />
                    {!collapsed ? (
                      <>
                        <span className="nav-label">{item.label}</span>
                        {badge ? <span className="nav-badge">{badge}</span> : null}
                      </>
                    ) : badge ? (
                      <span className="nav-badge-dot" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {!collapsed ? (
          <div className="sidebar-help">
            <p>Need help? Start on the Dashboard, upload PDFs, then review extracted fields.</p>
          </div>
        ) : null}
      </aside>
    </>
  );
}
