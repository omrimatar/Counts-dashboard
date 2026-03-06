export default function HourlyHeatmap({ analytics }) {
  const { armHourlyData } = analytics || {};

  if (!armHourlyData?.length) {
    return (
      <div className="card">
        <h3 className="section-title">Hourly Volume Heatmap</h3>
        <p style={{ color: '#9ca3af', fontSize: 13 }}>No data available.</p>
      </div>
    );
  }

  const hours = armHourlyData[0]?.hours || [];
  if (!hours.length) return null;

  // global max for colour scaling
  const allVals = armHourlyData.flatMap(a => hours.map(h => a.hourlyVols[h] || 0));
  const maxVal = Math.max(...allVals, 1);

  const cellBg = (val) => {
    if (!val) return '#f8fafc';
    const pct = val / maxVal;
    const h = Math.round(220 - pct * 220); // blue→red
    const l = Math.round(92 - pct * 35);
    return `hsl(${h}, 75%, ${l}%)`;
  };

  const cellColor = (val) => {
    if (!val) return '#9ca3af';
    return val / maxVal > 0.55 ? '#fff' : '#1e293b';
  };

  const fmt = n => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));

  return (
    <div className="card">
      <h3 className="section-title">Hourly Volume Heatmap (by Arm)</h3>
      <div className="table-wrapper heatmap-wrapper">
        <table className="heatmap-table">
          <thead>
            <tr>
              <th className="heatmap-arm-col">Arm</th>
              {hours.map(h => (
                <th key={h} className="heatmap-hour-col">{h.slice(0, 2)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {armHourlyData.map(row => (
              <tr key={row.armId}>
                <td className="heatmap-arm-name">{row.armName}</td>
                {hours.map(h => {
                  const val = row.hourlyVols[h] || 0;
                  return (
                    <td
                      key={h}
                      className="heatmap-cell"
                      style={{
                        background: cellBg(val),
                        color: cellColor(val),
                      }}
                      title={`${row.armName} @ ${h}: ${Math.round(val).toLocaleString()}`}
                    >
                      {val ? fmt(val) : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="heatmap-legend">
        <span>Low</span>
        <div className="heatmap-legend-bar">
          <div className="heatmap-legend-gradient" />
        </div>
        <span>High</span>
      </div>
    </div>
  );
}
