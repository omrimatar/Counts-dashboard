import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

export default function VolumeTimeSeries({ analytics, chartView }) {
  if (!analytics) return null;

  const { hourlyData, intervals, peakHour } = analytics;

  const data = chartView === '15min'
    ? intervals.map(iv => ({ time: iv.timeStart, Volume: iv.total ?? 0 }))
    : hourlyData;

  const peakStart = peakHour?.split('–')[0];

  return (
    <div className="card">
      <h3 className="section-title">Volume Over Time</h3>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            interval={chartView === '15min' ? 3 : 0}
          />
          <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9' }}
            labelStyle={{ color: '#94a3b8' }}
          />
          {peakStart && (
            <ReferenceLine x={peakStart} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: 'Peak', fill: '#f59e0b', fontSize: 11 }} />
          )}
          <Area
            type="monotone"
            dataKey="Volume"
            stroke="#2563eb"
            strokeWidth={2}
            fill="url(#volGrad)"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
