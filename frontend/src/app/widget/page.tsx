'use client';

import { useEffect, useState } from 'react';
import { occupancyColor } from '@/lib/utils';

interface WidgetData {
  occupancy: number;
  max_occupancy: number;
  percent: number;
  widget_title: string;
  forecasts_hours: { target_interval: string; predicted_occ: number }[];
  forecasts_week:  { target_interval: string; predicted_occ: number }[];
}

const API = process.env.NEXT_PUBLIC_API_URL || '';

export default function WidgetPage() {
  const [data, setData] = useState<WidgetData | null>(null);

  async function fetchData() {
    try {
      const res = await fetch(`${API}/api/v1/public/widget`);
      if (res.ok) setData(await res.json());
    } catch { /* silent */ }
  }

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  if (!data) return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const color  = occupancyColor(data.percent);
  const R = 48; const circ = 2 * Math.PI * R;
  const arc = circ * 0.75;
  const offset = arc - (data.percent / 100) * arc;

  // Next 3 days from weekly forecast
  const byDay = new Map<string, number[]>();
  for (const f of data.forecasts_week) {
    const day = f.target_interval.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(f.predicted_occ);
  }
  const days = [...byDay.entries()].slice(0, 3).map(([day, vals]) => ({
    label: new Date(day).toLocaleDateString('de-DE', { weekday: 'short' }),
    peak:  Math.round(Math.max(...vals)),
    pct:   Math.min(100, Math.round((Math.max(...vals) / data.max_occupancy) * 100)),
  }));

  return (
    <div
      className="min-h-screen bg-bg-base flex items-center justify-center p-4"
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      <div className="bg-bg-surface border border-border rounded-xl p-6 w-full max-w-sm">
        <p className="text-text-muted text-xs mb-4 font-medium tracking-wide uppercase">
          {data.widget_title}
        </p>

        {/* Gauge */}
        <div className="flex items-center gap-6 mb-6">
          <svg width="120" height="108" viewBox="0 0 120 108">
            <circle cx="60" cy="60" r={R} fill="none" stroke="#1e3054" strokeWidth="8"
              strokeDasharray={`${arc} ${circ}`} strokeDashoffset={0} strokeLinecap="round"
              transform="rotate(135, 60, 60)" />
            <circle cx="60" cy="60" r={R} fill="none" stroke={color} strokeWidth="8"
              strokeDasharray={`${arc} ${circ}`} strokeDashoffset={offset} strokeLinecap="round"
              transform="rotate(135, 60, 60)"
              style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }} />
            <text x="60" y="57" textAnchor="middle" fill="#e8edf5" fontSize="20" fontWeight="700">{data.percent}%</text>
            <text x="60" y="71" textAnchor="middle" fill="#7a93b8" fontSize="9">{data.occupancy}/{data.max_occupancy}</text>
          </svg>

          <div>
            <p className="text-text-primary text-2xl font-bold">{data.occupancy}</p>
            <p className="text-text-muted text-xs">Personen</p>
            <span
              className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: `${color}22`, color }}
            >
              {data.percent >= 85 ? 'Sehr voll' : data.percent >= 60 ? 'Gut besucht' : 'Ruhig'}
            </span>
          </div>
        </div>

        {/* Next 3 days sparkline bars */}
        {days.length > 0 && (
          <div>
            <p className="text-text-muted text-xs mb-2">Vorhersage — nächste Tage</p>
            <div className="flex gap-2">
              {days.map(({ label, peak, pct }) => (
                <div key={label} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full h-16 bg-bg-raised rounded-xs relative overflow-hidden">
                    <div
                      className="absolute bottom-0 left-0 right-0 rounded-xs transition-all"
                      style={{ height: `${pct}%`, background: '#2f6fef' }}
                    />
                  </div>
                  <p className="text-text-muted text-xs">{label}</p>
                  <p className="text-text-primary text-xs font-medium">{peak}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
