export default function FilterPanel({ arms, filters, onChange }) {
  const armOptions = [{ id: null, name: 'All arms' }, ...arms];

  return (
    <div className="card filter-card">
      <h3 className="section-title">Filters</h3>
      <div className="filter-row">

        <div className="filter-group">
          <label className="filter-label">From arm</label>
          <select
            className="filter-select"
            value={filters.fromArm ?? ''}
            onChange={e => onChange({ ...filters, fromArm: e.target.value === '' ? null : Number(e.target.value) })}
          >
            {armOptions.map(a => (
              <option key={a.id ?? 'all'} value={a.id ?? ''}>
                {a.id ? `${a.id}. ${a.name}` : 'All arms'}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">To arm</label>
          <select
            className="filter-select"
            value={filters.toArm ?? ''}
            onChange={e => onChange({ ...filters, toArm: e.target.value === '' ? null : Number(e.target.value) })}
          >
            {armOptions.map(a => (
              <option key={a.id ?? 'all'} value={a.id ?? ''}>
                {a.id ? `${a.id}. ${a.name}` : 'All arms'}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Vehicle group</label>
          <select
            className="filter-select"
            value={filters.vehicleGroup}
            onChange={e => onChange({ ...filters, vehicleGroup: e.target.value })}
          >
            <option value="all">All vehicles</option>
            <option value="light">Light only</option>
            <option value="heavy">Heavy only</option>
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Chart view</label>
          <select
            className="filter-select"
            value={filters.chartView}
            onChange={e => onChange({ ...filters, chartView: e.target.value })}
          >
            <option value="hourly">Hourly</option>
            <option value="15min">15-min intervals</option>
          </select>
        </div>

        <button
          className="filter-reset"
          onClick={() => onChange({ fromArm: null, toArm: null, vehicleGroup: 'all', chartView: 'hourly' })}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
