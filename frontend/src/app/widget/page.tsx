'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, CalendarDays } from 'lucide-react';
import { occupancyColor, occupancyStatus, localDayKey } from '@/lib/utils';
import { API_BASE } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

interface ForecastPoint {
  target_interval: string;
  predicted_occ: number;
}

interface WidgetData {
  occupancy: number;
  max_occupancy: number;
  percent: number;
  widget_title: string;
  forecasts_hours: ForecastPoint[];
  forecasts_week: ForecastPoint[];
}

interface HourSlot {
  hour: number;
  occ: number;
  pct: number;
}

interface DayForecast {
  key: string;
  weekday: string;
  dateLabel: string;
  isToday: boolean;
  hours: HourSlot[];
  peak: number;
  peakHour: number | null;
  peakPct: number;
}

function buildDays(points: ForecastPoint[], maxOcc: number): DayForecast[] {
  // Half-hour predictions → per-day, per-hour peaks in the viewer's timezone
  const byDay = new Map<string, Map<number, number>>();
  for (const p of points) {
    const key = localDayKey(p.target_interval);
    const hour = new Date(p.target_interval).getHours();
    const occ = Number(p.predicted_occ);
    if (!byDay.has(key)) byDay.set(key, new Map());
    const hours = byDay.get(key)!;
    hours.set(hour, Math.max(hours.get(hour) ?? 0, occ));
  }

  const todayKey = localDayKey(new Date());
  const days: DayForecast[] = [];

  // Today plus the next four days — clicking a day shows its hourly detail
  for (let offset = 0; offset <= 4; offset++) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const key = localDayKey(date);
    const hourMap = byDay.get(key);
    if (!hourMap || hourMap.size === 0) continue;

    let slots: HourSlot[] = [...hourMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([hour, occ]) => ({
        hour,
        occ: Math.round(occ),
        pct: Math.min(100, Math.round((occ / maxOcc) * 100)),
      }));

    // Trim closed early-morning / late-night hours, keep the interesting span
    const first = slots.findIndex(s => s.occ >= 1);
    const last = slots.length - 1 - [...slots].reverse().findIndex(s => s.occ >= 1);
    if (first !== -1) slots = slots.slice(first, last + 1);

    const peakSlot = slots.reduce<HourSlot | null>(
      (best, s) => (best === null || s.occ > best.occ ? s : best),
      null
    );

    days.push({
      key,
      weekday: key === todayKey ? 'Heute' : date.toLocaleDateString('de-DE', { weekday: 'short' }),
      dateLabel: date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
      isToday: key === todayKey,
      hours: slots,
      peak: peakSlot?.occ ?? 0,
      peakHour: peakSlot?.hour ?? null,
      peakPct: peakSlot ? Math.min(100, Math.round((peakSlot.occ / maxOcc) * 100)) : 0,
    });
  }
  return days;
}

export default function WidgetPage() {
  const [data, setData] = useState<WidgetData | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  async function fetchData() {
    try {
      const res = await fetch(`${API_BASE}/public/widget`);
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

  const days = useMemo(
    () => (data ? buildDays(data.forecasts_week, data.max_occupancy) : []),
    [data]
  );

  // Detail opens on the next day (first full forecast day); today stays reachable per click
  const activeDay =
    days.find(d => d.key === selectedDay) ?? days.find(d => !d.isToday) ?? days[0] ?? null;

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const color = occupancyColor(data.percent);
  const status = occupancyStatus(data.percent);
  const r = 48;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75;
  const offset = arc - (data.percent / 100) * arc;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-bg-raised p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {data.widget_title}
              </p>
              <h1 className="mt-2 text-2xl font-normal leading-tight tracking-[-0.01em]">
                Auslastung &amp; Prognose
              </h1>
            </div>
            <Badge variant={status.variant}>{status.label}</Badge>
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
                <span className="text-xs">Gerade vor Ort</span>
              </div>
              <p className="mt-1 text-4xl font-normal leading-none tracking-[-0.02em]">{data.occupancy}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                von {data.max_occupancy} Plätzen belegt
              </p>
            </div>
          </div>

          {days.length > 0 && activeDay ? (
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <CalendarDays size={14} />
                Prognose
              </div>

              <div className="mb-4 grid grid-cols-5 gap-1.5">
                {days.map(day => {
                  const active = day.key === activeDay.key;
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => setSelectedDay(day.key)}
                      aria-pressed={active}
                      className={`rounded-md border px-1 py-1.5 text-center transition-colors ${
                        active
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border bg-bg-raised text-foreground hover:border-foreground/40'
                      }`}
                    >
                      <span className="block text-xs font-medium leading-tight">{day.weekday}</span>
                      <span
                        className={`block text-[10px] leading-tight ${
                          active ? 'text-background/70' : 'text-muted-foreground'
                        }`}
                      >
                        {day.dateLabel}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-md border border-border bg-bg-raised p-3">
                <div className="flex h-24 items-end gap-[3px]">
                  {activeDay.hours.map(slot => (
                    <div
                      key={slot.hour}
                      className="group relative flex h-full flex-1 items-end"
                      title={`${String(slot.hour).padStart(2, '0')}:00 Uhr · ca. ${slot.occ} Personen (${slot.pct} %)`}
                    >
                      <div
                        className="w-full rounded-t transition-all"
                        style={{
                          height: `${Math.max(4, slot.pct)}%`,
                          background: occupancyColor(slot.pct),
                          opacity: 0.9,
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex gap-[3px]">
                  {activeDay.hours.map((slot, i) => (
                    <span
                      key={slot.hour}
                      className="flex-1 text-center text-[9px] leading-tight text-muted-foreground"
                    >
                      {i % 3 === 0 ? slot.hour : ''}
                    </span>
                  ))}
                </div>

                <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
                  {activeDay.peakHour !== null && activeDay.peak >= 1 ? (
                    <>
                      Stoßzeit gegen{' '}
                      <span className="font-medium text-foreground">{activeDay.peakHour}:00 Uhr</span> mit ca.{' '}
                      <span className="font-medium text-foreground">{activeDay.peak} Personen</span> (
                      {activeDay.peakPct} %)
                    </>
                  ) : (
                    'An diesem Tag wird kaum Betrieb erwartet — voraussichtlich geschlossen.'
                  )}
                </p>
              </div>
            </div>
          ) : (
            <p className="rounded-md border border-border bg-bg-raised p-3 text-xs text-muted-foreground">
              Für die kommenden Tage liegt noch keine Prognose vor.
            </p>
          )}

          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Stündliche Prognose auf Basis historischer Besucherdaten · aktualisiert alle 5 Minuten
          </p>
        </div>
      </div>
    </div>
  );
}
