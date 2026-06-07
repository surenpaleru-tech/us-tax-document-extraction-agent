import base64
import json
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import pandas as pd
import requests
import streamlit as st
import streamlit.components.v1 as components

BACKEND_DEFAULT_URL = "http://localhost:8000"
VIEWS = ["Command Center", "Ingestion", "Approval Flow", "Search Vault", "Model Ops"]


def initialize_state() -> None:
    st.set_page_config(page_title="TaxDX Enterprise", page_icon="TDX", layout="wide", initial_sidebar_state="expanded")
    defaults = {
        "active_view": "Command Center",
        "backend_url": BACKEND_DEFAULT_URL,
        "dashboard": {},
        "review_items": [],
        "audit_results": [],
        "last_task": None,
        "selected_case": None,
        "reviewer": "enterprise_reviewer",
    }
    for key, value in defaults.items():
        st.session_state.setdefault(key, value)


def inject_css() -> None:
    st.markdown(
        """
<style>
    :root {
        --bg: #06080f;
        --panel: rgba(15, 23, 42, .74);
        --line: rgba(148, 163, 184, .22);
        --cyan: #22d3ee;
        --lime: #a3e635;
        --pink: #fb7185;
        --amber: #f59e0b;
        --text: #eef6ff;
        --muted: #9ca3af;
    }
    .stApp {
        background:
            radial-gradient(circle at 18% 16%, rgba(34, 211, 238, .18), transparent 28%),
            radial-gradient(circle at 86% 10%, rgba(251, 113, 133, .16), transparent 30%),
            linear-gradient(135deg, #06080f 0%, #0f172a 50%, #111827 100%);
        color: var(--text);
    }
    [data-testid="stSidebar"] {
        background: linear-gradient(180deg, rgba(2,6,23,.96), rgba(15,23,42,.92));
        border-right: 1px solid var(--line);
    }
    .block-container {padding-top: 1.4rem; padding-bottom: 2rem; max-width: 1500px;}
    h1, h2, h3 {letter-spacing: 0 !important;}
    .hero {
        border: 1px solid var(--line);
        background: linear-gradient(120deg, rgba(14,165,233,.2), rgba(168,85,247,.12), rgba(20,184,166,.14));
        border-radius: 8px;
        padding: 26px 28px;
        position: relative;
        overflow: hidden;
    }
    .hero:after {
        content: "";
        position: absolute;
        inset: auto 0 0 0;
        height: 3px;
        background: linear-gradient(90deg, var(--cyan), var(--lime), var(--pink), var(--amber));
    }
    .hero-title {font-size: 2.2rem; font-weight: 800; margin: 0;}
    .hero-sub {color: #cbd5e1; max-width: 850px; margin-top: 8px; font-size: 1rem;}
    .metric-card {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: rgba(15, 23, 42, .72);
        padding: 16px;
        min-height: 118px;
    }
    .metric-label {color: var(--muted); font-size: .78rem; text-transform: uppercase; letter-spacing: .08em;}
    .metric-value {font-size: 2rem; line-height: 1.1; font-weight: 800; margin-top: 8px;}
    .metric-hint {color: #cbd5e1; font-size: .82rem; margin-top: 8px;}
    .glass {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: rgba(15, 23, 42, .70);
        padding: 18px;
    }
    .status-pill {
        display: inline-flex;
        align-items: center;
        border: 1px solid rgba(34,211,238,.4);
        color: #cffafe;
        background: rgba(8,145,178,.18);
        border-radius: 999px;
        padding: 4px 10px;
        font-size: .78rem;
        font-weight: 700;
    }
    .small-muted {color: var(--muted); font-size: .86rem;}
    .stButton > button, .stDownloadButton > button {
        border-radius: 8px;
        border: 1px solid rgba(34,211,238,.45);
        background: linear-gradient(135deg, rgba(8,145,178,.9), rgba(37,99,235,.82));
        color: white;
        font-weight: 750;
    }
    .stButton > button:hover, .stDownloadButton > button:hover {
        border-color: rgba(163,230,53,.8);
        color: white;
    }
    div[data-testid="stDataFrame"], div[data-testid="stDataEditor"] {
        border: 1px solid var(--line);
        border-radius: 8px;
        overflow: hidden;
    }
</style>
        """,
        unsafe_allow_html=True,
    )


