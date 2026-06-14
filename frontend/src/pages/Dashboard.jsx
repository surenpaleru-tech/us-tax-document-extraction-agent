import { useEffect, useState } from "react";
import { DocumentTable } from "../components/DocumentTable";
import { QuickActions } from "../components/QuickActions";
import { pretty } from "../lib/utils";

export function Dashboard({ api, onNavigate, onStatsChange }) {
  const [data, setData] = useState({ summary: {}, form_distribution: {}, recent_documents: [] });

  async function load() {
    const result = await api.guarded(() => api.get("/api/dashboard"), data);
    if (result) {
      setData(result);
      onStatsChange?.(result.summary || {});
    }
  }

  useEffect(() => {
    load();
  }, []);

  const summary = data.summary || {};
  const distribution = Object.entries(data.form_distribution || {});
  const avgConfidence = summary.average_confidence || 0;
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (avgConfidence / 100) * circumference;

  return (
    <>
      <QuickActions onNavigate={onNavigate} pendingReview={summary.pending_review || 0} />

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
              <div className="metric-value gauge-value">{avgConfidence}%</div>
            </div>
          </div>
          <div className="metric-hint">Extraction confidence score</div>
        </div>
      </div>

      <div className="grid two-col">
        <div className="card card-pad">
          <div className="section-title">
            <h2>Recent Extractions</h2>
            <button className="btn" onClick={load}>
              Refresh
            </button>
          </div>
          <DocumentTable rows={data.recent_documents || []} />
        </div>

        <div className="card card-pad">
          <div className="section-title">
            <h2>Form Distribution</h2>
            <span className="pill">{distribution.length} Types</span>
          </div>
          {distribution.length ? (
            <div className="distribution-list">
              {distribution.map(([name, count]) => {
                const total = summary.total_files || 1;
                const pct = Math.min(100, Math.round((count / total) * 100));
                return (
                  <div key={name} className="distribution-item">
                    <div className="distribution-meta">
                      <span className="distribution-name">{name}</span>
                      <span className="distribution-count">
                        {count} forms ({pct}%)
                      </span>
                    </div>
                    <div className="distribution-bar">
                      <div className="distribution-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty">
              No extracted documents yet.
              <button className="btn primary" onClick={() => onNavigate("ingestion")}>
                Upload your first PDF
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
