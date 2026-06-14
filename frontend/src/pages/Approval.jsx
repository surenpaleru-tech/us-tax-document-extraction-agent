import { useEffect, useState } from "react";
import { K1_BOX_DESCRIPTIONS } from "../lib/constants";
import { pretty } from "../lib/utils";

export function Approval({ api, reviewer, notify, onNavigate }) {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [activeTab, setActiveTab] = useState("part3");
  const [comments, setComments] = useState("");
  const [editMode, setEditMode] = useState("visual");
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

  function getPayloadFromStates() {
    return {
      document_type: docType,
      tax_year: taxYear,
      filing_entity: filingEntity,
      ein,
      taxpayer,
      organization,
      tax_boxes: taxBoxes,
      metadata,
    };
  }

  async function save() {
    let payloadToSave;
    if (editMode === "raw_json") {
      try {
        payloadToSave = JSON.parse(rawJsonText);
      } catch {
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
      notify("Changes saved.", "success");
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
    const response = await api.guarded(
      () => api.post(`/api/review/${selectedId}/${action}`, { reviewer, comments }),
      null
    );
    if (response) {
      notify(
        action === "approve" ? "Case approved and exported." : "Changes requested.",
        action === "approve" ? "success" : "warn"
      );
      setComments("");
      setSelectedId(null);
      await load();
    }
  }

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
          <svg className="empty-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
          No pending reviews.
          <button className="btn primary" onClick={() => onNavigate("ingestion")}>
            Upload documents
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="review-layout">
      <div className="card card-pad">
        <div className="section-title">
          <h2>Source Document</h2>
          <select
            className="case-select"
            value={selectedId || ""}
            onChange={(event) => setSelectedId(Number(event.target.value))}
          >
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.filename} ({pretty(item.confidence_score)}%)
              </option>
            ))}
          </select>
        </div>
        {selected?.raw_pdf_base64 ? (
          <iframe className="pdf-frame" title="PDF preview" src={`data:application/pdf;base64,${selected.raw_pdf_base64}`} />
        ) : (
          <div className="empty">No preview available.</div>
        )}
      </div>

      <div className="card card-pad review-editor">
        <div className="section-title">
          <h2>Extracted Fields</h2>
          <div className="review-toolbar">
            <span className={`pill ${selected?.confidence_score < 85 ? "warn" : "good"}`}>
              {selected?.confidence_score || 0}% confidence
            </span>
            <select
              value={editMode}
              onChange={(e) => {
                if (e.target.value === "raw_json") {
                  setRawJsonText(JSON.stringify(getPayloadFromStates(), null, 2));
                }
                setEditMode(e.target.value);
              }}
              className="edit-mode-select"
            >
              <option value="visual">Visual editor</option>
              <option value="raw_json">Raw JSON</option>
            </select>
          </div>
        </div>

        {selected?.validation_errors?.length ? (
          <div className="validation-banner">
            <strong>Validation:</strong> {selected.validation_errors.join(" | ")}
          </div>
        ) : null}

        {editMode === "visual" ? (
          <>
            <div className="tabs-header">
              <button className={`tab-btn ${activeTab === "part1" ? "active" : ""}`} onClick={() => setActiveTab("part1")}>
                Part I: Partnership
              </button>
              <button className={`tab-btn ${activeTab === "part2" ? "active" : ""}`} onClick={() => setActiveTab("part2")}>
                Part II: Partner
              </button>
              <button className={`tab-btn ${activeTab === "part3" ? "active" : ""}`} onClick={() => setActiveTab("part3")}>
                Part III: Boxes
              </button>
            </div>

            <div className="review-tab-content">
              {activeTab === "part1" && (
                <div className="k1-block">
                  <div className="form-row">
                    <label>Doc Type</label>
                    <input value={docType} onChange={(e) => setDocType(e.target.value)} />
                  </div>
                  <div className="form-row">
                    <label>Tax Year</label>
                    <input value={taxYear} onChange={(e) => setTaxYear(e.target.value)} />
                  </div>
                  <div className="form-row">
                    <label>Filing EIN</label>
                    <input className="cell-mono" value={ein} onChange={(e) => setEin(e.target.value)} />
                  </div>
                  <div className="form-row">
                    <label>Entity Name</label>
                    <input value={organization.name || ""} onChange={(e) => setOrganization({ ...organization, name: e.target.value })} />
                  </div>
                  <div className="form-row">
                    <label>Address</label>
                    <input value={organization.address || ""} onChange={(e) => setOrganization({ ...organization, address: e.target.value })} />
                  </div>
                  <div className="form-row">
                    <label>Filing Type</label>
                    <input value={filingEntity} onChange={(e) => setFilingEntity(e.target.value)} />
                  </div>
                </div>
              )}

              {activeTab === "part2" && (
                <div className="k1-block">
                  <div className="form-row">
                    <label>Partner TIN</label>
                    <input
                      className="cell-mono"
                      value={taxpayer.tin || taxpayer.ssn || ""}
                      onChange={(e) => setTaxpayer({ ...taxpayer, tin: e.target.value })}
                    />
                  </div>
                  <div className="form-row">
                    <label>Partner Name</label>
                    <input value={taxpayer.name || ""} onChange={(e) => setTaxpayer({ ...taxpayer, name: e.target.value })} />
                  </div>
                  <div className="form-row">
                    <label>Address</label>
                    <input value={taxpayer.address || ""} onChange={(e) => setTaxpayer({ ...taxpayer, address: e.target.value })} />
                  </div>
                  <div className="form-row">
                    <label>Partner Type</label>
                    <input value={taxpayer.partner_type || ""} onChange={(e) => setTaxpayer({ ...taxpayer, partner_type: e.target.value })} />
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
                          <span className="k1-box-label" title={desc}>
                            {desc}
                          </span>
                          <div className="k1-box-inputs">
                            <input
                              placeholder="Code"
                              className="k1-box-code"
                              value={boxObj.code || ""}
                              onChange={(e) => handleBoxChange(boxNum, "code", e.target.value)}
                            />
                            <input
                              placeholder="Value"
                              className="k1-box-val"
                              value={boxObj.value || ""}
                              onChange={(e) => handleBoxChange(boxNum, "value", e.target.value)}
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
          <div className="json-editor-container">
            <textarea className="json-textarea" value={rawJsonText} onChange={(e) => setRawJsonText(e.target.value)} />
          </div>
        )}

        <div className="review-actions">
          <textarea
            rows="3"
            placeholder="Reviewer comments (optional)..."
            value={comments}
            onChange={(event) => setComments(event.target.value)}
          />
          <div className="toolbar review-buttons">
            <button className="btn" onClick={save}>
              Save
            </button>
            <button className="btn primary" onClick={() => act("approve")}>
              Approve & Export
            </button>
            <button className="btn rose" onClick={() => act("reject")}>
              Request Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
