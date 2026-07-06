'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatDate } from '@/lib/utils';

interface ForecastPoint {
  target_interval: string;
  predicted_occ: number;
}

interface Props { data: ForecastPoint[]; }

export default function WeeklyForecastChart({ data }: Props) {
  const byDay = new Map<string, number[]>();
  for (const d of data) {
    const day = d.target_interval.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(d.predicted_occ);
  }
  const chartData = [...byDay.entries()].map(([day, vals]) => ({
    day: formatDate(day),
    peak: Math.round(Math.max(...vals)),
    avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
  }));

  return (
    <div>
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">Nächste 7 Tage (Tagesspitzen)</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e6e5e0" strokeDasharray="3 3" />
          <XAxis dataKey="day" tick={{ fill: '#807d72', fontSize: 11 }} axisLine={false} tickLine={false} />
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
            formatter={(v: number, name: string) => [v, name === 'peak' ? 'Spitze' : 'Durchschnitt']}
          />
          <Bar dataKey="peak" fill="#f54e00" radius={[4, 4, 0, 0]} maxBarSize={36} />
          <Bar dataKey="avg" fill="#e6e5e0" radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
