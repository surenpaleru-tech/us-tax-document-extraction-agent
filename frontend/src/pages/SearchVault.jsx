import { useState } from "react";
import { DocumentTable } from "../components/DocumentTable";

export function SearchVault({ api, notify }) {
  const [filters, setFilters] = useState({ filename: "", query: "", start_date: "", end_date: "" });
  const [rows, setRows] = useState([]);
  const [searched, setSearched] = useState(false);

  async function search(event) {
    if (event) event.preventDefault();
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    const result = await api.guarded(() => api.get(`/api/search?${params.toString()}`), { results: [] });
    setRows(result.results || []);
    setSearched(true);
    notify(`${result.results?.length || 0} documents found.`, "success");
  }

  function exportResults() {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "vault-search-results.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="card card-pad">
      <form className="search-form" onSubmit={search}>
        <div className="search-filters">
          <label>
            Filename
            <input
              placeholder="e.g. K1_1120_S..."
              value={filters.filename}
              onChange={(event) => setFilters({ ...filters, filename: event.target.value })}
            />
          </label>
          <label>
            Full-text search
            <input
              placeholder="EIN, entity, values..."
              value={filters.query}
              onChange={(event) => setFilters({ ...filters, query: event.target.value })}
            />
          </label>
          <label>
            From
            <input
              type="date"
              value={filters.start_date}
              onChange={(event) => setFilters({ ...filters, start_date: event.target.value })}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={filters.end_date}
              onChange={(event) => setFilters({ ...filters, end_date: event.target.value })}
            />
          </label>
        </div>

        <div className="toolbar search-toolbar">
          <button className="btn primary" type="submit">
            Search
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => {
              setFilters({ filename: "", query: "", start_date: "", end_date: "" });
              setRows([]);
              setSearched(false);
            }}
          >
            Clear
          </button>
          <button className="btn" type="button" disabled={!rows.length} onClick={exportResults}>
            Export JSON
          </button>
        </div>
      </form>

      {searched ? (
        <DocumentTable rows={rows} />
      ) : (
        <div className="empty">Enter filters and click Search to find documents.</div>
      )}
    </div>
  );
}
