'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatTime } from '@/lib/utils';

interface ForecastPoint {
  target_interval: string;
  predicted_occ: number;
}

interface Props {
  data: ForecastPoint[];
}

export default function ForecastChart({ data }: Props) {
  const chartData = data.map(d => ({
    time: formatTime(d.target_interval),
    occ: Math.round(d.predicted_occ),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f54e00" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#f54e00" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#e6e5e0" strokeDasharray="3 3" />
          <XAxis
            dataKey="time"
            tick={{ fill: '#807d72', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#807d72', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: '#ffffff',
              border: '1px solid #cfcdc4',
              borderRadius: '8px',
              color: '#26251e',
              fontSize: 12,
            }}
            labelStyle={{ color: '#5a5852' }}
            formatter={(v: number) => [v, 'Personen']}
          />
          <Area
            type="monotone"
            dataKey="occ"
            stroke="#f54e00"
            strokeWidth={2}
            fill="url(#forecastGrad)"
            dot={false}
            activeDot={{ r: 4, fill: '#f54e00', stroke: '#ffffff', strokeWidth: 2 }}
          />
      </AreaChart>
    </ResponsiveContainer>
  );
}
