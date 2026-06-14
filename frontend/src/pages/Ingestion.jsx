import { useMemo, useRef, useState } from "react";
import { DocumentTable } from "../components/DocumentTable";
import { GRAPH_NODES } from "../lib/constants";

export function Ingestion({ api, notify, files, setFiles, task, setTask, busy, setBusy }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  async function poll(taskId) {
    for (let i = 0; i < 180; i += 1) {
      const current = await api.guarded(() => api.get(`/api/status/${taskId}`), null);
      if (current) setTask(current);
      if (current?.state === "completed" || current?.state === "failed") {
        const isSuccess = current.state === "completed";
        notify(
          isSuccess ? "Extraction completed successfully." : current.error || "Extraction failed.",
          isSuccess ? "success" : "error"
        );
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

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
    notify("Upload accepted. Extraction pipeline started.", "success");
    await poll(upload.task_id);
    setBusy(false);
  }

  function acceptFiles(fileList) {
    const pdfs = Array.from(fileList || []).filter((file) => file.name.toLowerCase().endsWith(".pdf"));
    setFiles(pdfs);
  }

  const currentNode = task?.current_node;
  const taskState = task?.state;

  const nodeStates = useMemo(() => {
    if (taskState === "completed") return GRAPH_NODES.map(() => "completed");
    if (taskState === "failed") {
      const activeIdx = GRAPH_NODES.findIndex((n) => n.id === currentNode);
      return GRAPH_NODES.map((_, i) =>
        i < activeIdx ? "completed" : i === activeIdx ? "failed" : "idle"
      );
    }
    const activeIdx = GRAPH_NODES.findIndex((n) => n.id === currentNode);
    return GRAPH_NODES.map((_, i) =>
      i < activeIdx ? "completed" : i === activeIdx ? "active" : "idle"
    );
  }, [currentNode, taskState]);

  const steps = [
    { num: 1, label: "Select PDFs" },
    { num: 2, label: "Run extraction" },
    { num: 3, label: "Review results" },
  ];
  const currentStep = !files.length ? 1 : busy || (task && taskState !== "completed") ? 2 : 3;

  return (
    <>
      <div className="workflow-steps">
        {steps.map((step) => (
          <div key={step.num} className={`workflow-step ${currentStep >= step.num ? "active" : ""} ${currentStep === step.num ? "current" : ""}`}>
            <span className="workflow-step-num">{step.num}</span>
            <span>{step.label}</span>
          </div>
        ))}
      </div>

      <div className="grid two-col">
        <div className="card card-pad">
          <div className="section-title">
            <h2>Upload PDFs</h2>
            <span className="pill">{files.length} selected</span>
          </div>

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
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              multiple
              onChange={(event) => acceptFiles(event.target.files)}
            />
            <svg className="dropzone-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
            </svg>
            <div>
              <div className="drop-title">Drag & drop tax PDFs here</div>
              <div className="drop-copy">Or click to browse. Schedule K-1 and other tax forms are supported.</div>
            </div>
          </div>

          <div className="toolbar upload-toolbar">
            <button className="btn primary" disabled={busy || !files.length} onClick={() => startUpload()}>
              {busy ? "Processing..." : "Start Extraction"}
            </button>
            <button
              className="btn"
              onClick={() => {
                setFiles([]);
                setTask(null);
              }}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="card card-pad">
          <div className="section-title">
            <h2>Pipeline Status</h2>
            {task ? (
              <span className={`pill ${taskState === "failed" ? "bad" : taskState === "completed" ? "good" : "warn"}`}>
                {taskState}
              </span>
            ) : (
              <span className="pill">Idle</span>
            )}
          </div>

          {files.length ? (
            <div className="table-wrap file-queue">
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
                      <td className="cell-strong">{file.name}</td>
                      <td>{Math.round(file.size / 1024)} KB</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">No files selected yet.</div>
          )}

          {task ? (
            <>
              <div className="pipeline-divider" />
              <p className="pipeline-file">
                Processing: <strong>{task.current_file || task.files?.join(", ")}</strong>
              </p>

              <div className="graph-container">
                {GRAPH_NODES.map((node, index) => (
                  <div key={node.id} className="graph-fragment">
                    <div className={`graph-node ${nodeStates[index]}`}>
                      <div className="node-circle">
                        {nodeStates[index] === "completed" ? "✓" : index + 1}
                      </div>
                      <span className="node-label">{node.label}</span>
                    </div>
                    {index < GRAPH_NODES.length - 1 ? (
                      <div
                        className={`graph-connection ${
                          nodeStates[index] === "completed" && nodeStates[index + 1] === "completed"
                            ? "completed"
                            : nodeStates[index] === "completed" && nodeStates[index + 1] === "active"
                              ? "active"
                              : ""
                        }`}
                      />
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="progress">
                <div className="progress-bar" style={{ width: `${task.progress || 0}%` }} />
              </div>
              <div className="progress-meta">
                <span>Progress</span>
                <span>{task.progress || 0}%</span>
              </div>

              {task.results?.length ? (
                <div className="pipeline-results">
                  <h3>Results</h3>
                  <DocumentTable rows={task.results.map((row, index) => ({ ...row, id: index }))} />
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
