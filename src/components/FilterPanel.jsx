import { useMemo } from 'react';

function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function FilterPanel({
  arms, vehicleTypes, filters, onChange,
  dataStartTime, dataEndTime, hasToArm,
}) {
  const dataMin = useMemo(() => timeToMinutes(dataStartTime || '00:00'), [dataStartTime]);
  const dataMax = useMemo(() => timeToMinutes(dataEndTime || '23:45') + 15, [dataEndTime]);

  const [lowVal, highVal] = filters.timeRange
    ? [timeToMinutes(filters.timeRange[0]), timeToMinutes(filters.timeRange[1])]
    : [dataMin, dataMax];

  const lowPct = dataMax > dataMin ? ((lowVal - dataMin) / (dataMax - dataMin)) * 100 : 0;
  const highPct = dataMax > dataMin ? ((highVal - dataMin) / (dataMax - dataMin)) * 100 : 100;

  const handleLow = val => {
    const next = Math.min(val, highVal - 15);
    const clamped = Math.max(dataMin, next);
    const tr = clamped === dataMin && highVal === dataMax ? null : [minutesToTime(clamped), minutesToTime(highVal)];
    onChange({ ...filters, timeRange: tr });
  };

  const handleHigh = val => {
    const next = Math.max(val, lowVal + 15);
    const clamped = Math.min(dataMax, next);
    const tr = lowVal === dataMin && clamped === dataMax ? null : [minutesToTime(lowVal), minutesToTime(clamped)];
    onChange({ ...filters, timeRange: tr });
  };

  const toggleFromArm = id => {
    const curr = filters.fromArms;
    const next = curr.includes(id) ? curr.filter(x => x !== id) : [...curr, id];
    onChange({ ...filters, fromArms: next });
  };

  const toggleToArm = id => {
    const curr = filters.toArms;
    const next = curr.includes(id) ? curr.filter(x => x !== id) : [...curr, id];
    onChange({ ...filters, toArms: next });
  };

  const toggleVehicleType = vtId => {
    const allIds = vehicleTypes.map(vt => vt.id);
    const current = filters.vehicleTypeIds.length === 0 ? allIds : [...filters.vehicleTypeIds];
    const next = current.includes(vtId) ? current.filter(id => id !== vtId) : [...current, vtId];
    onChange({ ...filters, vehicleTypeIds: next.length === allIds.length ? [] : next });
  };

  const isVtChecked = vtId =>
    filters.vehicleTypeIds.length === 0 || filters.vehicleTypeIds.includes(vtId);

  const showSlider = dataStartTime && dataEndTime && dataMax > dataMin;

  const fromCount = filters.fromArms.length;
  const toCount = filters.toArms.length;
  const vtCount = filters.vehicleTypeIds.length;

  return (
    <div className="card filter-card">
      <div className="filter-top-row">
        <h3 className="section-title" style={{ margin: 0 }}>Filters</h3>
        <button
          className="filter-reset"
          onClick={() => onChange({
            fromArms: [], toArms: [], vehicleTypeIds: [],
            timeRange: null, chartView: filters.chartView,
          })}
        >
          Reset all
        </button>
      </div>

      {showSlider && (
        <div className="filter-section">
          <label className="filter-label">
            Time Range: <strong>{minutesToTime(lowVal)} → {minutesToTime(highVal)}</strong>
            {filters.timeRange && (
              <button
                className="filter-clear-btn"
                onClick={() => onChange({ ...filters, timeRange: null })}
              >✕</button>
            )}
          </label>
          <div className="time-range-slider">
            <div className="time-range-track">
              <div
                className="time-range-fill"
                style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%` }}
              />
            </div>
            <input
              type="range"
              className="range-thumb"
              style={{ zIndex: lowVal >= highVal - 15 ? 5 : 3 }}
              min={dataMin} max={dataMax} step={15}
              value={lowVal}
              onChange={e => handleLow(Number(e.target.value))}
            />
            <input
              type="range"
              className="range-thumb"
              style={{ zIndex: 4 }}
              min={dataMin} max={dataMax} step={15}
              value={highVal}
              onChange={e => handleHigh(Number(e.target.value))}
            />
          </div>
        </div>
      )}

      <div className="filter-columns">
        <div className="filter-section">
          <label className="filter-label">
            From Arms{fromCount > 0 && <span className="filter-count">({fromCount})</span>}
          </label>
          <div className="checkbox-scroll">
            {arms.map(arm => (
              <label key={arm.id} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={filters.fromArms.includes(arm.id)}
                  onChange={() => toggleFromArm(arm.id)}
                />
                <span className="checkbox-label">{arm.id}. {arm.name}</span>
                {arm.direction && <span className="dir-badge">{arm.direction}</span>}
              </label>
            ))}
          </div>
        </div>

        {hasToArm && (
          <div className="filter-section">
            <label className="filter-label">
              To Arms{toCount > 0 && <span className="filter-count">({toCount})</span>}
            </label>
            <div className="checkbox-scroll">
              {arms.map(arm => (
                <label key={arm.id} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={filters.toArms.includes(arm.id)}
                    onChange={() => toggleToArm(arm.id)}
                  />
                  <span className="checkbox-label">{arm.id}. {arm.name}</span>
                  {arm.direction && <span className="dir-badge">{arm.direction}</span>}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="filter-section">
          <label className="filter-label">
            Vehicle Types{vtCount > 0 && <span className="filter-count">({vtCount} of {vehicleTypes.length})</span>}
          </label>
          <div className="checkbox-scroll">
            {vehicleTypes.map(vt => (
              <label key={vt.id} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={isVtChecked(vt.id)}
                  onChange={() => toggleVehicleType(vt.id)}
                />
                <span className={`vt-dot ${vt.heavy ? 'vt-dot-heavy' : 'vt-dot-light'}`} />
                <span className="checkbox-label">{vt.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="filter-section">
          <label className="filter-label">Chart View</label>
          <select
            className="filter-select"
            value={filters.chartView}
            onChange={e => onChange({ ...filters, chartView: e.target.value })}
          >
            <option value="hourly">Hourly</option>
            <option value="15min">15-min intervals</option>
          </select>
        </div>
      </div>
    </div>
  );
}
