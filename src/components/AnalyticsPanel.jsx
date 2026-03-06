function StatCard({ label, value, sub, accent }) {
  return (
    <div className={`stat-card ${accent ? 'stat-accent' : ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export default function AnalyticsPanel({ analytics, pcuMode }) {
  if (!analytics) return null;
  const {
    grandTotal, heavyTotal, heavyPct,
    phf,
    peakHour, peakHourVolume,
    peak15, peak15Volume,
    amVol, pmVol, peakDirection,
  } = analytics;

  const isPcuOnly = heavyPct === null;
  const fmt = n => (n !== null && n !== undefined) ? n.toLocaleString() : '—';
  const totalLabel = isPcuOnly ? 'Total Volume (PCU)'
    : pcuMode ? 'Total Vehicles (PCU)' : 'Total Vehicles';

  return (
    <div className="card">
      <h3 className="section-title">Key Metrics</h3>
      <div className={`dominant-banner dominant-${peakDirection.toLowerCase()}`}>
        <span className="dominant-label">Dominant Period</span>
        <span className="dominant-value">{peakDirection} Peak</span>
        <span className="dominant-sub">{peakDirection === 'AM' ? 'Morning heavier (07–09)' : 'Evening heavier (16–19)'}</span>
        <span className="dominant-vols">AM {fmt(amVol)} · PM {fmt(pmVol)}</span>
      </div>
      <div className="stats-grid">
        <StatCard
          label={totalLabel}
          value={pcuMode ? (grandTotal ?? 0).toFixed(0) : fmt(grandTotal)}
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
          label="Peak Hour Factor"
          value={phf != null ? phf.toFixed(2) : '—'}
          sub="PHF = peak hr / (4 × peak 15)"
          accent
        />
        <StatCard
          label="AM Peak Hour (07–09)"
          value={fmt(amVol)}
          sub="best 1-hr in AM window"
        />
        <StatCard
          label="PM Peak Hour (16–19)"
          value={fmt(pmVol)}
          sub="best 1-hr in PM window"
        />
      </div>
    </div>
  );
}
