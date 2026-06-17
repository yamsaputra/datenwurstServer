'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatTime } from '@/lib/utils';

interface ForecastPoint {
  target_interval: string;
  predicted_occ: number;
}

interface Props {
  data: ForecastPoint[];
  title?: string;
}

export default function ForecastChart({ data, title = 'Nächste Stunden' }: Props) {
  const chartData = data.map(d => ({
    time: formatTime(d.target_interval),
    occ:  Math.round(d.predicted_occ),
  }));

  return (
    <div>
      <h3 className="text-sm font-medium text-text-muted mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#4d8fff" stopOpacity={0.25}/>
              <stop offset="100%" stopColor="#4d8fff" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#1e3054" strokeDasharray="3 3" />
          <XAxis
            dataKey="time"
            tick={{ fill: '#7a93b8', fontSize: 11 }}
            axisLine={false} tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#7a93b8', fontSize: 11 }}
            axisLine={false} tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: '#0d1629',
              border: '1px solid #1e3054',
              borderRadius: '10px',
              color: '#e8edf5',
              fontSize: 12,
            }}
            labelStyle={{ color: '#7a93b8' }}
            formatter={(v: number) => [v, 'Personen']}
          />
          <Area
            type="monotone" dataKey="occ"
            stroke="#4d8fff" strokeWidth={2}
            fill="url(#blueGrad)"
            dot={false} activeDot={{ r: 4, fill: '#4d8fff', stroke: '#080e1a', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
