import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { SettingsPanel } from "./components/SettingsPanel";
import { Toast } from "./components/Toast";
import { Topbar } from "./components/Topbar";
import { useApi } from "./hooks/useApi";
import { useAppSettings } from "./hooks/useAppSettings";
import { getRouteFromHash, setHashForRoute } from "./lib/constants";
import { Approval } from "./pages/Approval";
import { Dashboard } from "./pages/Dashboard";
import { Ingestion } from "./pages/Ingestion";
import { ModelOps } from "./pages/ModelOps";
import { SearchVault } from "./pages/SearchVault";
import { ValidationSettings } from "./pages/ValidationSettings";
import { Chat } from "./pages/Chat";

export default function App() {
  const settings = useAppSettings();
  const [view, setView] = useState(getRouteFromHash);
  const [online, setOnline] = useState(false);
  const [toast, setToast] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [badges, setBadges] = useState({});
  const [enabledRules, setEnabledRules] = useState({
    ein_required: true,
    tax_year_valid: true,
    k1_box1_positive: false,
    require_document_type: true,
  });

  const [ingestionFiles, setIngestionFiles] = useState([]);
  const [ingestionTask, setIngestionTask] = useState(null);
  const [ingestionBusy, setIngestionBusy] = useState(false);

  const notify = useCallback((message, type = "info") => {
    setToast({ message, type });
    window.clearTimeout(window.__taxdxToast);
    window.__taxdxToast = window.setTimeout(() => setToast(null), 4200);
  }, []);

  const api = useApi(settings.backendUrl, notify);

  const navigate = useCallback((routeId) => {
    setView(routeId);
    setHashForRoute(routeId);
  }, []);

  useEffect(() => {
    const onHashChange = () => setView(getRouteFromHash());
    window.addEventListener("hashchange", onHashChange);
    if (!window.location.hash) setHashForRoute("dashboard");
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const ping = useCallback(async () => {
    const result = await api.guarded(() => api.get("/health"), null);
    setOnline(Boolean(result));
    if (result) notify("Backend connected.", "success");
    else notify("Backend connection failed.", "error");
  }, [api, notify]);

  useEffect(() => {
    ping();
  }, [settings.backendUrl]);

  const handleStatsChange = useCallback((summary) => {
    setBadges({ pending_review: summary.pending_review || 0 });
  }, []);

  return (
    <div className={`app-shell ${settings.sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar
        view={view}
        onNavigate={navigate}
        collapsed={settings.sidebarCollapsed}
        onToggleCollapse={() => settings.setSidebarCollapsed(!settings.sidebarCollapsed)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        badges={badges}
      />

      <main className="main">
        <Topbar
          view={view}
          online={online}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenMenu={() => setMobileNavOpen(true)}
          onNavigate={navigate}
        />

        <div className="page-content">
          {view === "dashboard" && (
            <Dashboard api={api} onNavigate={navigate} onStatsChange={handleStatsChange} />
          )}
          {view === "ingestion" && (
            <Ingestion
              api={api}
              notify={notify}
              files={ingestionFiles}
              setFiles={setIngestionFiles}
              task={ingestionTask}
              setTask={setIngestionTask}
              busy={ingestionBusy}
              setBusy={setIngestionBusy}
            />
          )}
          {view === "approval" && (
            <Approval api={api} reviewer={settings.reviewer} notify={notify} onNavigate={navigate} />
          )}
          {view === "search" && <SearchVault api={api} notify={notify} />}
          {view === "chat" && <Chat api={api} notify={notify} />}
          {view === "rules" && <ValidationSettings rules={enabledRules} setRules={setEnabledRules} />}
          {view === "models" && <ModelOps api={api} notify={notify} />}
        </div>
      </main>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        backendUrl={settings.backendUrl}
        setBackendUrl={settings.setBackendUrl}
        reviewer={settings.reviewer}
        setReviewer={settings.setReviewer}
        theme={settings.theme}
        setTheme={settings.setTheme}
        onPing={ping}
        online={online}
      />

      <Toast toast={toast} />
    </div>
  );
}
