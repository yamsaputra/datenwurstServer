'use client';

import { useEffect, useState, useCallback } from 'react';
import { get } from '@/lib/api';
import OccupancyGauge from '@/components/OccupancyGauge';
import ForecastChart from '@/components/ForecastChart';
import WeeklyForecastChart from '@/components/WeeklyForecastChart';
import HistoricalChart from '@/components/HistoricalChart';

interface OccupancyData { occupancy: number; max_occupancy: number; percent: number; timestamp: string; }
interface ForecastPoint { target_interval: string; predicted_occ: number; }
interface Interval      { interval_start: string; occupancy: number; }

export default function DashboardPage() {
  const [occ, setOcc]               = useState<OccupancyData | null>(null);
  const [forecastH, setForecastH]   = useState<ForecastPoint[]>([]);
  const [forecastW, setForecastW]   = useState<ForecastPoint[]>([]);
  const [history, setHistory]       = useState<Interval[]>([]);
  const [error, setError]           = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [o, fh, fw, hist] = await Promise.all([
        get<OccupancyData>('/dashboard/occupancy/current'),
        get<ForecastPoint[]>('/dashboard/forecasts/hours'),
        get<ForecastPoint[]>('/dashboard/forecasts/week'),
        get<Interval[]>('/dashboard/occupancy/history'),
      ]);
      setOcc(o); setForecastH(fh); setForecastW(fw); setHistory(hist);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden');
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 60_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  if (error) return (
    <p className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-md p-4">{error}</p>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-text-primary">Übersicht</h1>

      {/* Top row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Occupancy gauge */}
        <div className="bg-bg-surface border border-border rounded-md p-6 flex flex-col items-center justify-center">
          <p className="text-sm text-text-muted mb-6 self-start">Aktuelle Auslastung</p>
          {occ ? (
            <OccupancyGauge
              occupancy={occ.occupancy}
              maxOccupancy={occ.max_occupancy}
              percent={occ.percent}
            />
          ) : (
            <div className="w-[180px] h-[160px] rounded-full bg-bg-raised animate-pulse" />
          )}
          {occ && (
            <p className="text-xs text-text-muted mt-4">
              Stand: {new Date(occ.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        {/* Hourly forecast */}
        <div className="bg-bg-surface border border-border rounded-md p-6 lg:col-span-2">
          {forecastH.length > 0 ? (
            <ForecastChart data={forecastH} title="Vorhersage — nächste Stunden" />
          ) : (
            <SkeletonChart />
          )}
        </div>
      </div>

      {/* Weekly forecast */}
      <div className="bg-bg-surface border border-border rounded-md p-6">
        {forecastW.length > 0 ? <WeeklyForecastChart data={forecastW} /> : <SkeletonChart />}
      </div>

      {/* Historical chart */}
      <div className="bg-bg-surface border border-border rounded-md p-6">
        {history.length > 0 ? <HistoricalChart data={history} /> : <SkeletonChart />}
      </div>
    </div>
  );
}

function SkeletonChart() {
  return <div className="h-[180px] rounded-md bg-bg-raised animate-pulse" />;
}
