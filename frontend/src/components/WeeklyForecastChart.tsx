'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { localDayKey } from '@/lib/utils';

interface ForecastPoint {
  target_interval: string;
  predicted_occ: number;
}

interface Props { data: ForecastPoint[]; }

export default function WeeklyForecastChart({ data }: Props) {
  const byDay = new Map<string, number[]>();
  for (const d of data) {
    const day = localDayKey(d.target_interval);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(Number(d.predicted_occ));
  }
  const chartData = [...byDay.entries()].map(([day, vals]) => ({
    day: new Date(day).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }),
    Spitze: Math.round(Math.max(...vals)),
    Durchschnitt: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
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
          formatter={(v: number) => [`${v} Personen`]}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: '#5a5852' }}
        />
        <Bar dataKey="Spitze" fill="#f54e00" radius={[4, 4, 0, 0]} maxBarSize={36} />
        <Bar dataKey="Durchschnitt" fill="#e6e5e0" radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}
