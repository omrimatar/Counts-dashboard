import { useState } from 'react';

const DEFAULT_CAPACITY = 1800; // vehicles per lane per hour

function vcColor(ratio) {
  if (ratio === null) return '#9ca3af';
  if (ratio < 0.7)  return '#16a34a';
  if (ratio < 0.9)  return '#d97706';
  return '#dc2626';
}

function vcLabel(ratio) {
  if (ratio === null) return '—';
  if (ratio < 0.7)  return 'Free flow';
  if (ratio < 0.9)  return 'Near capacity';
  return 'Over capacity';
}

export default function VCPanel({ analytics, arms }) {
  const { directionData } = analytics || {};

  const [settings, setSettings] = useState(() => {
    const s = {};
    (arms || []).forEach(arm => {
      s[arm.id] = { lanes: 1, capacity: DEFAULT_CAPACITY };
    });
    return s;
  });

  if (!directionData?.length) {
    return (
      <div className="card">
        <h3 className="section-title">V/C Ratio Analysis</h3>
        <p style={{ color: '#9ca3af', fontSize: 13 }}>No volume data available.</p>
      </div>
    );
  }

  const updateSetting = (armId, field, value) => {
    setSettings(prev => ({
      ...prev,
      [armId]: { ...prev[armId], [field]: Math.max(1, Number(value) || 1) },
    }));
  };

  const rows = directionData.map(d => {
    const s = settings[d.armId] || { lanes: 1, capacity: DEFAULT_CAPACITY };
    const cap = s.lanes * s.capacity;
    const ratio = cap > 0 ? +(d.Volume / cap).toFixed(3) : null;
    return { ...d, lanes: s.lanes, capacity: s.capacity, cap, ratio };
  });

  return (
    <div className="card">
      <h3 className="section-title">V/C Ratio Analysis</h3>
      <p className="vc-hint">
        Edit lanes and capacity per lane to compute Volume/Capacity ratios. Capacities are approximate.
      </p>
      <div className="table-wrapper">
        <table className="mov-table vc-table">
          <thead>
            <tr>
              <th>Arm</th>
              <th>Peak Volume</th>
              <th>Lanes</th>
              <th>Cap / Lane</th>
              <th>Total Cap</th>
              <th>V/C</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.armId}>
                <td>{row.name}</td>
                <td style={{ textAlign: 'right' }}>{Math.round(row.Volume).toLocaleString()}</td>
                <td>
                  <input
                    type="number"
                    className="vc-input"
                    min={1}
                    max={10}
                    value={row.lanes}
                    onChange={e => updateSetting(row.armId, 'lanes', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    className="vc-input"
                    min={100}
                    max={4000}
                    step={100}
                    value={row.capacity}
                    onChange={e => updateSetting(row.armId, 'capacity', e.target.value)}
                  />
                </td>
                <td style={{ textAlign: 'right' }}>{row.cap.toLocaleString()}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: vcColor(row.ratio) }}>
                  {row.ratio != null ? row.ratio.toFixed(2) : '—'}
                </td>
                <td>
                  <span className="vc-status-badge" style={{ background: vcColor(row.ratio) }}>
                    {vcLabel(row.ratio)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
