'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatDate } from '@/lib/utils';

interface Interval {
  interval_start: string;
  occupancy: number;
}

interface Props { data: Interval[]; }

export default function HistoricalChart({ data }: Props) {
  const byDay = new Map<string, number[]>();
  for (const d of data) {
    const day = d.interval_start.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(d.occupancy);
  }
  const chartData = [...byDay.entries()].map(([day, vals]) => ({
    day: formatDate(day),
    avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
  }));

  return (
    <div>
      <h3 className="text-sm font-medium text-text-muted mb-4">Verlauf (letzte 30 Tage, Tagesdurchschnitt)</h3>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#1e3054" strokeDasharray="3 3" />
          <XAxis
            dataKey="day"
            tick={{ fill: '#7a93b8', fontSize: 11 }}
            axisLine={false} tickLine={false}
            interval={Math.floor(chartData.length / 6)}
          />
          <YAxis
            tick={{ fill: '#7a93b8', fontSize: 11 }}
            axisLine={false} tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: '#0d1629', border: '1px solid #1e3054',
              borderRadius: '10px', color: '#e8edf5', fontSize: 12,
            }}
            labelStyle={{ color: '#7a93b8' }}
            formatter={(v: number) => [v, 'Ø Personen']}
          />
          <Line
            type="monotone" dataKey="avg"
            stroke="#4d8fff" strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#4d8fff', stroke: '#080e1a', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
