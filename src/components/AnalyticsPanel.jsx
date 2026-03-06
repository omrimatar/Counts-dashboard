function StatCard({ label, value, sub, accent }) {
  return (
    <div className={`stat-card ${accent ? 'stat-accent' : ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export default function AnalyticsPanel({ analytics }) {
  if (!analytics) return null;
  const {
    grandTotal, heavyTotal, heavyPct,
    peakHour, peakHourVolume,
    peak15, peak15Volume,
    amVol, pmVol, peakDirection,
  } = analytics;

  const isPcuOnly = heavyPct === null;
  const fmt = n => (n !== null && n !== undefined) ? n.toLocaleString() : '—';

  return (
    <div className="card">
      <h3 className="section-title">Key Metrics</h3>
      <div className="stats-grid">
        <StatCard
          label={isPcuOnly ? 'Total Volume (PCU)' : 'Total Vehicles'}
          value={fmt(grandTotal)}
          sub="all directions"
        />
        <StatCard
          label="Heavy Vehicles"
          value={isPcuOnly ? 'N/A' : `${heavyPct}%`}
          sub={isPcuOnly ? 'Not available for PCU files' : `${fmt(heavyTotal)} vehicles`}
          accent
        />
        <StatCard
          label="Peak Hour"
          value={peakHour ?? '—'}
          sub={`${fmt(peakHourVolume)} vehicles`}
          accent
        />
        <StatCard
          label="Peak 15-min"
          value={peak15 ?? '—'}
          sub={`${fmt(peak15Volume)} vehicles`}
        />
        <StatCard
          label="AM Peak (07–09)"
          value={fmt(amVol)}
          sub="vehicles"
        />
        <StatCard
          label="PM Peak (16–19)"
          value={fmt(pmVol)}
          sub="vehicles"
        />
        <StatCard
          label="Dominant Period"
          value={peakDirection}
          sub={peakDirection === 'AM' ? 'Morning heavier' : 'Evening heavier'}
          accent
        />
      </div>
    </div>
  );
}
