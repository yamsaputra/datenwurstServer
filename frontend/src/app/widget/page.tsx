'use client';

import { useEffect, useState } from 'react';
import { Activity, CalendarDays } from 'lucide-react';
import { occupancyColor } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface WidgetData {
  occupancy: number;
  max_occupancy: number;
  percent: number;
  widget_title: string;
  forecasts_hours: { target_interval: string; predicted_occ: number }[];
  forecasts_week: { target_interval: string; predicted_occ: number }[];
}

const API = process.env.NEXT_PUBLIC_API_URL || '';

export default function WidgetPage() {
  const [data, setData] = useState<WidgetData | null>(null);

  async function fetchData() {
    try {
      const res = await fetch(`${API}/api/v1/public/widget`);
      if (res.ok) setData(await res.json());
    } catch {
      // The public widget stays silent when the host service is temporarily unavailable.
    }
  }

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const color = occupancyColor(data.percent);
  const r = 48;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75;
  const offset = arc - (data.percent / 100) * arc;

  const byDay = new Map<string, number[]>();
  for (const f of data.forecasts_week) {
    const day = f.target_interval.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(f.predicted_occ);
  }
  const days = [...byDay.entries()].slice(0, 3).map(([day, vals]) => {
    const peak = Math.round(Math.max(...vals));
    return {
      label: new Date(day).toLocaleDateString('de-DE', { weekday: 'short' }),
      peak,
      pct: Math.min(100, Math.round((peak / data.max_occupancy) * 100)),
    };
  });

  const status = data.percent >= 85 ? 'Sehr voll' : data.percent >= 60 ? 'Gut besucht' : 'Ruhig';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-bg-raised p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {data.widget_title}
              </p>
              <h1 className="mt-2 text-2xl font-normal leading-tight tracking-[-0.01em]">Auslastung</h1>
            </div>
            <Badge variant={data.percent >= 85 ? 'destructive' : data.percent >= 60 ? 'warning' : 'success'}>
              {status}
            </Badge>
          </div>
        </div>

        <div className="space-y-6 p-5">
          <div className="flex items-center gap-6">
            <svg width="120" height="108" viewBox="0 0 120 108" className="shrink-0">
              <circle
                cx="60"
                cy="60"
                r={r}
                fill="none"
                stroke="#e6e5e0"
                strokeWidth="8"
                strokeDasharray={`${arc} ${circ}`}
                strokeDashoffset={0}
                strokeLinecap="round"
                transform="rotate(135, 60, 60)"
              />
              <circle
                cx="60"
                cy="60"
                r={r}
                fill="none"
                stroke={color}
                strokeWidth="8"
                strokeDasharray={`${arc} ${circ}`}
                strokeDashoffset={offset}
                strokeLinecap="round"
                transform="rotate(135, 60, 60)"
                style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
              />
              <text x="60" y="57" textAnchor="middle" fill="#26251e" fontSize="22" fontWeight="600">
                {data.percent}%
              </text>
              <text x="60" y="72" textAnchor="middle" fill="#5a5852" fontSize="9">
                {data.occupancy}/{data.max_occupancy}
              </text>
            </svg>

            <div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Activity size={14} />
                <span className="text-xs">Aktuell</span>
              </div>
              <p className="mt-1 text-4xl font-normal leading-none tracking-[-0.02em]">{data.occupancy}</p>
              <p className="mt-1 text-xs text-muted-foreground">Personen vor Ort</p>
            </div>
          </div>

          {days.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <CalendarDays size={14} />
                Nächste Tage
              </div>
              <div className="grid grid-cols-3 gap-2">
                {days.map(({ label, peak, pct }) => (
                  <div key={label} className="rounded-md border border-border bg-bg-raised p-2">
                    <div className="relative h-16 overflow-hidden rounded bg-card">
                      <div
                        className="absolute inset-x-0 bottom-0 rounded-t transition-all"
                        style={{ height: `${pct}%`, background: '#f54e00' }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium text-foreground">{peak}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
