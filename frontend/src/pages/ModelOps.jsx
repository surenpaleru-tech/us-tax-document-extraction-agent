import { useEffect, useState } from "react";

export function ModelOps({ api, notify }) {
  const [payload, setPayload] = useState(null);
  const [form, setForm] = useState({
    active_provider: "ollama",
    text_model: "",
    vision_model: "",
    custom_text_model: "",
    custom_vision_model: "",
    base_url: "http://127.0.0.1:11434",
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
      base_url: providerConfig.base_url || "http://127.0.0.1:11434",
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
      base_url: providerConfig.base_url || "http://127.0.0.1:11434",
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
      notify("Model settings saved. Restart the backend to apply changes.", "success");
      await load();
    }
  }

  return (
    <div className="grid two-col">
      <div className="card card-pad">
        <div className="section-title">
          <h2>Model Configuration</h2>
          <button className="btn" onClick={load}>
            Refresh
          </button>
        </div>
        <form className="form-grid" onSubmit={save}>
          <label className="field-label">
            Provider
            <select value={form.active_provider} onChange={(event) => chooseProvider(event.target.value)}>
              {Object.keys(providerOptions).map((provider) => (
                <option key={provider} value={provider}>
                  {provider.toUpperCase()}
                </option>
              ))}
            </select>
          </label>

          <label className="field-label">
            Text model
            <select value={form.text_model} onChange={(event) => setForm({ ...form, text_model: event.target.value })}>
              {currentOptions.text.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
              <option value="__custom__">Custom...</option>
            </select>
          </label>
          {form.text_model === "__custom__" ? (
            <input
              placeholder="Enter text model name"
              value={form.custom_text_model}
              onChange={(event) => setForm({ ...form, custom_text_model: event.target.value })}
            />
          ) : null}

          <label className="field-label">
            Vision model
            <select value={form.vision_model} onChange={(event) => setForm({ ...form, vision_model: event.target.value })}>
              {currentOptions.vision.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
              <option value="__custom__">Custom...</option>
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
            <label className="field-label">
              Ollama host
              <input value={form.base_url} onChange={(event) => setForm({ ...form, base_url: event.target.value })} />
            </label>
          ) : null}

          <div className="model-params">
            <label className="field-label small">
              Temperature
              <input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={form.temperature}
                onChange={(event) => setForm({ ...form, temperature: event.target.value })}
              />
            </label>
            <label className="field-label small">
              Max tokens
              <input
                type="number"
                min="256"
                value={form.max_tokens}
                onChange={(event) => setForm({ ...form, max_tokens: event.target.value })}
              />
            </label>
            <label className="field-label small">
              Timeout (s)
              <input
                type="number"
                min="10"
                value={form.timeout_seconds}
                onChange={(event) => setForm({ ...form, timeout_seconds: event.target.value })}
              />
            </label>
          </div>

          <div className="toolbar">
            <button className="btn primary" type="submit">
              Save Settings
            </button>
            <button className="btn" type="button" onClick={load}>
              Reset
            </button>
          </div>
        </form>
      </div>

      <div className="card card-pad">
        <div className="section-title">
          <h2>Runtime Status</h2>
          <span className="pill">config/models.yaml</span>
        </div>
        <div className="grid metrics runtime-metrics">
          <div className="card card-pad metric-card teal compact">
            <div className="metric-label">Provider</div>
            <div className="metric-value small">{runtime.active_provider || "unknown"}</div>
          </div>
          <div className="card card-pad metric-card cyan compact">
            <div className="metric-label">API Key</div>
            <div
              className={`metric-value small ${
                runtime.cloud_keys?.[form.active_provider] === false ? "text-bad" : "text-good"
              }`}
            >
              {runtime.cloud_keys?.[form.active_provider] === false ? "Missing" : "Connected"}
            </div>
          </div>
        </div>
        <pre className="json-panel">{JSON.stringify(payload?.config || {}, null, 2)}</pre>
      </div>
    </div>
  );
}
