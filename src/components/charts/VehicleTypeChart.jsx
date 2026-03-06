import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const LIGHT_COLORS = ['#3b82f6', '#60a5fa', '#93c5fd'];
const HEAVY_COLORS = ['#ef4444', '#f97316', '#f59e0b'];

const RADIAN = Math.PI / 180;
function renderLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  if (percent < 0.04) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export default function VehicleTypeChart({ analytics }) {
  if (!analytics?.vehicleData?.length) return null;

  const { vehicleData } = analytics;

  const colors = vehicleData.map((d, i) =>
    d.heavy ? HEAVY_COLORS[i % HEAVY_COLORS.length] : LIGHT_COLORS[i % LIGHT_COLORS.length]
  );

  return (
    <div className="card">
      <h3 className="section-title">Vehicle Type Breakdown</h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={vehicleData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={100}
            labelLine={false}
            label={renderLabel}
          >
            {vehicleData.map((_, i) => (
              <Cell key={i} fill={colors[i]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9' }}
            formatter={(val, name) => [val.toLocaleString(), name]}
          />
          <Legend
            iconType="circle"
            iconSize={10}
            formatter={(value, entry) => (
              <span style={{ color: '#cbd5e1', fontSize: 12 }}>
                {value} {entry.payload?.heavy ? '(heavy)' : ''}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
