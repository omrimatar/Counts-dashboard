import { useState } from 'react';

function getDefaultWeight(vt) {
  const name = (vt.name || '').toLowerCase();
  if (name.includes('motorcycle') || name.includes('bike')) return 0.5;
  if (name.includes('truck') || name.includes('lorry')) return 2.0;
  if (name.includes('bus')) return 1.8;
  if (!vt.heavy) return 1.0;
  return 1.8;
}

function buildDefaultWeights(vehicleTypes) {
  const w = {};
  vehicleTypes.forEach(vt => { w[vt.id] = getDefaultWeight(vt); });
  return w;
}

export default function PCUPanel({ vehicleTypes, pcuMode, pcuWeights, onChange }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => buildDefaultWeights(vehicleTypes));

  const handleToggle = () => {
    const next = !pcuMode;
    onChange(next, next ? draft : {});
  };

  const handleWeightChange = (vtId, val) => {
    setDraft(prev => ({ ...prev, [vtId]: val }));
  };

  const handleApply = () => {
    onChange(pcuMode, draft);
  };

  const handleReset = () => {
    const defaults = buildDefaultWeights(vehicleTypes);
    setDraft(defaults);
    if (pcuMode) onChange(true, defaults);
  };

  return (
    <div className="card pcu-panel">
      <div className="pcu-header" onClick={() => setOpen(o => !o)}>
        <div className="pcu-header-left">
          <span className="pcu-icon">⚖</span>
          <span className="pcu-title">PCU Calculator</span>
          {pcuMode && <span className="badge badge-blue">PCU Active</span>}
        </div>
        <span className={`pcu-chevron ${open ? 'open' : ''}`}>▾</span>
      </div>

      <div className={`pcu-body ${open ? 'pcu-body-open' : ''}`}>
        <div className="pcu-body-inner">
          <div className="pcu-toggle-row">
            <span className="pcu-toggle-label">Enable PCU weighting</span>
            <label className="toggle-switch">
              <input type="checkbox" checked={pcuMode} onChange={handleToggle} />
              <span className="toggle-slider" />
            </label>
          </div>

          <p className="pcu-explanation">
            PCU (Passenger Car Unit) converts different vehicle types to equivalent car units.
            Each vehicle count is multiplied by its weight before aggregation.
          </p>

          <div className="pcu-weight-grid">
            {vehicleTypes.map(vt => (
              <div key={vt.id} className="pcu-weight-item">
                <label className="pcu-weight-label">
                  <span className={`vt-dot ${vt.heavy ? 'vt-dot-heavy' : 'vt-dot-light'}`} />
                  {vt.name}
                </label>
                <input
                  type="number"
                  className="pcu-weight-input"
                  min="0"
                  max="10"
                  step="0.1"
                  value={draft[vt.id] ?? 1}
                  onChange={e => handleWeightChange(vt.id, parseFloat(e.target.value) || 0)}
                  disabled={!pcuMode}
                />
              </div>
            ))}
          </div>

          <div className="pcu-actions">
            <button className="btn-primary" onClick={handleApply} disabled={!pcuMode}>
              Apply Weights
            </button>
            <button className="btn-ghost" onClick={handleReset}>
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
