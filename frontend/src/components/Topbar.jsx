import { ALL_NAV_ITEMS, NAV_SECTIONS } from "../lib/constants";
import { Icons } from "./Icons";

export function Topbar({
  view,
  online,
  onOpenSettings,
  onOpenMenu,
  onNavigate,
}) {
  const current = ALL_NAV_ITEMS.find((item) => item.id === view);
  const section = NAV_SECTIONS.find((s) => s.items.some((item) => item.id === view));

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="btn icon-btn mobile-menu-btn" onClick={onOpenMenu} aria-label="Open menu">
          <Icons.Menu />
        </button>
        <div>
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <button className="crumb" onClick={() => onNavigate("dashboard")}>
              Home
            </button>
            {section ? (
              <>
                <span className="crumb-sep">/</span>
                <span className="crumb muted">{section.label}</span>
              </>
            ) : null}
            {current ? (
              <>
                <span className="crumb-sep">/</span>
                <span className="crumb current">{current.shortLabel || current.label}</span>
              </>
            ) : null}
          </nav>
          <h1>{current?.label || "Dashboard"}</h1>
          <p className="subtitle">{current?.description}</p>
        </div>
      </div>

      <div className="topbar-actions">
        <span className={`status-dot ${online ? "online" : ""}`}>
          {online ? "Online" : "Offline"}
        </span>
        <button className="btn icon-btn" onClick={onOpenSettings} aria-label="Open settings">
          <Icons.Settings />
        </button>
      </div>
    </header>
  );
}
