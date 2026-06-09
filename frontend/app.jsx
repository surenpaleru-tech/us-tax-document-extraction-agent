const { useEffect, useMemo, useRef, useState } = React;

// Premium SVG Icons
const Icons = {
  Dashboard: () => (
    <svg className="nav-icon" viewBox="0 0 24 24">
      <path d="M19 5v2h-4V5h4M9 5v6H5V5h4m10 8v6h-4v-6h4M9 17v2H5v-2h4M21 3h-8v6h8V3zM11 3H3v10h8V3zm10 8h-8v10h8V11zm-10 4H3v6h8v-6z"/>
    </svg>
  ),
  Ingestion: () => (
    <svg className="nav-icon" viewBox="0 0 24 24">
      <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
    </svg>
  ),
  Approval: () => (
    <svg className="nav-icon" viewBox="0 0 24 24">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </svg>
  ),
  Search: () => (
    <svg className="nav-icon" viewBox="0 0 24 24">
      <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
    </svg>
  ),
  Models: () => (
    <svg className="nav-icon" viewBox="0 0 24 24">
      <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/>
    </svg>
  ),
  Rules: () => (
    <svg className="nav-icon" viewBox="0 0 24 24">
      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
    </svg>
  )
};

const NAV = [
  ["dashboard", "Command Center", Icons.Dashboard],
  ["ingestion", "Ingestion Engine", Icons.Ingestion],
  ["approval", "K-1 Approval Flow", Icons.Approval],
  ["search", "Search Vault", Icons.Search],
  ["rules", "Validation Rules", Icons.Rules],
  ["models", "Model Ops", Icons.Models],
];

const DEFAULT_BACKEND = "http://localhost:8000";

const K1_BOX_DESCRIPTIONS = {
  "1": "Ordinary business income (loss)",
  "2": "Net rental real estate income (loss)",
  "3": "Other net rental income (loss)",
  "4": "Guaranteed payments",
  "5": "Interest income",
  "6a": "Ordinary dividends",
  "6b": "Qualified dividends",
  "7": "Royalties",
  "8": "Net short-term capital gain (loss)",
  "9a": "Net long-term capital gain (loss)",
  "10": "Net section 1231 gain (loss)",
  "11": "Other income (loss)",
  "12": "Section 179 deduction",
  "13": "Other deductions",
  "14": "Self-employment earnings (loss)",
  "15": "Credits",
  "16": "Foreign transactions",
  "17": "Alternative minimum tax (AMT) items",
  "18": "Tax-exempt income / nondeductible expenses",
  "19": "Distributions",
  "20": "Other information",
};

function pretty(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function useApi(baseUrl, notify) {
  return useMemo(() => {
    async function request(path, options = {}) {
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, options);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || response.statusText);
      }
      const contentType = response.headers.get("content-type") || "";
      return contentType.includes("application/json") ? response.json() : response.text();
    }
    return {
      get: (path) => request(path),
      post: (path, body) =>
        request(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body || {}),
        }),
      upload: (files) => {
        const form = new FormData();
        Array.from(files).forEach((file) => form.append("files", file));
        return request("/api/upload", { method: "POST", body: form });
      },
      guarded: async (fn, fallback) => {
        try {
          return await fn();
        } catch (error) {
          notify(error.message || "Request failed", "error");
          return fallback;
        }
      },
    };
  }, [baseUrl, notify]);
}

