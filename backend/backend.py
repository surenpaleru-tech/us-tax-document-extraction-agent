import base64
import json
import shutil
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml
from fastapi import BackgroundTasks, Body, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from agents.human_review_agent import HumanReviewAgent
from services.config_loader import ConfigLoader
from services.database_service import DatabaseService
from services.llm_service import LLMService
from services.logging_service import LoggingService
from workflows.extraction_graph import graph as EXTRACTION_GRAPH

logger = LoggingService.get_logger("BackendAPI")

app = FastAPI(
    title="Tax Document Intelligence API",
    description="Enterprise PDF extraction, human approval, and audit search API.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
INPUT_DIR = BASE_DIR / "data" / "input"
INPUT_DIR.mkdir(parents=True, exist_ok=True)

application_config = ConfigLoader.get_config("application.yaml")
REVIEW_DIR = Path(application_config["output"]["review_folder"])
AUDIT_DIR = Path(application_config["output"].get("audit_folder", "output/audit"))
REVIEW_DIR.mkdir(parents=True, exist_ok=True)
AUDIT_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_SERVICE = DatabaseService()
TASKS: Dict[str, Dict[str, Any]] = {}

MODEL_OPTIONS: Dict[str, Dict[str, List[str]]] = {
    "ollama": {
        "text": [
            "qwen3.5:4b",
            "qwen2.5:7b",
            "llama3.1:8b",
            "llama3.2:3b",
            "mistral:7b",
            "gemma3:12b",
            "deepseek-r1:8b",
        ],
        "vision": [
            "qwen3.5:4b",
            "gemma4:e4b",
            "gemma4:26b",
            "llava:7b",
            "llava:13b",
            "bakllava:7b",
            "gemma3:12b",
        ],
    },
    "openai": {
        "text": [
            "gpt-4.1",
            "gpt-4.1-mini",
            "gpt-4o",
            "gpt-4o-mini",
            "o4-mini",
        ],
        "vision": [
            "gpt-4.1",
            "gpt-4.1-mini",
            "gpt-4o",
            "gpt-4o-mini",
        ],
    },
    "google": {
        "text": [
            "gemini-2.5-pro",
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-1.5-pro",
            "gemini-1.5-flash",
        ],
        "vision": [
            "gemini-2.5-pro",
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-1.5-pro",
            "gemini-1.5-flash",
        ],
    },
}


def _models_config_path() -> Path:
    return BASE_DIR / "config" / "models.yaml"


def _load_models_config() -> Dict[str, Any]:
    with _models_config_path().open("r", encoding="utf-8") as file:
        return yaml.safe_load(file) or {}


def _write_models_config(config: Dict[str, Any]) -> None:
    header = "# Central model switchboard. This file can be edited directly or from Model Ops.\n\n"
    with _models_config_path().open("w", encoding="utf-8") as file:
        file.write(header)
        yaml.safe_dump(config, file, sort_keys=False, allow_unicode=False)


def _unique_path(file_path: Path) -> Path:
    if not file_path.exists():
        return file_path
    count = 1
    while True:
        candidate = file_path.with_name(f"{file_path.stem}_{count}{file_path.suffix}")
        if not candidate.exists():
            return candidate
        count += 1


def _safe_json(value: Any, default: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return default
    return value if value is not None else default


def _row_to_dict(row: tuple) -> Dict[str, Any]:
    payload = _safe_json(row[9], {})
    errors = _safe_json(row[10], [])
    return {
        "id": row[0],
        "file_name": row[1],
        "document_type": row[2] or "Unknown",
        "tax_year": row[3],
        "filing_entity": row[4],
        "ein": row[5],
        "confidence_score": row[6] or 0,
        "validation_error_count": row[7] or 0,
        "requires_review": bool(row[8]),
        "extracted_data": payload,
        "validation_errors": errors,
        "processing_time_seconds": row[11] or 0,
        "created_date": row[12],
    }


def _find_pdf(name_or_stem: str) -> Optional[Path]:
    candidates = list(INPUT_DIR.glob(f"{name_or_stem}*"))
    if not candidates and not name_or_stem.lower().endswith(".pdf"):
        candidates = list(INPUT_DIR.glob(f"{name_or_stem}.pdf"))
    return candidates[0] if candidates else None


def _load_review_items() -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    pending_paths = sorted([path for path in REVIEW_DIR.glob("*.json") if path.is_file()], key=lambda p: p.name)
    for index, path in enumerate(pending_paths, start=1):
        review = _safe_json(path.read_text(encoding="utf-8"), {})
        pdf_path = _find_pdf(review.get("pdf_name") or path.stem)
        raw_pdf_base64 = None
        if pdf_path and pdf_path.exists():
            raw_pdf_base64 = base64.b64encode(pdf_path.read_bytes()).decode("utf-8")
        items.append(
            {
                "id": index,
                "case_key": path.stem,
                "filename": f"{path.stem}.pdf",
                "raw_pdf_base64": raw_pdf_base64,
                "extracted_data": review.get("extracted_data", {}),
                "confidence_score": review.get("confidence_score", 0),
                "validation_errors": review.get("validation_errors", []),
                "created_at": review.get("created_at"),
                "status": review.get("status", "pending_review"),
            }
        )
    return items


def _review_path_for_id(review_id: int) -> Path:
    items = sorted([path for path in REVIEW_DIR.glob("*.json") if path.is_file()], key=lambda p: p.name)
    try:
        return items[review_id - 1]
    except IndexError as exc:
        raise HTTPException(status_code=404, detail="Review case not found") from exc


def _write_audit_event(action: str, case_name: str, reviewer: str, comments: str, data: Dict[str, Any]) -> None:
    event = {
        "action": action,
        "case_name": case_name,
        "reviewer": reviewer,
        "comments": comments,
        "timestamp": datetime.utcnow().isoformat(),
        "data": data,
    }
    path = AUDIT_DIR / f"{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{case_name}_{action}.json"
    path.write_text(json.dumps(event, indent=2, ensure_ascii=False), encoding="utf-8")


GRAPH_PROGRESS = {
    "load_document": 18,
    "extract": 58,
    "validate": 72,
    "confidence": 84,
    "persist": 96,
}


def _run_graph_for_document(task_id: str, pdf_path: Path, base_progress: int, span: int) -> Dict[str, Any]:
    latest_state: Dict[str, Any] = {}
    TASKS[task_id]["pipeline"] = "langgraph"
    TASKS[task_id]["graph_nodes"] = []

    for event in EXTRACTION_GRAPH.stream({"pdf_path": str(pdf_path)}):
        for node_name, node_state in event.items():
            latest_state = dict(node_state or latest_state)
            TASKS[task_id]["graph_nodes"].append(node_name)
            node_progress = GRAPH_PROGRESS.get(node_name, 50)
            TASKS[task_id].update(
                {
                    "current_file": pdf_path.name,
                    "current_node": node_name,
                    "progress": min(99, base_progress + int((node_progress / 100) * span)),
                }
            )

    extracted_data = latest_state.get("extracted_data", {}) or {}
    document = latest_state.get("document", {}) or {}
    return {
        "file_name": pdf_path.name,
        "document_mode": document.get("document_mode", "unknown"),
        "document_type": extracted_data.get("document_type") or "Unknown",
        "confidence_score": latest_state.get("confidence_score", 0),
        "requires_review": latest_state.get("requires_human_review", False),
        "validation_errors": latest_state.get("validation_errors", []),
        "processing_time_seconds": latest_state.get("processing_time_seconds", 0),
    }


def _run_upload_task(task_id: str, paths: List[Path]) -> None:
    TASKS[task_id].update({"state": "running", "started_at": datetime.utcnow().isoformat(), "progress": 5})
    results: List[Dict[str, Any]] = []
    try:
        total = len(paths)
        for index, path in enumerate(paths, start=1):
            base_progress = int(((index - 1) / total) * 95)
            span = max(1, int(95 / total))
            TASKS[task_id].update(
                {
                    "current_file": path.name,
                    "current_node": "queued_for_graph",
                    "progress": base_progress,
                }
            )
            results.append(_run_graph_for_document(task_id, path, base_progress, span))
        TASKS[task_id].update({"state": "completed", "progress": 100, "results": results})
    except Exception as exc:
        logger.error(f"Upload task failed: {exc}")
        TASKS[task_id].update({"state": "failed", "progress": 100, "error": str(exc), "results": results})


@app.get("/health")
async def health() -> Dict[str, Any]:
    return {"status": "ok", "model_runtime": LLMService.describe_runtime()}


@app.get("/api/model-config")
async def model_config() -> Dict[str, Any]:
    config = _load_models_config()
    return {
        "runtime": LLMService.describe_runtime(),
        "config": config,
        "model_options": MODEL_OPTIONS,
    }


@app.post("/api/model-config")
async def update_model_config(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    provider = str(payload.get("active_provider", "")).lower().strip()
    if provider not in MODEL_OPTIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")

    text_model = str(payload.get("text_model", "")).strip()
    vision_model = str(payload.get("vision_model", "")).strip()
    if not text_model or not vision_model:
        raise HTTPException(status_code=400, detail="Both text_model and vision_model are required")

    config = _load_models_config()
    config["active_provider"] = provider
    config.setdefault("providers", {})
    config["providers"].setdefault(provider, {})
    config["providers"][provider]["text_model"] = text_model
    config["providers"][provider]["vision_model"] = vision_model

    if provider == "ollama":
        base_url = str(payload.get("base_url") or config["providers"][provider].get("base_url") or "http://127.0.0.1:11434").strip()
        config["providers"][provider]["base_url"] = base_url

    if "temperature" in payload:
        config["temperature"] = payload["temperature"]
    if "max_tokens" in payload:
        config["max_tokens"] = payload["max_tokens"]
    if "timeout_seconds" in payload:
        config["timeout_seconds"] = payload["timeout_seconds"]

    _write_models_config(config)
    return {
        "status": "updated",
        "message": "Model configuration saved. Restart the backend before running new extraction jobs.",
        "runtime": LLMService.describe_runtime(),
        "config": config,
        "model_options": MODEL_OPTIONS,
    }


@app.post("/api/upload")
async def upload_documents(background_tasks: BackgroundTasks, files: List[UploadFile] = File(...)) -> Dict[str, Any]:
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    saved_paths: List[Path] = []
    for upload in files:
        if not upload.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail=f"{upload.filename} is not a PDF")
        destination = _unique_path(INPUT_DIR / upload.filename)
        with destination.open("wb") as out_file:
            shutil.copyfileobj(upload.file, out_file)
        saved_paths.append(destination)
    task_id = str(uuid.uuid4())
    TASKS[task_id] = {
        "state": "queued",
        "progress": 0,
        "files": [path.name for path in saved_paths],
        "created_at": datetime.utcnow().isoformat(),
    }
    background_tasks.add_task(_run_upload_task, task_id, saved_paths)
    return {"task_id": task_id, "files": [path.name for path in saved_paths]}


@app.get("/api/status/{task_id}")
async def upload_status(task_id: str) -> Dict[str, Any]:
    task = TASKS.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.get("/api/dashboard")
async def dashboard() -> Dict[str, Any]:
    rows = [_row_to_dict(row) for row in DATABASE_SERVICE.get_all_documents()]
    summary = {
        "total_files": len(rows),
        "processed_successfully": len([row for row in rows if not row["requires_review"]]),
        "errored": 0,
        "pending_review": len(_load_review_items()),
        "average_confidence": round(sum(row["confidence_score"] for row in rows) / len(rows), 2) if rows else 0,
        "last_updated": max([row["created_date"] for row in rows if row.get("created_date")], default=None),
    }
    distribution: Dict[str, int] = {}
    for row in rows:
        distribution[row["document_type"] or "Unknown"] = distribution.get(row["document_type"] or "Unknown", 0) + 1
    return {"summary": summary, "form_distribution": distribution, "recent_documents": rows[:10]}


@app.get("/api/documents/{document_id}")
async def get_document(document_id: int) -> Dict[str, Any]:
    row = DATABASE_SERVICE.get_document_by_id(document_id)
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")
    return _row_to_dict(row)


@app.get("/api/review/pending")
async def review_pending() -> Dict[str, Any]:
    return {"items": _load_review_items()}


@app.post("/api/review/{review_id}/approve")
async def approve_review(review_id: int, payload: Dict[str, Any] = Body(default={})) -> Dict[str, str]:
    path = _review_path_for_id(review_id)
    review = _safe_json(path.read_text(encoding="utf-8"), {})
    approved_dir = REVIEW_DIR / "approved"
    approved_dir.mkdir(parents=True, exist_ok=True)
    reviewer = payload.get("reviewer", "enterprise_reviewer")
    comments = payload.get("comments", "")
    review.update({"status": "approved", "reviewer": reviewer, "comments": comments, "reviewed_at": datetime.utcnow().isoformat()})
    _write_audit_event("approved", path.stem, reviewer, comments, review)
    (approved_dir / path.name).write_text(json.dumps(review, indent=2, ensure_ascii=False), encoding="utf-8")
    path.unlink()
    return {"status": "approved"}


@app.post("/api/review/{review_id}/reject")
async def reject_review(review_id: int, payload: Dict[str, Any] = Body(default={})) -> Dict[str, str]:
    path = _review_path_for_id(review_id)
    review = _safe_json(path.read_text(encoding="utf-8"), {})
    changes_dir = REVIEW_DIR / "changes_requested"
    changes_dir.mkdir(parents=True, exist_ok=True)
    reviewer = payload.get("reviewer", "enterprise_reviewer")
    comments = payload.get("comments", "")
    review.update({"status": "changes_requested", "reviewer": reviewer, "comments": comments, "reviewed_at": datetime.utcnow().isoformat()})
    _write_audit_event("changes_requested", path.stem, reviewer, comments, review)
    (changes_dir / path.name).write_text(json.dumps(review, indent=2, ensure_ascii=False), encoding="utf-8")
    path.unlink()
    return {"status": "changes_requested"}


@app.post("/api/review/{review_id}/update")
async def update_review(review_id: int, payload: Dict[str, Any] = Body(...)) -> Dict[str, str]:
    path = _review_path_for_id(review_id)
    review = _safe_json(path.read_text(encoding="utf-8"), {})
    review["extracted_data"] = payload.get("extracted_data", payload)
    review["last_edited_at"] = datetime.utcnow().isoformat()
    path.write_text(json.dumps(review, indent=2, ensure_ascii=False), encoding="utf-8")
    return {"status": "updated"}


@app.get("/api/search")
async def search_documents(
    filename: str = Query("", alias="filename"),
    reviewer: str = Query("", alias="reviewer"),
    query: str = Query("", alias="query"),
    start_date: Optional[date] = Query(None, alias="start_date"),
    end_date: Optional[date] = Query(None, alias="end_date"),
) -> Dict[str, Any]:
    rows = [_row_to_dict(row) for row in DATABASE_SERVICE.get_all_documents()]
    results: List[Dict[str, Any]] = []
    for row in rows:
        haystack = json.dumps(row, ensure_ascii=False).lower()
        if filename and filename.lower() not in row["file_name"].lower():
            continue
        if query and query.lower() not in haystack:
            continue
        created_date = datetime.fromisoformat(row["created_date"]).date() if row.get("created_date") else None
        if start_date and created_date and created_date < start_date:
            continue
        if end_date and created_date and created_date > end_date:
            continue
        row["reviewer"] = ""
        if reviewer and reviewer.lower() not in row["reviewer"].lower():
            continue
        results.append(row)
    return {"results": results}


@app.get("/api/export/json")
async def export_json() -> FileResponse:
    export_path = BASE_DIR / "output" / "tax_documents_export.json"
    rows = [_row_to_dict(row) for row in DATABASE_SERVICE.get_all_documents()]
    export_path.parent.mkdir(parents=True, exist_ok=True)
    export_path.write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")
    return FileResponse(export_path, filename="tax_documents_export.json")


@app.post("/api/chat")
def chat_sql(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    message = payload.get("message", "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")
    history = payload.get("history", [])

    # Get SQLite inventory
    db_rows = DATABASE_SERVICE.get_all_documents()
    db_inventory = []
    
    # Extract keywords from the user message for database searching
    import re
    keywords = [kw.lower() for kw in re.findall(r"\w+", message) if len(kw) > 2]
    
    matched_docs = []
    
    for r in db_rows:
        doc_info = {
            "id": r[0],
            "file_name": r[1],
            "document_type": r[2] or "Unknown",
            "tax_year": r[3] or "Unknown",
            "filing_entity": r[4] or "Unknown",
            "ein": r[5] or "Unknown",
            "confidence_score": r[6] or 0,
            "requires_review": bool(r[8]),
            "json_payload": r[9],
        }
        db_inventory.append(doc_info)
        
        # Determine relevance by matching keywords in file metadata or payload content
        haystack = f"{r[1]} {r[2]} {r[3]} {r[4]} {r[5]} {r[9]}".lower()
        if not keywords or any(kw in haystack for kw in keywords):
            matched_docs.append(doc_info)

    # Format database inventory list
    inventory_str = "\n".join([
        f"- ID {doc['id']}: {doc['file_name']} (Type: {doc['document_type']}, Year: {doc['tax_year']}, Entity: {doc['filing_entity']}, EIN: {doc['ein']}, Requires Review: {doc['requires_review']})"
        for doc in db_inventory
    ])
    if not inventory_str:
        inventory_str = "No documents currently exist in the database."

    # Format structured context from matching JSON payloads
    # Limit context to top 3 matching documents to keep prompt sizes compact
    context_str = ""
    for doc in matched_docs[:3]:
        try:
            payload_dict = json.loads(doc["json_payload"]) if isinstance(doc["json_payload"], str) else doc["json_payload"]
            payload_dict.pop("metadata", None) # Remove metadata block to save tokens
            pretty_json = json.dumps(payload_dict, indent=2, ensure_ascii=False)
        except Exception:
            pretty_json = str(doc["json_payload"])
            
        context_str += f"--- START OF DOCUMENT RECORD: {doc['file_name']} ---\n"
        context_str += f"Filename: {doc['file_name']}\n"
        context_str += f"Type: {doc['document_type']}\n"
        context_str += f"Tax Year: {doc['tax_year']}\n"
        context_str += f"Filing Entity / Taxpayer: {doc['filing_entity']}\n"
        context_str += f"EIN: {doc['ein']}\n"
        context_str += f"Extracted Structured JSON Payload:\n{pretty_json}\n"
        context_str += f"--- END OF DOCUMENT RECORD ---\n\n"

    if not context_str:
        context_str = "No specific matching document records found for the keywords in your query."

    # Build prompt
    system_prompt = f"""You are a helpful, enterprise-grade Tax Intelligence Assistant.
You have direct read access to the SQL database inventory of processed tax documents and their full extracted structured JSON data.

Here is the current database inventory:
{inventory_str}

Here is the relevant structured JSON context from the matching database records:
{context_str}

Instructions:
1. Use the database inventory to answer general questions about what files exist, how many documents are indexed, filing entities, or EINs.
2. Use the structured JSON context to answer specific questions about the values, financial figures, boxes, state/foreign details, or taxpayer details.
3. Be precise and base your answers on the provided context. If the information is not in the context, say you do not know.
4. When mentioning document details, cite the filename.
5. Answer in a professional, concise tone.
"""

    # Build prompt messages list for structured chat
    messages_list = [{"role": "system", "content": system_prompt}]
    if history:
        for msg in history:
            role = "user" if msg.get("role") == "user" else "assistant"
            messages_list.append({"role": role, "content": msg.get("content")})
    messages_list.append({"role": "user", "content": message})

    # Call LLM using structured chat
    try:
        llm = LLMService(vision=False)
        response_text = llm.chat(messages_list)
    except Exception as e:
        logger.error(f"LLM chat failed: {e}")
        response_text = f"I encountered an error while communicating with the AI model: {e}"

    # Return matched documents as sources for the frontend
    sources = []
    for doc in matched_docs[:3]:
        sources.append({
            "id": f"sql_doc_{doc['id']}",
            "text": f"Filing Entity: {doc['filing_entity']}\nEIN: {doc['ein']}\nTax Year: {doc['tax_year']}\nRequires Review: {doc['requires_review']}",
            "metadata": {
                "file_name": doc["file_name"],
                "document_type": doc["document_type"],
                "tax_year": doc["tax_year"],
                "filing_entity": doc["filing_entity"],
                "ein": doc["ein"]
            }
        })

    # Return simple inventory objects (without raw json payload to keep traffic compact)
    simplified_inventory = []
    for doc in db_inventory:
        simplified_inventory.append({
            "id": doc["id"],
            "file_name": doc["file_name"],
            "document_type": doc["document_type"],
            "tax_year": doc["tax_year"],
            "filing_entity": doc["filing_entity"],
            "ein": doc["ein"],
            "requires_review": doc["requires_review"]
        })

    return {
        "response": response_text,
        "sources": sources,
        "inventory": simplified_inventory
    }


FRONTEND_DIST = BASE_DIR / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
