export default function MetadataCard({ meta, arms }) {
  const fields = [
    { label: 'Intersection', value: meta.name },
    { label: 'Date',         value: meta.date },
    { label: 'Time Range',   value: meta.startTime && meta.endTime ? `${meta.startTime} – ${meta.endTime}` : null },
    { label: 'Interval',     value: meta.intervalMinutes ? `${meta.intervalMinutes} min` : null },
    { label: 'Count Type',   value: meta.countType },
    { label: 'Method',       value: meta.method },
    { label: 'Surveyor',     value: meta.surveyor },
    { label: 'Client',       value: meta.client },
    { label: 'Completeness', value: meta.completeness },
  ].filter(f => f.value);

  return (
    <div className="card meta-card">
      <div className="card-header">
        <h2 className="card-title">
          {meta.name || meta.fileName}
        </h2>
        <span className="badge">{meta.date || ''}</span>
      </div>

      <div className="meta-grid">
        {fields.map(f => (
          <div key={f.label} className="meta-item">
            <span className="meta-label">{f.label}</span>
            <span className="meta-value">{f.value}</span>
          </div>
        ))}
      </div>

      {arms.length > 0 && (
        <div className="arms-section">
          <p className="arms-title">Arms ({arms.length})</p>
          <div className="arms-list">
            {arms.map(arm => (
              <span key={arm.id} className="arm-chip">
                {arm.id}. {arm.name} {arm.direction ? `(${arm.direction})` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
