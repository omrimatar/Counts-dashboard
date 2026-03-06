import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { CHART_COLORS } from '../../utils/analytics';

export default function DirectionChart({ analytics }) {
  if (!analytics?.directionData?.length) return null;

  const { directionData } = analytics;

  return (
    <div className="card">
      <h3 className="section-title">Volume by Arm (Origin)</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={directionData} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            angle={-25}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9' }}
            formatter={val => [val.toLocaleString(), 'Volume']}
          />
          <Bar dataKey="Volume" radius={[4, 4, 0, 0]}>
            {directionData.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
