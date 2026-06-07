const { useEffect, useMemo, useRef, useState } = React;

const NAV = [
  ["dashboard", "Command Center", "CC"],
  ["ingestion", "Ingestion", "UP"],
  ["approval", "Approval Flow", "OK"],
  ["search", "Search Vault", "SV"],
  ["models", "Model Ops", "MO"],
];

const DEFAULT_BACKEND = "http://localhost:8000";

function pretty(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function flattenObject(data, prefix = "") {
  if (!data || typeof data !== "object") return [{ field: prefix || "document", value: "" }];
  return Object.entries(data).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) return flattenObject(value, path);
    return [{ field: path, value: Array.isArray(value) ? JSON.stringify(value) : value ?? "" }];
  });
}

function unflattenRows(rows) {
  const root = {};
  rows.forEach(({ field, value }) => {
    if (!field) return;
    let parsed = value;
    if (typeof value === "string" && ["{", "["].includes(value.trim()[0])) {
      try {
        parsed = JSON.parse(value);
      } catch {
        parsed = value;
      }
    }
    const parts = field.split(".");
    let cursor = root;
    parts.slice(0, -1).forEach((part) => {
      cursor[part] = cursor[part] || {};
      cursor = cursor[part];
    });
    cursor[parts[parts.length - 1]] = parsed;
  });
  return root;
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

  async function ping() {
    const result = await api.guarded(() => api.get("/health"), null);
    setOnline(Boolean(result));
    notify(result ? "Backend is online." : "Backend is not reachable.", result ? "info" : "error");
  }

  useEffect(() => {
    ping();
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">TD</div>
          <div>
            <div className="brand-title">TaxDX Enterprise</div>
            <div className="brand-subtitle">Document intelligence</div>
          </div>
        </div>

        <nav className="nav">
          {NAV.map(([id, label, icon]) => (
            <button key={id} className={`nav-button ${view === id ? "active" : ""}`} onClick={() => setView(id)}>
              <span className="nav-icon">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-card">
          <label>Backend URL</label>
          <input value={backendUrl} onChange={(event) => setBackendUrl(event.target.value)} />
          <label>Reviewer</label>
          <input value={reviewer} onChange={(event) => setReviewer(event.target.value)} />
          <div className="sidebar-actions">
            <button className="btn ghost" onClick={ping}>Ping</button>
            <button className="btn ghost" onClick={() => window.location.reload()}>Refresh</button>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <div className="eyebrow">Enterprise tax document intelligence</div>
            <h1>{NAV.find(([id]) => id === view)?.[1]}</h1>
            <p className="subtitle">
              Extract, validate, approve, and search tax PDFs with a cleaner React interface and the same FastAPI multi-agent backend.
            </p>
          </div>
          <span className={`status-dot ${online ? "online" : ""}`}>{online ? "Backend online" : "Backend unknown"}</span>
        </div>

        {view === "dashboard" && <Dashboard api={api} />}
        {view === "ingestion" && <Ingestion api={api} notify={notify} />}
        {view === "approval" && <Approval api={api} reviewer={reviewer} notify={notify} />}
        {view === "search" && <SearchVault api={api} notify={notify} />}
        {view === "models" && <ModelOps api={api} />}
      </main>

      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </div>
  );
}

function Metric({ label, value, hint }) {
  return (
    <div className="card card-pad metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{pretty(value)}</div>
      <div className="metric-hint">{hint}</div>
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

  return (
    <>
      <div className="grid metrics">
        <Metric label="Total Files" value={summary.total_files || 0} hint="All uploaded PDFs" />
        <Metric label="Processed" value={summary.processed_successfully || 0} hint="Cleared without review" />
        <Metric label="Pending Review" value={summary.pending_review || 0} hint="Human queue" />
        <Metric label="Avg Confidence" value={`${summary.average_confidence || 0}%`} hint="Extraction confidence" />
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
            <span className="pill">{distribution.length} types</span>
          </div>
          {distribution.length ? (
            <table>
              <thead>
                <tr>
                  <th>Form Type</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {distribution.map(([name, count]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            <th>File</th>
            <th>Type</th>
            <th>Tax Year</th>
            <th>EIN</th>
            <th>Confidence</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id || row.file_name}>
              <td>{row.file_name}</td>
              <td>{row.document_type}</td>
              <td>{pretty(row.tax_year)}</td>
              <td>{pretty(row.ein)}</td>
              <td>{pretty(row.confidence_score)}%</td>
              <td>
                <span className={`pill ${row.requires_review ? "warn" : ""}`}>
                  {row.requires_review ? "Review" : "Approved-ready"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Ingestion({ api, notify }) {
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [task, setTask] = useState(null);
  const [busy, setBusy] = useState(false);
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
    notify("Upload accepted. Extraction is running.");
    await poll(upload.task_id);
    setBusy(false);
  }

  async function poll(taskId) {
    for (let i = 0; i < 180; i += 1) {
      const current = await api.guarded(() => api.get(`/api/status/${taskId}`), null);
      if (current) setTask(current);
      if (current?.state === "completed" || current?.state === "failed") {
        notify(current.state === "completed" ? "Extraction completed." : current.error || "Extraction failed.", current.state === "completed" ? "info" : "error");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  function acceptFiles(fileList) {
    const pdfs = Array.from(fileList || []).filter((file) => file.name.toLowerCase().endsWith(".pdf"));
    setFiles(pdfs);
  }

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
          <div>
            <div className="drop-title">Drop tax PDFs here</div>
            <div className="drop-copy">Batch upload scanned or digital PDFs. The backend will choose text or vision extraction automatically.</div>
          </div>
        </div>

        <div style={{ height: 14 }} />
        <div className="toolbar">
          <button className="btn primary" disabled={busy} onClick={() => startUpload()}>
            {busy ? "Processing..." : "Start Extraction"}
          </button>
          <button className="btn" onClick={() => setFiles([])}>Clear</button>
        </div>
      </div>

      <div className="card card-pad">
        <div className="section-title">
          <h2>Batch Queue</h2>
          <span className="pill">{files.length} files</span>
        </div>
        {files.length ? (
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th>Size</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.name}>
                  <td>{file.name}</td>
                  <td>{Math.round(file.size / 1024)} KB</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty">Selected PDFs will appear here.</div>
        )}

        {task && (
          <>
            <div style={{ height: 18 }} />
            <div className="section-title">
              <h2>Live Status</h2>
              <span className={`pill ${task.state === "failed" ? "bad" : task.state === "completed" ? "" : "warn"}`}>{task.state}</span>
            </div>
            <div>{task.current_file || task.files?.join(", ")}</div>
            {task.current_node ? <div className="metric-hint">LangGraph node: {task.current_node}</div> : null}
            <div className="progress">
              <div className="progress-bar" style={{ width: `${task.progress || 0}%` }} />
            </div>
            {task.results?.length ? <DocumentTable rows={task.results.map((row, index) => ({ ...row, id: index }))} /> : null}
          </>
        )}
      </div>
    </div>
  );
}

function Approval({ api, reviewer, notify }) {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [rows, setRows] = useState([]);
  const [comments, setComments] = useState("");

  async function load() {
    const result = await api.guarded(() => api.get("/api/review/pending"), { items: [] });
    setItems(result.items || []);
    if (!selectedId && result.items?.length) setSelectedId(result.items[0].id);
  }

  useEffect(() => {
    load();
  }, []);

  const selected = items.find((item) => item.id === Number(selectedId));

  useEffect(() => {
    setRows(flattenObject(selected?.extracted_data || {}));
  }, [selectedId, selected?.case_key]);

  async function save() {
    const response = await api.guarded(() => api.post(`/api/review/${selectedId}/update`, { extracted_data: unflattenRows(rows) }), null);
    if (response) notify("Review edits saved.");
  }

  async function act(action) {
    const response = await api.guarded(() => api.post(`/api/review/${selectedId}/${action}`, { reviewer, comments }), null);
    if (response) {
      notify(action === "approve" ? "Case approved." : "Changes requested.", action === "approve" ? "info" : "warn");
      setComments("");
      await load();
    }
  }

  if (!items.length) return <div className="card card-pad"><div className="empty">No pending review cases.</div></div>;

  return (
    <div className="review-layout">
      <div className="card card-pad">
        <div className="section-title">
          <h2>Source PDF</h2>
          <select value={selectedId || ""} onChange={(event) => setSelectedId(Number(event.target.value))}>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.filename} - {item.confidence_score}%
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

      <div className="card card-pad">
        <div className="section-title">
          <h2>Field Review</h2>
          <span className={`pill ${selected?.confidence_score < 85 ? "warn" : ""}`}>{selected?.confidence_score || 0}% confidence</span>
        </div>
        {selected?.validation_errors?.length ? (
          <div className="empty" style={{ textAlign: "left", marginBottom: 12 }}>
            {selected.validation_errors.join(" | ")}
          </div>
        ) : null}

        <div className="field-grid">
          {rows.map((row, index) => (
            <div className="field-row" key={`${row.field}-${index}`}>
              <input value={row.field} onChange={(event) => setRows(rows.map((item, i) => (i === index ? { ...item, field: event.target.value } : item)))} />
              <input value={row.value} onChange={(event) => setRows(rows.map((item, i) => (i === index ? { ...item, value: event.target.value } : item)))} />
            </div>
          ))}
        </div>

        <div style={{ height: 12 }} />
        <button className="btn" onClick={() => setRows([...rows, { field: "", value: "" }])}>Add Field</button>

        <div className="form-grid" style={{ marginTop: 14 }}>
          <textarea rows="4" placeholder="Reviewer comments" value={comments} onChange={(event) => setComments(event.target.value)} />
          <div className="toolbar">
            <button className="btn" onClick={save}>Save Edits</button>
            <button className="btn primary" onClick={() => act("approve")}>Approve</button>
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
    event.preventDefault();
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    const result = await api.guarded(() => api.get(`/api/search?${params.toString()}`), { results: [] });
    setRows(result.results || []);
    notify(`${result.results?.length || 0} results found.`);
  }

  return (
    <div className="card card-pad">
      <form className="grid search-grid form-grid" onSubmit={search}>
        <input placeholder="Filename" value={filters.filename} onChange={(event) => setFilters({ ...filters, filename: event.target.value })} />
        <input placeholder="EIN, form type, entity, JSON text" value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} />
        <input type="date" value={filters.start_date} onChange={(event) => setFilters({ ...filters, start_date: event.target.value })} />
        <input type="date" value={filters.end_date} onChange={(event) => setFilters({ ...filters, end_date: event.target.value })} />
        <button className="btn primary" type="submit">Run Search</button>
        <button className="btn" type="button" onClick={() => setFilters({ filename: "", query: "", start_date: "", end_date: "" })}>Reset</button>
        <button
          className="btn"
          type="button"
          onClick={() => {
            const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "taxdx-search-results.json";
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          Download JSON
        </button>
      </form>
      <div style={{ height: 18 }} />
      <DocumentTable rows={rows} />
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
      alert("Model configuration saved to config/models.yaml. Restart the backend before the next extraction job.");
      await load();
    }
  }

  return (
    <div className="grid two-col">
      <div className="card card-pad">
        <div className="section-title">
          <h2>Model Switchboard</h2>
          <button className="btn" onClick={load}>Refresh</button>
        </div>
        <form className="form-grid" onSubmit={save}>
          <label>
            Provider
            <select value={form.active_provider} onChange={(event) => chooseProvider(event.target.value)}>
              {Object.keys(providerOptions).map((provider) => (
                <option key={provider} value={provider}>{provider}</option>
              ))}
            </select>
          </label>

          <label>
            Text extraction model
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

          <label>
            Vision extraction model
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
            <label>
              Ollama base URL
              <input value={form.base_url} onChange={(event) => setForm({ ...form, base_url: event.target.value })} />
            </label>
          ) : null}

          <div className="grid search-grid">
            <label>
              Temperature
              <input type="number" step="0.1" min="0" max="2" value={form.temperature} onChange={(event) => setForm({ ...form, temperature: event.target.value })} />
            </label>
            <label>
              Max tokens
              <input type="number" min="256" value={form.max_tokens} onChange={(event) => setForm({ ...form, max_tokens: event.target.value })} />
            </label>
            <label>
              Timeout seconds
              <input type="number" min="10" value={form.timeout_seconds} onChange={(event) => setForm({ ...form, timeout_seconds: event.target.value })} />
            </label>
          </div>

          <div className="toolbar">
            <button className="btn primary" type="submit">Save to YAML</button>
            <button className="btn" type="button" onClick={load}>Reset from YAML</button>
          </div>
        </form>
      </div>
      <div className="card card-pad">
        <div className="section-title">
          <h2>Current Runtime</h2>
          <span className="pill">config/models.yaml</span>
        </div>
        <div className="grid metrics" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginTop: 0 }}>
          <Metric label="Provider" value={runtime.active_provider || "unknown"} hint="Loaded by backend" />
          <Metric label="Text Model" value={runtime.text_model || "unset"} hint="Digital PDFs" />
          <Metric label="Vision Model" value={runtime.vision_model || "unset"} hint="Scanned PDFs" />
          <Metric label="Key State" value={runtime.cloud_keys?.[form.active_provider] === false ? "Missing" : "Ready"} hint="Cloud API environment" />
        </div>
        <pre className="json-panel">{JSON.stringify(payload?.config || {}, null, 2)}</pre>
        <div className="empty" style={{ textAlign: "left", marginTop: 12 }}>
          Saving updates the YAML file immediately. Restart FastAPI before new extraction jobs so the provider clients reload cleanly.
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
