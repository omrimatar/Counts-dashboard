import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const TURN_COLORS = { Right: '#16a34a', Straight: '#2563eb', Left: '#d97706', 'U-turn': '#dc2626' };

export default function TurnBreakdownChart({ analytics }) {
  if (!analytics?.turnBreakdown) return null;

  const data = Object.entries(analytics.turnBreakdown)
    .filter(([, v]) => v > 0)
    .map(([turn, vol]) => ({ name: turn, Volume: vol }))
    .sort((a, b) => b.Volume - a.Volume);

  if (!data.length) return null;

  return (
    <div className="card">
      <h3 className="section-title">Volume by Turn Type</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#374151' }} width={60} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9' }}
            formatter={val => [val.toLocaleString(), 'Volume']}
          />
          <Bar dataKey="Volume" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={TURN_COLORS[d.name] || '#6366f1'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