def notify(message: str, level: str = "info") -> None:
    if level == "success":
        st.success(message)
    elif level == "warning":
        st.warning(message)
    elif level == "error":
        st.error(message)
    else:
        st.info(message)


def backend_request(method: str, path: str, **kwargs: Any) -> Optional[requests.Response]:
    url = f"{st.session_state.backend_url.rstrip('/')}{path}"
    try:
        return requests.request(method, url, timeout=25, **kwargs)
    except requests.RequestException as exc:
        notify(f"Backend request failed: {exc}", "error")
        return None


def parse_json(value: Any, fallback: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return fallback
    return value if value is not None else fallback


def flatten_extracted(data: Any) -> pd.DataFrame:
    data = parse_json(data, {})
    rows: List[Dict[str, Any]] = []

    def walk(prefix: str, value: Any) -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                walk(f"{prefix}.{key}" if prefix else key, child)
        elif isinstance(value, list):
            rows.append({"field": prefix, "value": json.dumps(value, ensure_ascii=False), "confidence": ""})
        else:
            rows.append({"field": prefix, "value": "" if value is None else value, "confidence": ""})

    walk("", data)
    return pd.DataFrame(rows or [{"field": "document", "value": "", "confidence": ""}])


def dataframe_to_nested(df: pd.DataFrame) -> Dict[str, Any]:
    root: Dict[str, Any] = {}
    for _, row in df.iterrows():
        field = str(row.get("field", "")).strip()
        if not field:
            continue
        value = row.get("value", "")
        try:
            value = json.loads(value) if isinstance(value, str) and value[:1] in "[{" else value
        except json.JSONDecodeError:
            pass
        cursor = root
        parts = field.split(".")
        for part in parts[:-1]:
            cursor = cursor.setdefault(part, {})
        cursor[parts[-1]] = value
    return root


def shell() -> str:
    with st.sidebar:
        st.markdown("## TaxDX Enterprise")
        st.markdown('<span class="status-pill">Multi-agent extraction console</span>', unsafe_allow_html=True)
        st.write("")
        selected = st.radio("Workspace", VIEWS, index=VIEWS.index(st.session_state.active_view), label_visibility="collapsed")
        st.divider()
        st.text_input("Backend URL", key="backend_url")
        cols = st.columns(2)
        if cols[0].button("Ping"):
            response = backend_request("GET", "/health")
            notify("Backend is online." if response and response.ok else "Backend is offline.", "success" if response and response.ok else "error")
        if cols[1].button("Refresh"):
            st.rerun()
        st.divider()
        st.text_input("Reviewer", key="reviewer")
        st.caption("Change models in config/models.yaml, then restart the backend.")
    st.session_state.active_view = selected
    return selected


def hero(title: str, subtitle: str) -> None:
    st.markdown(
        f"""
<div class="hero">
  <div class="hero-title">{title}</div>
  <div class="hero-sub">{subtitle}</div>
</div>
        """,
        unsafe_allow_html=True,
    )


def metric_card(label: str, value: Any, hint: str = "") -> None:
    st.markdown(
        f"""
<div class="metric-card">
  <div class="metric-label">{label}</div>
  <div class="metric-value">{value}</div>
  <div class="metric-hint">{hint}</div>
</div>
        """,
        unsafe_allow_html=True,
    )


def fetch_dashboard() -> Dict[str, Any]:
    response = backend_request("GET", "/api/dashboard")
    if response and response.ok:
        st.session_state.dashboard = response.json()
    return st.session_state.dashboard or {"summary": {}, "form_distribution": {}, "recent_documents": []}


def render_command_center() -> None:
    hero("Tax Document Intelligence Command Center", "Upload PDFs, extract with Ollama or cloud models, route low-confidence cases to approval, and search every audit trail from one enterprise cockpit.")
    dashboard = fetch_dashboard()
    summary = dashboard.get("summary", {})
    st.write("")
    cols = st.columns(5)
    metrics = [
        ("Total Files", summary.get("total_files", 0), "All ingested documents"),
        ("Processed", summary.get("processed_successfully", 0), "Cleared without review"),
        ("Pending Review", summary.get("pending_review", 0), "Waiting for approval"),
        ("Avg Confidence", f"{summary.get('average_confidence', 0)}%", "Model certainty"),
        ("Last Update", summary.get("last_updated", "None"), "UTC timestamp"),
    ]
    for col, item in zip(cols, metrics):
        with col:
            metric_card(*item)

    left, right = st.columns([1.1, .9])
    with left:
        st.markdown("### Recent Extractions")
        recent = dashboard.get("recent_documents", [])
        if recent:
            st.dataframe(pd.DataFrame(recent).drop(columns=["extracted_data"], errors="ignore"), use_container_width=True, hide_index=True)
        else:
            st.info("No documents have been processed yet.")
    with right:
        st.markdown("### Form Mix")
        distribution = dashboard.get("form_distribution", {})
        if distribution:
            chart = pd.DataFrame(distribution.items(), columns=["Form Type", "Count"]).set_index("Form Type")
            st.bar_chart(chart)
        else:
            st.info("Form distribution will appear after extraction.")


def upload_documents(files: List[Any]) -> Optional[Dict[str, Any]]:
    payload = [("files", (file.name, file.getvalue(), "application/pdf")) for file in files]
    response = backend_request("POST", "/api/upload", files=payload)
    if response and response.ok:
        return response.json()
    if response is not None:
        notify(f"Upload failed: {response.text}", "error")
    return None


def poll_task(task_id: str) -> None:
    progress = st.progress(0)
    status = st.empty()
    results_box = st.empty()
    for _ in range(180):
        response = backend_request("GET", f"/api/status/{task_id}")
        if not response or not response.ok:
            time.sleep(1)
            continue
        payload = response.json()
        st.session_state.last_task = payload
        progress.progress(int(payload.get("progress", 0)))
        status.markdown(f"**State:** `{payload.get('state')}`  **Current file:** `{payload.get('current_file', '-')}`")
        if payload.get("results"):
            results_box.dataframe(pd.DataFrame(payload["results"]), use_container_width=True, hide_index=True)
        if payload.get("state") in {"completed", "failed"}:
            notify("Processing completed." if payload.get("state") == "completed" else f"Processing failed: {payload.get('error')}", "success" if payload.get("state") == "completed" else "error")
            return
        time.sleep(1)


def render_ingestion() -> None:
    hero("PDF Ingestion Studio", "Drag in enterprise tax packs and watch the extraction pipeline move from queued to approved-ready.")
    st.write("")
    left, right = st.columns([.95, 1.05])
    with left:
        st.markdown("### Upload")
        files = st.file_uploader("PDF batch", type=["pdf"], accept_multiple_files=True, label_visibility="collapsed")
        if files:
            st.dataframe(pd.DataFrame([{"file": f.name, "size_kb": round(len(f.getvalue()) / 1024, 1)} for f in files]), use_container_width=True, hide_index=True)
        if st.button("Start Extraction", use_container_width=True):
            if not files:
                notify("Select at least one PDF.", "warning")
            else:
                result = upload_documents(files)
                if result:
                    poll_task(result["task_id"])
    with right:
        st.markdown("### Live Task")
        task = st.session_state.last_task
        if task:
            st.json(task)
        else:
            st.info("The active task trace will appear here.")


def render_pdf_preview(raw_pdf_base64: Optional[str]) -> None:
    if not raw_pdf_base64:
        st.info("No PDF preview is available for this case.")
        return
    pdf_html = f"""
    <iframe src="data:application/pdf;base64,{raw_pdf_base64}" width="100%" height="760" style="border:1px solid rgba(148,163,184,.25); border-radius:8px;"></iframe>
    """
    components.html(pdf_html, height=780)


def fetch_review_items() -> List[Dict[str, Any]]:
    response = backend_request("GET", "/api/review/pending")
    if response and response.ok:
        st.session_state.review_items = response.json().get("items", [])
    return st.session_state.review_items


def render_approval_flow() -> None:
    hero("Human Approval Flow", "A split-screen reviewer workspace for high-value tax fields, confidence exceptions, and documented approval decisions.")
    items = fetch_review_items()
    st.write("")
    if not items:
        st.success("No pending review cases.")
        return
    labels = [f"{item['id']} | {item.get('filename')} | {item.get('confidence_score', 0)}%" for item in items]
    selected = st.selectbox("Pending cases", labels)
    selected_id = int(selected.split("|")[0].strip())
    item = next(case for case in items if case["id"] == selected_id)

    left, right = st.columns([1, 1])
    with left:
        st.markdown("### Source PDF")
        render_pdf_preview(item.get("raw_pdf_base64"))
    with right:
        st.markdown("### Extracted Data")
        st.caption(f"Confidence: {item.get('confidence_score', 0)}% | Errors: {len(item.get('validation_errors', []))}")
        if item.get("validation_errors"):
            st.warning("\n".join(item["validation_errors"]))
        edited = st.data_editor(flatten_extracted(item.get("extracted_data", {})), num_rows="dynamic", use_container_width=True, key=f"editor_{selected_id}")
        comments = st.text_area("Reviewer comments", placeholder="Decision notes, corrections, or escalation reason.")
        save_col, approve_col, reject_col = st.columns(3)
        if save_col.button("Save Edits", use_container_width=True):
            payload = {"extracted_data": dataframe_to_nested(edited)}
            response = backend_request("POST", f"/api/review/{selected_id}/update", json=payload)
            notify("Edits saved." if response and response.ok else "Could not save edits.", "success" if response and response.ok else "error")
        if approve_col.button("Approve", use_container_width=True):
            response = backend_request("POST", f"/api/review/{selected_id}/approve", json={"reviewer": st.session_state.reviewer, "comments": comments})
            if response and response.ok:
                notify("Case approved and audit event written.", "success")
                st.rerun()
            else:
                notify("Approval failed.", "error")
        if reject_col.button("Request Changes", use_container_width=True):
            response = backend_request("POST", f"/api/review/{selected_id}/reject", json={"reviewer": st.session_state.reviewer, "comments": comments})
            if response and response.ok:
                notify("Case moved to changes requested.", "warning")
                st.rerun()
            else:
                notify("Action failed.", "error")


def render_search_vault() -> None:
    hero("Search Vault", "Search across filenames, document types, EINs, extracted JSON, and historical processing metadata.")
    st.write("")
    with st.form("search_form"):
        cols = st.columns([1, 1, 1, 1])
        filename = cols[0].text_input("Filename")
        query = cols[1].text_input("Full-text query")
        start_default = datetime.today().date() - timedelta(days=30)
        start_date = cols[2].date_input("Start date", value=start_default)
        end_date = cols[3].date_input("End date", value=datetime.today().date())
        submitted = st.form_submit_button("Run Search")
    if submitted:
        response = backend_request(
            "GET",
            "/api/search",
            params={"filename": filename, "query": query, "start_date": start_date.isoformat(), "end_date": end_date.isoformat()},
        )
        st.session_state.audit_results = response.json().get("results", []) if response and response.ok else []
    if st.session_state.audit_results:
        rows = pd.DataFrame(st.session_state.audit_results)
        st.dataframe(rows.drop(columns=["extracted_data"], errors="ignore"), use_container_width=True, hide_index=True)
        st.download_button("Download Search JSON", json.dumps(st.session_state.audit_results, indent=2), "taxdx_search_results.json", "application/json")
    else:
        st.info("Search results will appear here.")


def render_model_ops() -> None:
    hero("Model Ops", "See which provider is active, confirm cloud keys, and keep model switching in YAML where enterprise ops can control it.")
    response = backend_request("GET", "/api/model-config")
    config = response.json() if response and response.ok else {}
    st.write("")
    cols = st.columns(4)
    cols[0].metric("Provider", config.get("active_provider", "unknown"))
    cols[1].metric("Text Model", config.get("text_model") or "unset")
    cols[2].metric("Vision Model", config.get("vision_model") or "unset")
    cols[3].metric("Ollama URL", config.get("base_url") or "cloud")
    st.markdown("### Runtime")
    st.json(config)
    st.markdown("### YAML Control")
    st.code(
        "config/models.yaml\n\nactive_provider: ollama\nproviders:\n  ollama:\n    text_model: qwen3.5:4b\n    vision_model: qwen3.5:4b",
        language="yaml",
    )


def main() -> None:
    initialize_state()
    inject_css()
    view = shell()
    if view == "Command Center":
        render_command_center()
    elif view == "Ingestion":
        render_ingestion()
    elif view == "Approval Flow":
        render_approval_flow()
    elif view == "Search Vault":
        render_search_vault()
    elif view == "Model Ops":
        render_model_ops()


if __name__ == "__main__":
    main()