function App() {
  const [view, setView] = useState("dashboard");
  const [backendUrl, setBackendUrl] = useState(localStorage.getItem("taxdxBackend") || DEFAULT_BACKEND);
  const [reviewer, setReviewer] = useState(localStorage.getItem("taxdxReviewer") || "enterprise_reviewer");
  const [online, setOnline] = useState(false);
  const [toast, setToast] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem("taxdxTheme") || "system");
  const [enabledRules, setEnabledRules] = useState({
    ein_required: true,
    tax_year_valid: true,
    k1_box1_positive: false,
    require_document_type: true
  });

  // Hoisted Ingestion States to preserve progress on tab switch
  const [ingestionFiles, setIngestionFiles] = useState([]);
  const [ingestionTask, setIngestionTask] = useState(null);
  const [ingestionBusy, setIngestionBusy] = useState(false);

  const notify = React.useCallback((message, type = "info") => {
    setToast({ message, type });
    window.clearTimeout(window.__taxdxToast);
    window.__taxdxToast = window.setTimeout(() => setToast(null), 4200);
  }, []);

  const api = useApi(backendUrl, notify);

  useEffect(() => {
    localStorage.setItem("taxdxBackend", backendUrl);
  }, [backendUrl]);

  useEffect(() => {
    localStorage.setItem("taxdxReviewer", reviewer);
  }, [reviewer]);

  useEffect(() => {
    localStorage.setItem("taxdxTheme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  async function ping() {
    const result = await api.guarded(() => api.get("/health"), null);
    setOnline(Boolean(result));
    if (result) {
      notify("Backend connected successfully.", "success");
    } else {
      notify("Backend connection failed.", "error");
    }
  }

  useEffect(() => {
    ping();
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand">
            <div className="brand-mark">K1</div>
            <div>
              <div className="brand-title">K-1 Tax Intelligence</div>
              <div className="brand-subtitle">Multi-Agent Extraction</div>
            </div>
          </div>

          <nav className="nav">
            {NAV.map(([id, label, Icon]) => (
              <button key={id} className={`nav-button ${view === id ? "active" : ""}`} onClick={() => setView(id)}>
                <Icon />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-card">
          <label>API Endpoint</label>
          <input value={backendUrl} onChange={(event) => setBackendUrl(event.target.value)} />
          <label>Reviewer ID</label>
          <input value={reviewer} onChange={(event) => setReviewer(event.target.value)} />
          <label>Console Theme</label>
          <select value={theme} onChange={(event) => setTheme(event.target.value)} style={{ marginBottom: 12 }}>
            <option value="light">Light Mode</option>
            <option value="dark">Dark Mode</option>
            <option value="system">System Default</option>
          </select>
          <div className="sidebar-actions">
            <button className="btn ghost" onClick={ping}>Ping</button>
            <button className="btn ghost" onClick={() => window.location.reload()}>Reload</button>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <div className="eyebrow">Enterprise K-1 Tax intelligence console</div>
            <h1>{NAV.find(([id]) => id === view)?.[1]}</h1>
            <p className="subtitle">
              Sleek, multi-agent parsing pipeline to ingest Schedule K-1 forms, extract partnership and financial boxes, and run schema validation.
            </p>
          </div>
          <span className={`status-dot ${online ? "online" : ""}`}>
            {online ? "System Active" : "System Offline"}
          </span>
        </div>

        {view === "dashboard" && <Dashboard api={api} />}
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
        {view === "approval" && <Approval api={api} reviewer={reviewer} notify={notify} />}
        {view === "search" && <SearchVault api={api} notify={notify} />}
        {view === "rules" && <ValidationSettings rules={enabledRules} setRules={setEnabledRules} />}
        {view === "models" && <ModelOps api={api} />}
      </main>

      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </div>
  );
}

function Dashboard({ api }) {
  const [data, setData] = useState({ summary: {}, form_distribution: {}, recent_documents: [] });

  async function load() {
    const result = await api.guarded(() => api.get("/api/dashboard"), data);
    setData(result || data);
  }

  useEffect(() => {
    load();
  }, []);

  const summary = data.summary || {};
  const distribution = Object.entries(data.form_distribution || {});
  const avgConfidence = summary.average_confidence || 0;
  
  // Circular gauge calculations
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (avgConfidence / 100) * circumference;

  return (
    <>
      <div className="grid metrics">
        <div className="card card-pad metric-card teal">
          <div className="metric-label">Total Files</div>
          <div className="metric-value">{pretty(summary.total_files || 0)}</div>
          <div className="metric-hint">Uploaded PDF forms</div>
        </div>
        <div className="card card-pad metric-card cyan">
          <div className="metric-label">Success Rate</div>
          <div className="metric-value">{pretty(summary.processed_successfully || 0)}</div>
          <div className="metric-hint">Cleared without review</div>
        </div>
        <div className="card card-pad metric-card amber">
          <div className="metric-label">Review Queue</div>
          <div className="metric-value">{pretty(summary.pending_review || 0)}</div>
          <div className="metric-hint">Human review required</div>
        </div>
        <div className="card card-pad metric-card violet">
          <div className="metric-label">Avg Confidence</div>
          <div className="gauge-container">
            <svg className="gauge-svg">
              <circle className="gauge-bg" cx="30" cy="30" r={radius} />
              <circle 
                className="gauge-fill" 
                cx="30" 
                cy="30" 
                r={radius} 
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
              />
            </svg>
            <div>
              <div className="metric-value" style={{ marginTop: 0 }}>{avgConfidence}%</div>
            </div>
          </div>
          <div className="metric-hint">Extraction confidence score</div>
        </div>
      </div>

      <div className="grid two-col">
        <div className="card card-pad">
          <div className="section-title">
            <h2>Recent Extractions</h2>
            <button className="btn" onClick={load}>Refresh</button>
          </div>
          <DocumentTable rows={data.recent_documents || []} />
        </div>
        
        <div className="card card-pad">
          <div className="section-title">
            <h2>Form Distribution</h2>
            <span className="pill">{distribution.length} Active Types</span>
          </div>
          {distribution.length ? (
            <div style={{ display: 'grid', gap: '16px', marginTop: '12px' }}>
              {distribution.map(([name, count]) => {
                const total = summary.total_files || 1;
                const pct = Math.min(100, Math.round((count / total) * 100));
                return (
                  <div key={name} style={{ display: 'grid', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                      <span style={{ fontWeight: 600 }}>{name}</span>
                      <span style={{ color: 'var(--muted)' }}>{count} forms ({pct}%)</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '9px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, var(--cyan), var(--indigo))', borderRadius: '9px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty">No extracted documents yet.</div>
          )}
        </div>
      </div>
    </>
  );
}

function DocumentTable({ rows }) {
  if (!rows?.length) return <div className="empty">No documents to show.</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>File Name</th>
            <th>Form Type</th>
            <th>Tax Year</th>
            <th>EIN</th>
            <th>Confidence</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id || row.file_name}>
              <td style={{ fontWeight: 500, color: 'var(--ink-bright)' }}>{row.file_name}</td>
              <td><span className="pill">{row.document_type}</span></td>
              <td>{pretty(row.tax_year)}</td>
              <td style={{ fontFamily: 'JetBrains Mono, monospace' }}>{pretty(row.ein)}</td>
              <td>
                <span style={{ 
                  color: row.confidence_score >= 85 ? 'var(--emerald)' : row.confidence_score >= 70 ? 'var(--amber)' : 'var(--rose)',
                  fontWeight: 700 
                }}>
                  {pretty(row.confidence_score)}%
                </span>
              </td>
              <td>
                <span className={`pill ${row.requires_review ? "warn" : "good"}`}>
                  {row.requires_review ? "Requires Review" : "Validated"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Visual Agent Workflow Graph nodes mapping
const GRAPH_NODES = [
  { id: "load_document", label: "PDF Loader" },
  { id: "extract", label: "Extraction Agent" },
  { id: "validate", label: "Validator Agent" },
  { id: "confidence", label: "Confidence Evaluator" },
  { id: "persist", label: "Database Writer" },
];

function Ingestion({ api, notify, files, setFiles, task, setTask, busy, setBusy }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  async function startUpload(selectedFiles = files) {
    if (!selectedFiles.length) {
      notify("Select one or more PDF files.", "warn");
      return;
    }
    setBusy(true);
    const upload = await api.guarded(() => api.upload(selectedFiles), null);
    if (!upload) {
      setBusy(false);
      return;
    }
    notify("Upload accepted. extraction graph activated.", "success");
    await poll(upload.task_id);
    setBusy(false);
  }

  async function poll(taskId) {
    for (let i = 0; i < 180; i += 1) {
      const current = await api.guarded(() => api.get(`/api/status/${taskId}`), null);
      if (current) setTask(current);
      if (current?.state === "completed" || current?.state === "failed") {
        const isSuccess = current.state === "completed";
        notify(isSuccess ? "Extraction completed successfully." : current.error || "Extraction failed.", isSuccess ? "success" : "error");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  function acceptFiles(fileList) {
    const pdfs = Array.from(fileList || []).filter((file) => file.name.toLowerCase().endsWith(".pdf"));
    setFiles(pdfs);
  }

  // Determine active node index in LangGraph workflow
  const currentNode = task?.current_node;
  const taskState = task?.state;
  
  const nodeStates = useMemo(() => {
    if (taskState === "completed") {
      return GRAPH_NODES.map(() => "completed");
    }
    if (taskState === "failed") {
      const activeIdx = GRAPH_NODES.findIndex(n => n.id === currentNode);
      return GRAPH_NODES.map((_, i) => i < activeIdx ? "completed" : i === activeIdx ? "failed" : "idle");
    }
    
    const activeIdx = GRAPH_NODES.findIndex(n => n.id === currentNode);
    return GRAPH_NODES.map((_, i) => i < activeIdx ? "completed" : i === activeIdx ? "active" : "idle");
  }, [currentNode, taskState]);

  return (
    <div className="grid two-col">
      <div className="card card-pad">
        <div
          className={`dropzone ${dragging ? "dragging" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            acceptFiles(event.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" accept="application/pdf" multiple onChange={(event) => acceptFiles(event.target.files)} />
          <svg className="dropzone-icon" viewBox="0 0 24 24">
            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
          </svg>
          <div>
            <div className="drop-title">Drag & Drop Tax PDFs Here</div>
            <div className="drop-copy">Upload digital or scanned K-1 tax forms. The pipeline activates multi-agent routers automatically.</div>
          </div>
        </div>

        <div style={{ height: 18 }} />
        <div className="toolbar">
          <button className="btn primary" disabled={busy || !files.length} onClick={() => startUpload()}>
            {busy ? "Executing Pipeline..." : "Start Extraction Graph"}
          </button>
          <button className="btn" onClick={() => { setFiles([]); setTask(null); }}>Reset</button>
        </div>
      </div>

      <div className="card card-pad">
        <div className="section-title">
          <h2>Extraction Pipeline</h2>
          <span className="pill">{files.length} Files Queued</span>
        </div>
        {files.length ? (
          <div className="table-wrap" style={{ maxHeight: 160 }}>
            <table>
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Size</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.name}>
                    <td style={{ color: 'var(--ink-bright)' }}>{file.name}</td>
                    <td>{Math.round(file.size / 1024)} KB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <svg className="empty-icon" viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z"/></svg>
            No documents selected.
          </div>
        )}

        {task && (
          <>
            <div style={{ height: 20, borderTop: '1px solid var(--line)', marginTop: 18 }} />
            <div className="section-title">
              <h2>Agent Ingestion Trace</h2>
              <span className={`pill ${taskState === "failed" ? "bad" : taskState === "completed" ? "good" : "warn"}`}>{taskState}</span>
            </div>
            
            <div style={{ fontSize: '13.5px', marginBottom: '8px', color: 'var(--ink-bright)' }}>
              Processing: <strong style={{ color: 'var(--cyan)' }}>{task.current_file || task.files?.join(", ")}</strong>
            </div>

            {/* Visual Agent Graph */}
            <div className="graph-container">
              {GRAPH_NODES.map((node, index) => (
                <React.Fragment key={node.id}>
                  <div className={`graph-node ${nodeStates[index]}`}>
                    <div className="node-circle">
                      {nodeStates[index] === "completed" ? "✓" : index + 1}
                    </div>
                    <span className="node-label">{node.label}</span>
                  </div>
                  {index < GRAPH_NODES.length - 1 && (
                    <div className={`graph-connection ${
                      nodeStates[index] === "completed" && nodeStates[index+1] === "completed" ? "completed" :
                      nodeStates[index] === "completed" && nodeStates[index+1] === "active" ? "active" : ""
                    }`} />
                  )}
                </React.Fragment>
              ))}
            </div>

            <div className="progress">
              <div className="progress-bar" style={{ width: `${task.progress || 0}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '6px', color: 'var(--muted)' }}>
              <span>Pipeline Progress</span>
              <span>{task.progress || 0}%</span>
            </div>

            {task.results?.length ? (
              <div style={{ marginTop: 20 }}>
                <h3 style={{ fontSize: 14, marginBottom: 10, color: 'var(--ink-bright)' }}>Extracted Pipeline Results:</h3>
                <DocumentTable rows={task.results.map((row, index) => ({ ...row, id: index }))} />
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function Approval({ api, reviewer, notify }) {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [activeTab, setActiveTab] = useState("part3"); // part1, part2, part3, json
  const [comments, setComments] = useState("");
  const [editMode, setEditMode] = useState("visual"); // visual, raw_json
  
  // Structured K-1 States
  const [taxpayer, setTaxpayer] = useState({});
  const [organization, setOrganization] = useState({});
  const [metadata, setMetadata] = useState({});
  const [taxBoxes, setTaxBoxes] = useState({});
  const [docType, setDocType] = useState("Schedule K-1");
  const [taxYear, setTaxYear] = useState("");
  const [ein, setEin] = useState("");
  const [filingEntity, setFilingEntity] = useState("");
  const [rawJsonText, setRawJsonText] = useState("");

  async function load() {
    const result = await api.guarded(() => api.get("/api/review/pending"), { items: [] });
    setItems(result.items || []);
    if (!selectedId && result.items?.length) setSelectedId(result.items[0].id);
  }

  useEffect(() => {
    load();
  }, []);

  const selected = items.find((item) => item.id === Number(selectedId));

  // Load K-1 structures when selected item changes
  useEffect(() => {
    if (selected) {
      const data = selected.extracted_data || {};
      setTaxpayer(data.taxpayer || {});
      setOrganization(data.organization || data.partnership || {});
      setMetadata(data.metadata || {});
      setTaxBoxes(data.tax_boxes || data.financial_boxes || {});
      setDocType(data.document_type || "Schedule K-1");
      setTaxYear(data.tax_year || "");
      setEin(data.ein || "");
      setFilingEntity(data.filing_entity || "");
      setRawJsonText(JSON.stringify(data, null, 2));
    }
  }, [selectedId, selected?.case_key]);

  // Synchronize Tab inputs to Raw JSON state on demand
  function getPayloadFromStates() {
    return {
      document_type: docType,
      tax_year: taxYear,
      filing_entity: filingEntity,
      ein: ein,
      taxpayer,
      organization,
      tax_boxes: taxBoxes,
      metadata
    };
  }

  async function save() {
    let payloadToSave;
    if (editMode === "raw_json") {
      try {
        payloadToSave = JSON.parse(rawJsonText);
      } catch (e) {
        notify("Invalid JSON syntax in editor", "error");
        return;
      }
    } else {
      payloadToSave = getPayloadFromStates();
    }

    const response = await api.guarded(
      () => api.post(`/api/review/${selectedId}/update`, { extracted_data: payloadToSave }),
      null
    );
    if (response) {
      notify("Case updates saved successfully.", "success");
      // Update local states
      if (editMode === "raw_json") {
        setTaxpayer(payloadToSave.taxpayer || {});
        setOrganization(payloadToSave.organization || payloadToSave.partnership || {});
        setTaxBoxes(payloadToSave.tax_boxes || payloadToSave.financial_boxes || {});
        setDocType(payloadToSave.document_type || "Schedule K-1");
        setTaxYear(payloadToSave.tax_year || "");
        setEin(payloadToSave.ein || "");
        setFilingEntity(payloadToSave.filing_entity || "");
      } else {
        setRawJsonText(JSON.stringify(payloadToSave, null, 2));
      }
    }
  }

  async function act(action) {
    const response = await api.guarded(() => api.post(`/api/review/${selectedId}/${action}`, { reviewer, comments }), null);
    if (response) {
      notify(action === "approve" ? "Case approved and exported." : "Changes requested on case.", action === "approve" ? "success" : "warn");
      setComments("");
      setSelectedId(null);
      await load();
    }
  }

  // Handle Box Part III Change
  const handleBoxChange = (boxNum, field, val) => {
    const updated = { ...taxBoxes };
    if (!updated[boxNum]) updated[boxNum] = { code: "", value: "" };
    updated[boxNum][field] = val;
    setTaxBoxes(updated);
  };

  if (!items.length) {
    return (
      <div className="card card-pad">
        <div className="empty">
          <svg className="empty-icon" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          No pending review cases in database.
        </div>
      </div>
    );
  }

  return (
    <div className="review-layout">
      {/* Left Column: PDF Panel */}
      <div className="card card-pad">
        <div className="section-title">
          <h2>Source PDF Document</h2>
          <select value={selectedId || ""} onChange={(event) => setSelectedId(Number(event.target.value))} style={{ maxWidth: '240px' }}>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.filename} ({pretty(item.confidence_score)}% confidence)
              </option>
            ))}
          </select>
        </div>
        {selected?.raw_pdf_base64 ? (
          <iframe className="pdf-frame" src={`data:application/pdf;base64,${selected.raw_pdf_base64}`} />
        ) : (
          <div className="empty">No preview available for this case.</div>
        )}
      </div>

      {/* Right Column: Interactive Tabbed Form Panel */}
      <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="section-title">
          <h2>Structured Field Editor</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span className={`pill ${selected?.confidence_score < 85 ? "warn" : "good"}`}>
              {selected?.confidence_score || 0}% Confidence
            </span>
            <select 
              value={editMode} 
              onChange={(e) => {
                if (e.target.value === "raw_json") {
                  setRawJsonText(JSON.stringify(getPayloadFromStates(), null, 2));
                }
                setEditMode(e.target.value);
              }}
              style={{ width: '110px', padding: '4px 8px', fontSize: '12px' }}
            >
              <option value="visual">Visual UI</option>
              <option value="raw_json">Raw JSON</option>
            </select>
          </div>
        </div>

        {selected?.validation_errors?.length ? (
          <div className="pill bad" style={{ display: 'block', textTransform: 'none', borderRadius: '8px', padding: '10px 14px', marginBottom: 16 }}>
            <strong>Validation Warning:</strong> {selected.validation_errors.join(" | ")}
          </div>
        ) : null}

        {editMode === "visual" ? (
          <>
            {/* Visual Tabs */}
            <div className="tabs-header">
              <button className={`tab-btn ${activeTab === "part1" ? "active" : ""}`} onClick={() => setActiveTab("part1")}>Part I: Partnership</button>
              <button className={`tab-btn ${activeTab === "part2" ? "active" : ""}`} onClick={() => setActiveTab("part2")}>Part II: Taxpayer</button>
              <button className={`tab-btn ${activeTab === "part3" ? "active" : ""}`} onClick={() => setActiveTab("part3")}>Part III: Box Values</button>
            </div>

            <div style={{ flexGrow: 1, minHeight: 380 }}>
              {activeTab === "part1" && (
                <div className="k1-block">
                  <div className="form-row">
                    <label>Doc Type</label>
                    <input value={docType} onChange={e => setDocType(e.target.value)} />
                  </div>
                  <div className="form-row">
                    <label>Tax Year</label>
                    <input value={taxYear} onChange={e => setTaxYear(e.target.value)} />
                  </div>
                  <div className="form-row">
                    <label>Filing EIN</label>
                    <input value={ein} onChange={e => setEin(e.target.value)} style={{ fontFamily: 'JetBrains Mono, monospace' }} />
                  </div>
                  <div className="form-row">
                    <label>Entity Name</label>
                    <input value={organization.name || ""} onChange={e => setOrganization({ ...organization, name: e.target.value })} />
                  </div>
                  <div className="form-row">
                    <label>Address</label>
                    <input value={organization.address || ""} onChange={e => setOrganization({ ...organization, address: e.target.value })} />
                  </div>
                  <div className="form-row">
                    <label>Filing Type</label>
                    <input value={filingEntity} onChange={e => setFilingEntity(e.target.value)} />
                  </div>
                </div>
              )}

              {activeTab === "part2" && (
                <div className="k1-block">
                  <div className="form-row">
                    <label>Partner SSN</label>
                    <input value={taxpayer.tin || taxpayer.ssn || ""} onChange={e => setTaxpayer({ ...taxpayer, tin: e.target.value })} style={{ fontFamily: 'JetBrains Mono, monospace' }} />
                  </div>
                  <div className="form-row">
                    <label>Partner Name</label>
                    <input value={taxpayer.name || ""} onChange={e => setTaxpayer({ ...taxpayer, name: e.target.value })} />
                  </div>
                  <div className="form-row">
                    <label>Address</label>
                    <input value={taxpayer.address || ""} onChange={e => setTaxpayer({ ...taxpayer, address: e.target.value })} />
                  </div>
                  <div className="form-row">
                    <label>Partner Type</label>
                    <input value={taxpayer.partner_type || ""} onChange={e => setTaxpayer({ ...taxpayer, partner_type: e.target.value })} />
                  </div>
                </div>
              )}

              {activeTab === "part3" && (
                <div className="k1-box-form">
                  {Object.entries(K1_BOX_DESCRIPTIONS).map(([boxNum, desc]) => {
                    const boxObj = taxBoxes[boxNum] || { code: "", value: "" };
                    return (
                      <div className="k1-box-item" key={boxNum}>
                        <div className="k1-box-number">{boxNum}</div>
                        <div className="k1-box-details">
                          <span className="k1-box-label" title={desc}>{desc}</span>
                          <div className="k1-box-inputs">
                            <input 
                              placeholder="Code" 
                              className="k1-box-code" 
                              value={boxObj.code || ""} 
                              onChange={e => handleBoxChange(boxNum, "code", e.target.value)} 
                            />
                            <input 
                              placeholder="Value" 
                              className="k1-box-val" 
                              value={boxObj.value || ""} 
                              onChange={e => handleBoxChange(boxNum, "value", e.target.value)} 
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="json-editor-container" style={{ flexGrow: 1 }}>
            <textarea 
              className="json-textarea" 
              value={rawJsonText} 
              onChange={e => setRawJsonText(e.target.value)} 
            />
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--line)', marginTop: 18, paddingTop: 18 }}>
          <textarea 
            rows="3" 
            placeholder="Write reviewer review comments/justifications here..." 
            value={comments} 
            onChange={(event) => setComments(event.target.value)} 
            style={{ marginBottom: 12, resize: 'none' }}
          />
          <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={save}>Save Changes</button>
            <button className="btn primary" onClick={() => act("approve")}>Approve & Export</button>
            <button className="btn rose" onClick={() => act("reject")}>Request Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchVault({ api, notify }) {
  const [filters, setFilters] = useState({ filename: "", query: "", start_date: "", end_date: "" });
  const [rows, setRows] = useState([]);

  async function search(event) {
    if (event) event.preventDefault();
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    const result = await api.guarded(() => api.get(`/api/search?${params.toString()}`), { results: [] });
    setRows(result.results || []);
    notify(`${result.results?.length || 0} tax documents located in vault.`, "success");
  }

  return (
    <div className="card card-pad">
      <form className="grid search-grid" onSubmit={search}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Filename</label>
          <input placeholder="K1_1120_S..." value={filters.filename} onChange={(event) => setFilters({ ...filters, filename: event.target.value })} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Fulltext Search</label>
          <input placeholder="EIN, entity, value..." value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Start Date</label>
          <input type="date" value={filters.start_date} onChange={(event) => setFilters({ ...filters, start_date: event.target.value })} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>End Date</label>
          <input type="date" value={filters.end_date} onChange={(event) => setFilters({ ...filters, end_date: event.target.value })} />
        </div>
      </form>
      <div style={{ height: 16 }} />
      <div className="toolbar" style={{ marginBottom: 18 }}>
        <button className="btn primary" onClick={search}>Execute Vault Query</button>
        <button className="btn" onClick={() => setFilters({ filename: "", query: "", start_date: "", end_date: "" })}>Reset Filters</button>
        <button
          className="btn"
          disabled={!rows.length}
          onClick={() => {
            const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "k1-vault-search-results.json";
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export Query JSON
        </button>
      </div>
      <DocumentTable rows={rows} />
    </div>
  );
}

function ValidationSettings({ rules, setRules }) {
  const toggleRule = (ruleKey) => {
    setRules({ ...rules, [ruleKey]: !rules[ruleKey] });
  };

  return (
    <div className="card card-pad" style={{ maxWidth: '640px' }}>
      <div className="section-title">
        <h2>Tax Rules Settings</h2>
        <span className="pill">Active Schemas</span>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: '13.5px', marginBottom: 20 }}>
        Configure dynamic properties checked by the Validation Agent. Disabling rules bypasses penalties and lowers human review threshold requirements.
      </p>
      
      <div className="rules-list">
        <div className="rule-item">
          <div className="rule-info">
            <span className="rule-name">EIN Format Match</span>
            <span className="rule-desc">Ensures the partnership EIN matches the required XX-XXXXXXX numeric format.</span>
          </div>
          <label className="switch">
            <input type="checkbox" checked={rules.ein_required} onChange={() => toggleRule("ein_required")} />
            <span className="slider" />
          </label>
        </div>

        <div className="rule-item">
          <div className="rule-info">
            <span className="rule-name">Filing Tax Year Validation</span>
            <span className="rule-desc">Flags forms that do not specify a valid 4-digit tax year or occur out-of-bounds.</span>
          </div>
          <label className="switch">
            <input type="checkbox" checked={rules.tax_year_valid} onChange={() => toggleRule("tax_year_valid")} />
            <span className="slider" />
          </label>
        </div>

        <div className="rule-item">
          <div className="rule-info">
            <span className="rule-name">Box 1 Value Positive</span>
            <span className="rule-desc">Enforces box 1 ordinary business income to be non-zero or positive values.</span>
          </div>
          <label className="switch">
            <input type="checkbox" checked={rules.k1_box1_positive} onChange={() => toggleRule("k1_box1_positive")} />
            <span className="slider" />
          </label>
        </div>

        <div className="rule-item">
          <div className="rule-info">
            <span className="rule-name">Require Document Type Identification</span>
            <span className="rule-desc">Requires form classified matching specifically for "Schedule K-1".</span>
          </div>
          <label className="switch">
            <input type="checkbox" checked={rules.require_document_type} onChange={() => toggleRule("require_document_type")} />
            <span className="slider" />
          </label>
        </div>
      </div>
    </div>
  );
}

function ModelOps({ api }) {
  const [payload, setPayload] = useState(null);
  const [form, setForm] = useState({
    active_provider: "ollama",
    text_model: "",
    vision_model: "",
    custom_text_model: "",
    custom_vision_model: "",
    base_url: "http://localhost:11434",
    temperature: 0,
    max_tokens: 4096,
    timeout_seconds: 120,
  });

  async function load() {
    const result = await api.guarded(() => api.get("/api/model-config"), {});
    setPayload(result);
    const config = result?.config || {};
    const provider = config.active_provider || result?.runtime?.active_provider || "ollama";
    const providerConfig = config.providers?.[provider] || {};
    setForm({
      active_provider: provider,
      text_model: providerConfig.text_model || result?.runtime?.text_model || "",
      vision_model: providerConfig.vision_model || result?.runtime?.vision_model || "",
      custom_text_model: "",
      custom_vision_model: "",
      base_url: providerConfig.base_url || "http://localhost:11434",
      temperature: config.temperature ?? 0,
      max_tokens: config.max_tokens ?? 4096,
      timeout_seconds: config.timeout_seconds ?? 120,
    });
  }

  useEffect(() => {
    load();
  }, []);

  const providerOptions = payload?.model_options || {};
  const currentOptions = providerOptions[form.active_provider] || { text: [], vision: [] };
  const runtime = payload?.runtime || {};

  function chooseProvider(provider) {
    const providerConfig = payload?.config?.providers?.[provider] || {};
    const options = providerOptions[provider] || { text: [], vision: [] };
    setForm({
      ...form,
      active_provider: provider,
      text_model: providerConfig.text_model || options.text?.[0] || "",
      vision_model: providerConfig.vision_model || options.vision?.[0] || "",
      base_url: providerConfig.base_url || "http://localhost:11434",
      custom_text_model: "",
      custom_vision_model: "",
    });
  }

  async function save(event) {
    event.preventDefault();
    const body = {
      active_provider: form.active_provider,
      text_model: form.text_model === "__custom__" ? form.custom_text_model.trim() : form.text_model,
      vision_model: form.vision_model === "__custom__" ? form.custom_vision_model.trim() : form.vision_model,
      base_url: form.base_url,
      temperature: Number(form.temperature),
      max_tokens: Number(form.max_tokens),
      timeout_seconds: Number(form.timeout_seconds),
    };
    const result = await api.guarded(() => api.post("/api/model-config", body), null);
    if (result) {
      setPayload(result);
      alert("Model settings updated inside config/models.yaml. Restart the backend process to reload bindings.");
      await load();
    }
  }

  return (
    <div className="grid two-col">
      <div className="card card-pad">
        <div className="section-title">
          <h2>Agent Configurations</h2>
          <button className="btn" onClick={load}>Refresh</button>
        </div>
        <form className="form-grid" onSubmit={save}>
          <label style={{ display: 'grid', gap: 6, fontSize: '13.5px', fontWeight: 600 }}>
            Active Core Provider
            <select value={form.active_provider} onChange={(event) => chooseProvider(event.target.value)}>
              {Object.keys(providerOptions).map((provider) => (
                <option key={provider} value={provider}>{provider.toUpperCase()}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6, fontSize: '13.5px', fontWeight: 600 }}>
            Digital Text Model
            <select value={form.text_model} onChange={(event) => setForm({ ...form, text_model: event.target.value })}>
              {currentOptions.text.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
              <option value="__custom__">Custom model...</option>
            </select>
          </label>
          {form.text_model === "__custom__" ? (
            <input
              placeholder="Enter text model name"
              value={form.custom_text_model}
              onChange={(event) => setForm({ ...form, custom_text_model: event.target.value })}
            />
          ) : null}

          <label style={{ display: 'grid', gap: 6, fontSize: '13.5px', fontWeight: 600 }}>
            Scanned Vision Model
            <select value={form.vision_model} onChange={(event) => setForm({ ...form, vision_model: event.target.value })}>
              {currentOptions.vision.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
              <option value="__custom__">Custom model...</option>
            </select>
          </label>
          {form.vision_model === "__custom__" ? (
            <input
              placeholder="Enter vision model name"
              value={form.custom_vision_model}
              onChange={(event) => setForm({ ...form, custom_vision_model: event.target.value })}
            />
          ) : null}

          {form.active_provider === "ollama" ? (
            <label style={{ display: 'grid', gap: 6, fontSize: '13.5px', fontWeight: 600 }}>
              Ollama Host Endpoint
              <input value={form.base_url} onChange={(event) => setForm({ ...form, base_url: event.target.value })} />
            </label>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <label style={{ display: 'grid', gap: 6, fontSize: '12px', fontWeight: 600 }}>
              Temp
              <input type="number" step="0.1" min="0" max="2" value={form.temperature} onChange={(event) => setForm({ ...form, temperature: event.target.value })} />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: '12px', fontWeight: 600 }}>
              Max Tokens
              <input type="number" min="256" value={form.max_tokens} onChange={(event) => setForm({ ...form, max_tokens: event.target.value })} />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: '12px', fontWeight: 600 }}>
              Timeout (s)
              <input type="number" min="10" value={form.timeout_seconds} onChange={(event) => setForm({ ...form, timeout_seconds: event.target.value })} />
            </label>
          </div>

          <div className="toolbar" style={{ marginTop: 12 }}>
            <button className="btn primary" type="submit">Commit Settings</button>
            <button className="btn" type="button" onClick={load}>Reset</button>
          </div>
        </form>
      </div>
      
      <div className="card card-pad">
        <div className="section-title">
          <h2>Active Provider Settings</h2>
          <span className="pill">config/models.yaml</span>
        </div>
        <div className="metrics" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginTop: 0, gap: '12px' }}>
          <div className="card card-pad metric-card teal" style={{ minHeight: 90 }}>
            <div className="metric-label">Provider</div>
            <div className="metric-value" style={{ fontSize: 18 }}>{runtime.active_provider || "unknown"}</div>
          </div>
          <div className="card card-pad metric-card cyan" style={{ minHeight: 90 }}>
            <div className="metric-label">LLM API Key</div>
            <div className="metric-value" style={{ fontSize: 18, color: runtime.cloud_keys?.[form.active_provider] === false ? 'var(--rose)' : 'var(--emerald)' }}>
              {runtime.cloud_keys?.[form.active_provider] === false ? "Not Found" : "Connected"}
            </div>
          </div>
        </div>
        <pre className="json-panel">{JSON.stringify(payload?.config || {}, null, 2)}</pre>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
