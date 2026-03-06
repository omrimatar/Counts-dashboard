import { useState, useMemo } from 'react';
import MetadataCard from './MetadataCard';
import AnalyticsPanel from './AnalyticsPanel';
import FilterPanel from './FilterPanel';
import VolumeTimeSeries from './charts/VolumeTimeSeries';
import VehicleTypeChart from './charts/VehicleTypeChart';
import DirectionChart from './charts/DirectionChart';
import TurnBreakdownChart from './charts/TurnBreakdownChart';
import { computeAnalytics } from '../utils/analytics';

const DEFAULT_FILTERS = {
  fromArm: null,
  toArm: null,
  vehicleGroup: 'all',
  chartView: 'hourly',
};

export default function Dashboard({ data, onReset }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const analytics = useMemo(
    () => computeAnalytics(data, filters),
    [data, filters]
  );

  return (
    <div className="dashboard">
      {/* Top bar */}
      <div className="dash-topbar">
        <span className="dash-filename">{data.meta.fileName}</span>
        <button className="btn-ghost" onClick={onReset}>← Load another file</button>
      </div>

      {/* Metadata */}
      <MetadataCard meta={data.meta} arms={data.arms} />

      {/* Filters */}
      <FilterPanel arms={data.arms} filters={filters} onChange={setFilters} />

      {/* Key metrics */}
      <AnalyticsPanel analytics={analytics} />

      {/* Charts — 2-column grid on wide screens */}
      <div className="charts-grid">
        <div className="chart-full">
          <VolumeTimeSeries analytics={analytics} chartView={filters.chartView} />
        </div>
        <VehicleTypeChart analytics={analytics} />
        <DirectionChart analytics={analytics} />
        <TurnBreakdownChart analytics={analytics} />
      </div>

      {/* Movements table */}
      <MovementsTable data={data} analytics={analytics} />
    </div>
  );
}

function MovementsTable({ data, analytics }) {
  const { arms, vehicleTypes, movements } = data;
  if (!movements.length) return null;

  const armName = id => {
    const a = arms.find(a => a.id === id);
    return a ? `${a.name}` : `Arm ${id}`;
  };

  // Sum each movement's total
  const movTotals = movements.map(m => ({
    from: armName(m.fromArm),
    to: armName(m.toArm),
    turn: m.turnTypeEn || m.turnType,
    total: m.timeSeries.reduce((s, ts) =>
      s + Object.values(ts.vehicles).reduce((a, b) => a + b, 0), 0),
    heavy: m.timeSeries.reduce((s, ts) =>
      s + vehicleTypes.filter(vt => vt.heavy).reduce((sum, vt) => sum + (ts.vehicles[vt.id] || 0), 0), 0),
  })).sort((a, b) => b.total - a.total);

  return (
    <div className="card">
      <h3 className="section-title">Movement Summary</h3>
      <div className="table-wrapper">
        <table className="mov-table">
          <thead>
            <tr>
              <th>From</th>
              <th>To</th>
              <th>Turn</th>
              <th>Total</th>
              <th>Heavy</th>
              <th>Heavy %</th>
            </tr>
          </thead>
          <tbody>
            {movTotals.map((m, i) => (
              <tr key={i}>
                <td>{m.from}</td>
                <td>{m.to}</td>
                <td><span className={`turn-badge turn-${m.turn?.toLowerCase()}`}>{m.turn}</span></td>
                <td>{m.total.toLocaleString()}</td>
                <td>{m.heavy.toLocaleString()}</td>
                <td>{m.total > 0 ? ((m.heavy / m.total) * 100).toFixed(1) + '%' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
