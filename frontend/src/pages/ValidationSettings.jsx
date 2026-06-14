export function ValidationSettings({ rules, setRules }) {
  const ruleDefs = [
    {
      key: "ein_required",
      name: "EIN Format Match",
      desc: "Ensures the partnership EIN matches the required XX-XXXXXXX format.",
    },
    {
      key: "tax_year_valid",
      name: "Tax Year Validation",
      desc: "Flags forms with missing or invalid 4-digit tax years.",
    },
    {
      key: "k1_box1_positive",
      name: "Box 1 Value Positive",
      desc: "Enforces box 1 ordinary business income to be non-zero or positive.",
    },
    {
      key: "require_document_type",
      name: "Document Type Required",
      desc: 'Requires form classification as "Schedule K-1".',
    },
  ];

  return (
    <div className="card card-pad settings-page">
      <div className="section-title">
        <h2>Validation Rules</h2>
        <span className="pill">UI Preview</span>
      </div>
      <p className="page-note">
        These toggles configure the validation agent behavior. Changes are stored locally until backend integration is added.
      </p>

      <div className="rules-list">
        {ruleDefs.map((rule) => (
          <div className="rule-item" key={rule.key}>
            <div className="rule-info">
              <span className="rule-name">{rule.name}</span>
              <span className="rule-desc">{rule.desc}</span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={rules[rule.key]}
                onChange={() => setRules({ ...rules, [rule.key]: !rules[rule.key] })}
              />
              <span className="slider" />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
