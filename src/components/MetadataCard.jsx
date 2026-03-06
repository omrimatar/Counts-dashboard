import { useState } from 'react';

const FILE_TYPE_STYLES = {
  full:    { cls: 'badge-green',  icon: '✓' },
  summary: { cls: 'badge-yellow', icon: '~' },
  queue:   { cls: 'badge-orange', icon: '!' },
};

export default function MetadataCard({ meta, arms, filters, armRenames = {}, onRenameArm }) {
  const [editing, setEditing] = useState(null);
  const [editVal, setEditVal] = useState('');

  const startEdit = (arm) => {
    if (!onRenameArm) return;
    setEditing(arm.id);
    setEditVal(arm.name);
  };

  const commitEdit = (armId) => {
    if (onRenameArm && editVal.trim()) onRenameArm(armId, editVal.trim());
    setEditing(null);
  };

  const timeRangeValue = meta.startTime && meta.endTime
    ? `${meta.startTime} – ${meta.endTime}`
    : null;

  const fields = [
    { label: 'Intersection', value: meta.name },
    { label: 'Date',         value: meta.date },
    { label: 'Time Range',   value: timeRangeValue },
    { label: 'Interval',     value: meta.intervalMinutes ? `${meta.intervalMinutes} min` : null },
    { label: 'Count Type',   value: meta.countType },
    { label: 'Method',       value: meta.method },
    { label: 'Surveyor',     value: meta.surveyor },
    { label: 'Client',       value: meta.client },
    { label: 'Completeness', value: meta.completeness },
  ].filter(f => f.value);

  const typeStyle = FILE_TYPE_STYLES[meta.fileType] || {};

  const activeTimeRange = filters?.timeRange;

  return (
    <div className="card meta-card">
      <div className="card-header">
        <h2 className="card-title">
          {meta.name || meta.fileName}
        </h2>
        <span className="badge">{meta.date || ''}</span>
      </div>

      {meta.fileTypeLabel && (
        <div className={`file-type-banner ${typeStyle.cls || ''}`}>
          <span className="file-type-icon">{typeStyle.icon}</span>
          <div>
            <strong>{meta.fileTypeLabel}</strong>
            {meta.fileTypeNote && <span className="file-type-note"> — {meta.fileTypeNote}</span>}
          </div>
        </div>
      )}

      <div className="meta-grid">
        {fields.map(f => (
          <div key={f.label} className="meta-item">
            <span className="meta-label">{f.label}</span>
            <span className="meta-value">{f.value}</span>
          </div>
        ))}
        {activeTimeRange && (
          <div className="meta-item">
            <span className="meta-label">Active Filter</span>
            <span className="meta-value meta-filter-range">
              {activeTimeRange[0]} – {activeTimeRange[1]}
            </span>
          </div>
        )}
      </div>

      {arms.length > 0 && (
        <div className="arms-section">
          <p className="arms-title">
            Arms ({arms.length})
            {onRenameArm && <span className="arms-rename-hint"> · click to rename</span>}
          </p>
          <div className="arms-list">
            {arms.map(arm =>
              editing === arm.id ? (
                <input
                  key={arm.id}
                  autoFocus
                  className="arm-rename-input"
                  value={editVal}
                  onChange={e => setEditVal(e.target.value)}
                  onBlur={() => commitEdit(arm.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitEdit(arm.id);
                    if (e.key === 'Escape') setEditing(null);
                  }}
                />
              ) : (
                <span
                  key={arm.id}
                  className={`arm-chip${onRenameArm ? ' arm-chip-editable' : ''}`}
                  title={onRenameArm ? 'Click to rename' : undefined}
                  onClick={() => startEdit(arm)}
                >
                  {arm.id}. {arm.name} {arm.direction ? `(${arm.direction})` : ''}
                </span>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
