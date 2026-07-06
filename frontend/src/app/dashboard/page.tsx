'use client';

import { useEffect, useState, useCallback } from 'react';
import { get } from '@/lib/api';
import OccupancyGauge from '@/components/OccupancyGauge';
import ForecastChart from '@/components/ForecastChart';
import WeeklyForecastChart from '@/components/WeeklyForecastChart';
import HistoricalChart from '@/components/HistoricalChart';
import WidgetPreview from '@/components/WidgetPreview';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface OccupancyData { occupancy: number; max_occupancy: number; percent: number; timestamp: string; }
interface ForecastPoint { target_interval: string; predicted_occ: number; }
interface Interval { interval_start: string; occupancy: number; }

export default function DashboardPage() {
  const [occ, setOcc] = useState<OccupancyData | null>(null);
  const [forecastH, setForecastH] = useState<ForecastPoint[]>([]);
  const [forecastW, setForecastW] = useState<ForecastPoint[]>([]);
  const [history, setHistory] = useState<Interval[]>([]);
  const [error, setError] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [o, fh, fw, hist] = await Promise.all([
        get<OccupancyData>('/dashboard/occupancy/current'),
        get<ForecastPoint[]>('/dashboard/forecasts/hours'),
        get<ForecastPoint[]>('/dashboard/forecasts/week'),
        get<Interval[]>('/dashboard/occupancy/history'),
      ]);
      setOcc(o);
      setForecastH(fh);
      setForecastW(fw);
      setHistory(hist);
      setError('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden');
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 60_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  if (error) {
    return <p className="rounded-md border border-danger/20 bg-danger/10 p-4 text-sm text-danger">{error}</p>;
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge>Bibliothek</Badge>
          <h1 className="mt-4 text-4xl font-normal leading-tight tracking-[-0.02em] text-foreground">
            Auslastung und Vorhersage
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Live-Daten, stündliche Prognose und öffentlicher Embed in einer ruhigen Arbeitsfläche.
          </p>
        </div>
        {occ && (
          <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            Stand{' '}
            <span className="font-medium text-foreground">
              {new Date(occ.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="flex flex-col items-center justify-center">
          <CardHeader className="w-full">
            <CardTitle>Aktuelle Auslastung</CardTitle>
            <CardDescription>Momentane Belegung im Verhältnis zur Kapazität</CardDescription>
          </CardHeader>
          <CardContent className="flex w-full flex-col items-center">
            {occ ? (
              <OccupancyGauge occupancy={occ.occupancy} maxOccupancy={occ.max_occupancy} percent={occ.percent} />
            ) : (
              <div className="h-[160px] w-[180px] animate-pulse rounded-full bg-muted" />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            {forecastH.length > 0 ? (
              <ForecastChart data={forecastH} title="Vorhersage - nächste Stunden" />
            ) : (
              <SkeletonChart />
            )}
          </CardContent>
        </Card>
      </div>

      <WidgetPreview />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            {forecastW.length > 0 ? <WeeklyForecastChart data={forecastW} /> : <SkeletonChart />}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            {history.length > 0 ? <HistoricalChart data={history} /> : <SkeletonChart />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SkeletonChart() {
  return <div className="h-[180px] animate-pulse rounded-md bg-muted" />;
}
