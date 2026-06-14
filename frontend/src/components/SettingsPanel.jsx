export function SettingsPanel({
  open,
  onClose,
  backendUrl,
  setBackendUrl,
  reviewer,
  setReviewer,
  theme,
  setTheme,
  onPing,
  online,
}) {
  if (!open) return null;

  return (
    <>
      <button className="settings-overlay" aria-label="Close settings" onClick={onClose} />
      <aside className="settings-panel" role="dialog" aria-label="Application settings">
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="btn icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="settings-body">
          <div className="settings-group">
            <h3>Connection</h3>
            <label>
              API Endpoint
              <input value={backendUrl} onChange={(e) => setBackendUrl(e.target.value)} placeholder="http://localhost:8000" />
            </label>
            <div className="settings-row">
              <button className="btn" onClick={onPing}>
                Test Connection
              </button>
              <span className={`status-chip ${online ? "online" : ""}`}>
                {online ? "Connected" : "Offline"}
              </span>
            </div>
          </div>

          <div className="settings-group">
            <h3>Reviewer</h3>
            <label>
              Reviewer ID
              <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="enterprise_reviewer" />
            </label>
            <p className="settings-hint">Used when approving or rejecting review cases.</p>
          </div>

          <div className="settings-group">
            <h3>Appearance</h3>
            <label>
              Theme
              <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </label>
          </div>
        </div>
      </aside>
    </>
  );
}
