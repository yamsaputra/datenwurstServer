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
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">
        Verlauf (letzte 30 Tage, Tagesdurchschnitt)
      </h3>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e6e5e0" strokeDasharray="3 3" />
          <XAxis
            dataKey="day"
            tick={{ fill: '#807d72', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval={Math.floor(chartData.length / 6)}
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
            formatter={(v: number) => [v, 'Ø Personen']}
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
    </div>
  );
}
