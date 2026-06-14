import { pretty } from "../lib/utils";

export function DocumentTable({ rows }) {
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
              <td className="cell-strong">{row.file_name}</td>
              <td>
                <span className="pill">{row.document_type}</span>
              </td>
              <td>{pretty(row.tax_year)}</td>
              <td className="cell-mono">{pretty(row.ein)}</td>
              <td>
                <span
                  className={`confidence ${
                    row.confidence_score >= 85 ? "good" : row.confidence_score >= 70 ? "warn" : "bad"
                  }`}
                >
                  {pretty(row.confidence_score)}%
                </span>
              </td>
              <td>
                <span className={`pill ${row.requires_review ? "warn" : "good"}`}>
                  {row.requires_review ? "Needs Review" : "Validated"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
