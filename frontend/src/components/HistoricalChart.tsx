'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatDate, localDayKey } from '@/lib/utils';

interface Interval {
  interval_start: string;
  occupancy: number;
}

interface Props { data: Interval[]; }

export default function HistoricalChart({ data }: Props) {
  const byDay = new Map<string, number[]>();
  for (const d of data) {
    const day = localDayKey(d.interval_start);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(d.occupancy);
  }
  const chartData = [...byDay.entries()].map(([day, vals]) => ({
    day: formatDate(day),
    avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    peak: Math.max(...vals),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#e6e5e0" strokeDasharray="3 3" />
        <XAxis
          dataKey="day"
          tick={{ fill: '#807d72', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval={Math.max(0, Math.floor(chartData.length / 6) - 1)}
        />
        <YAxis tick={{ fill: '#807d72', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            background: '#ffffff',
            border: '1px solid #cfcdc4',
            borderRadius: '8px',
            color: '#26251e',
            fontSize: 12,
          }}
          labelStyle={{ color: '#5a5852' }}
          formatter={(v: number, name: string) => [`${v} Personen`, name === 'avg' ? 'Durchschnitt' : 'Spitze']}
        />
        <Line
          type="monotone"
          dataKey="peak"
          stroke="#cfcdc4"
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3, fill: '#cfcdc4', stroke: '#ffffff', strokeWidth: 2 }}
        />
        <Line
          type="monotone"
          dataKey="avg"
          stroke="#26251e"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#26251e', stroke: '#ffffff', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
