import { useState, useEffect, useRef } from "react";

export function Chat({ api, notify }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello! I am your Tax Intelligence Assistant. I have read access to the SQL database inventory and all extracted structured tax fields. Ask me anything about your documents, filing entities, EINs, or financial figures!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [searchFilter, setSearchFilter] = useState("");

  const chatEndRef = useRef(null);

  // Fetch SQLite database documents on load
  async function fetchInventory() {
    // We can query the dashboard endpoint which lists all documents, or call our search endpoint
    const data = await api.guarded(() => api.get("/api/dashboard"), { recent_documents: [] });
    setInventory(data.recent_documents || []);
  }

  useEffect(() => {
    fetchInventory();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSendMessage(textToSend) {
    const queryText = textToSend || input;
    if (!queryText.trim()) return;

    // Add user message to thread
    const newMessages = [...messages, { role: "user", content: queryText }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    // Format chat history (excluding the very first system message)
    const history = newMessages.slice(1).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Post query to backend
    const result = await api.guarded(
      () =>
        api.post("/api/chat", {
          message: queryText,
          history: history,
        }),
      { response: "I encountered a communication error with the backend.", sources: [], inventory: [] }
    );

    // Add assistant message with retrieved sources
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: result.response,
        sources: result.sources || [],
      },
    ]);

    // Update local database inventory list if the backend returns it
    if (result.inventory && result.inventory.length > 0) {
      // Map format of result.inventory back to dashboard shape
      const mappedInventory = result.inventory.map((item) => ({
        id: item.id,
        file_name: item.file_name,
        document_type: item.document_type,
        tax_year: item.tax_year,
        filing_entity: item.filing_entity,
        ein: item.ein,
        requires_review: item.requires_review,
      }));
      setInventory(mappedInventory);
    } else {
      fetchInventory();
    }

    setLoading(false);
  }

  function handleSuggestedPrompt(promptText) {
    handleSendMessage(promptText);
  }

  function handleClearChat() {
    setMessages([
      {
        role: "assistant",
        content: "Hello! I am your Tax Intelligence Assistant. I have read access to the SQL database inventory and all extracted structured tax fields. Ask me anything about your documents, filing entities, EINs, or financial figures!",
      },
    ]);
    notify("Chat thread cleared.", "info");
  }

  function handleDocumentClick(fileName) {
    setInput(`Summarize the financial data inside "${fileName}"`);
    notify(`Click Send to query details for ${fileName}`, "info");
  }

  const filteredInventory = inventory.filter((doc) => {
    const term = searchFilter.toLowerCase();
    return (
      doc.file_name.toLowerCase().includes(term) ||
      (doc.document_type || "").toLowerCase().includes(term) ||
      (doc.filing_entity || "").toLowerCase().includes(term) ||
      (doc.ein || "").toLowerCase().includes(term) ||
      String(doc.tax_year).includes(term)
    );
  });

  return (
    <div className="chat-layout-wrapper">
      {/* Left Sidebar: Database Context Inventory */}
      <div className="chat-sidebar-panel card">
        <div className="chat-sidebar-header">
          <h3>Connected Database</h3>
          <span className="rag-badge-online">DB Connected</span>
        </div>
        <div className="chat-sidebar-search">
          <input
            type="text"
            placeholder="Filter database files..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
        </div>
        <div className="chat-sidebar-list">
          {filteredInventory.length === 0 ? (
            <div className="chat-sidebar-empty">No documents found.</div>
          ) : (
            filteredInventory.map((doc) => (
              <div
                key={doc.id}
                className="chat-sidebar-item"
                onClick={() => handleDocumentClick(doc.file_name)}
                title="Click to generate query for this document"
              >
                <div className="chat-sidebar-item-header">
                  <span className="chat-doc-name">{doc.file_name}</span>
                  {doc.requires_review ? (
                    <span className="chat-doc-badge-warn">Needs Review</span>
                  ) : (
                    <span className="chat-doc-badge-ok">Indexed</span>
                  )}
                </div>
                <div className="chat-sidebar-item-meta">
                  <span>{doc.document_type || "Unknown"}</span>
                  <span>•</span>
                  <span>{doc.tax_year || "N/A"}</span>
                </div>
                {doc.filing_entity && (
                  <div className="chat-sidebar-item-sub">
                    Entity: {doc.filing_entity}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Main Chat Container */}
      <div className="chat-main-panel card">
        <div className="chat-main-header">
          <div className="chat-main-header-info">
            <h2>AI Tax Assistant</h2>
            <p>Query extraction values, database inventory records, and text content</p>
          </div>
          <button className="btn rose btn-sm" onClick={handleClearChat}>
            Clear Thread
          </button>
        </div>

        {/* Chat Thread */}
        <div className="chat-thread-container">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`chat-message-bubble-wrapper ${
                msg.role === "user" ? "chat-msg-user-wrapper" : "chat-msg-assistant-wrapper"
              }`}
            >
              <div className="chat-message-avatar">
                {msg.role === "user" ? "U" : "AI"}
              </div>
              <div className="chat-message-bubble-content">
                <div className="chat-message-bubble-text">{msg.content}</div>

                {/* Collapsible RAG Sources Drawer */}
                {msg.sources && msg.sources.length > 0 && (
                  <CollapsibleSources sources={msg.sources} />
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="chat-message-bubble-wrapper chat-msg-assistant-wrapper chat-loading">
              <div className="chat-message-avatar">AI</div>
              <div className="chat-message-bubble-content">
                <div className="chat-typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Quick Suggestion Pills */}
        <div className="chat-suggestions-tray">
          <button
            className="chat-suggestion-pill"
            onClick={() => handleSuggestedPrompt("How many tax documents are in the database?")}
          >
            📊 DB Inventory Count
          </button>
          <button
            className="chat-suggestion-pill"
            onClick={() => handleSuggestedPrompt("Show me all organization EINs and tax years")}
          >
            🆔 Organization EINs
          </button>
          <button
            className="chat-suggestion-pill"
            onClick={() => handleSuggestedPrompt("Do we have any files requiring human review?")}
          >
            ⚠️ Pending Reviews
          </button>
          <button
            className="chat-suggestion-pill"
            onClick={() => handleSuggestedPrompt("Summarize all extracted Schedule K-1 details")}
          >
            📋 Schedule K-1 Summary
          </button>
        </div>

        {/* Chat Input form */}
        <form
          className="chat-input-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
        >
          <input
            type="text"
            placeholder="Ask a question about the connected database or tax documents..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button className="btn primary" type="submit" disabled={loading || !input.trim()}>
            Send Query
          </button>
        </form>
      </div>
    </div>
  );
}

// Collapsible Sources Component
function CollapsibleSources({ sources }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rag-sources-wrapper">
      <button
        type="button"
        className="rag-sources-toggle"
        onClick={() => setOpen(!open)}
      >
        {open ? "▼ Hide Referenced Database Records" : `▶ View Referenced Database Records (${sources.length})`}
      </button>

      {open && (
        <div className="rag-sources-list">
          {sources.map((src, i) => {
            return (
              <div key={i} className="rag-source-item">
                <div className="rag-source-item-meta">
                  <span className="rag-source-filename">{src.metadata?.file_name}</span>
                  <span className="rag-source-type">{src.metadata?.document_type} ({src.metadata?.tax_year})</span>
                  <span className="rag-source-relevance">SQL Record</span>
                </div>
                <pre className="rag-source-text">{src.text}</pre>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
