import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts';

function HeavyVehicleReport({ analytics }) {
  const { perArmHeavy, hourlyHeavyData, perArmAMPM } = analytics;

  if (!perArmHeavy?.length) {
    return <p style={{ color: '#9ca3af', fontSize: 13 }}>Heavy vehicle data not available for this file type.</p>;
  }

  const sorted = [...perArmHeavy].sort((a, b) => b.heavyPct - a.heavyPct);

  return (
    <>
      <h4 className="adv-sub-title">Heavy Vehicle % by Arm</h4>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={sorted} layout="vertical" margin={{ left: 80, right: 20, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis type="number" unit="%" domain={[0, 'dataMax + 5']} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="armName" tick={{ fontSize: 11 }} width={80} />
          <Tooltip formatter={v => `${v}%`} />
          <Bar dataKey="heavyPct" name="Heavy %" radius={[0, 4, 4, 0]}>
            {sorted.map((_, i) => (
              <Cell key={i} fill={Number(sorted[i].heavyPct) > 15 ? '#ef4444' : '#f97316'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {hourlyHeavyData?.length > 0 && (
        <>
          <h4 className="adv-sub-title" style={{ marginTop: 24 }}>Heavy % Over Time</h4>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={hourlyHeavyData} margin={{ top: 4, right: 20, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} />
              <YAxis unit="%" tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => `${v}%`} />
              <Line type="monotone" dataKey="heavyPct" stroke="#ef4444" strokeWidth={2} dot={false} name="Heavy %" />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}

      <h4 className="adv-sub-title" style={{ marginTop: 24 }}>Heavy % per Movement</h4>
      <div className="table-wrapper">
        <table className="mov-table">
          <thead>
            <tr>
              <th>Arm</th>
              <th>Total</th>
              <th>Heavy</th>
              <th>Heavy %</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => (
              <tr key={row.armId}>
                <td>{row.armName}</td>
                <td>{row.total.toLocaleString()}</td>
                <td>{row.heavy.toLocaleString()}</td>
                <td>
                  <span style={{
                    color: Number(row.heavyPct) > 15 ? '#dc2626' : '#374151',
                    fontWeight: Number(row.heavyPct) > 15 ? 700 : 400,
                  }}>
                    {row.heavyPct}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AMPMComparison({ analytics }) {
  const { perArmAMPM } = analytics;

  if (!perArmAMPM?.length) {
    return <p style={{ color: '#9ca3af', fontSize: 13 }}>No AM/PM data available.</p>;
  }

  return (
    <>
      <h4 className="adv-sub-title">AM (07–09) vs PM (16–19) by Arm</h4>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={perArmAMPM} margin={{ left: 0, right: 20, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="armName" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="amVol" name="AM (07–09)" fill="#2563eb" radius={[4, 4, 0, 0]} />
          <Bar dataKey="pmVol" name="PM (16–19)" fill="#7c3aed" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <div className="table-wrapper" style={{ marginTop: 16 }}>
        <table className="mov-table">
          <thead>
            <tr>
              <th>Arm</th>
              <th>AM Volume</th>
              <th>PM Volume</th>
              <th>Dominant</th>
              <th>Heavy % AM</th>
              <th>Heavy % PM</th>
            </tr>
          </thead>
          <tbody>
            {perArmAMPM.map(row => {
              const dom = row.amVol >= row.pmVol ? 'AM' : 'PM';
              return (
                <tr key={row.armId}>
                  <td>{row.armName}</td>
                  <td>{row.amVol.toLocaleString()}</td>
                  <td>{row.pmVol.toLocaleString()}</td>
                  <td>
                    <span className={`badge badge-${dom === 'AM' ? 'blue' : 'purple'}`}>{dom}</span>
                  </td>
                  <td>{row.heavyPctAM}%</td>
                  <td>{row.heavyPctPM}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function AdvancedAnalysis({ analytics }) {
  if (!analytics) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <h3 className="section-title">Heavy Vehicle Report</h3>
        <HeavyVehicleReport analytics={analytics} />
      </div>
      <div className="card">
        <h3 className="section-title">AM vs PM Comparison</h3>
        <AMPMComparison analytics={analytics} />
      </div>
    </div>
  );
}
