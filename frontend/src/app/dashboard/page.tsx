'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { get } from '@/lib/api';
import { cn } from '@/lib/utils';
import OccupancyGauge from '@/components/OccupancyGauge';
import ForecastChart from '@/components/ForecastChart';
import WeeklyForecastChart from '@/components/WeeklyForecastChart';
import HistoricalChart from '@/components/HistoricalChart';
import IngestStatusCard, { type IngestEvent } from '@/components/IngestStatusCard';
import WidgetPreview from '@/components/WidgetPreview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface OccupancyData { occupancy: number; max_occupancy: number; percent: number; timestamp: string; }
interface ForecastPoint { target_interval: string; predicted_occ: number; }
interface Interval { interval_start: string; occupancy: number; }
interface IngestStatus { recent: IngestEvent[]; total: number; }

const HISTORY_RANGES = [7, 30] as const;

export default function DashboardPage() {
  const [occ, setOcc] = useState<OccupancyData | null>(null);
  const [forecastH, setForecastH] = useState<ForecastPoint[] | null>(null);
  const [forecastW, setForecastW] = useState<ForecastPoint[] | null>(null);
  const [history, setHistory] = useState<Interval[] | null>(null);
  const [ingest, setIngest] = useState<IngestStatus | null>(null);
  const [historyDays, setHistoryDays] = useState<number>(30);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchAll = useCallback(async () => {
    setRefreshing(true);
    const from = new Date(Date.now() - historyDays * 24 * 60 * 60 * 1000).toISOString();
    // Each card loads independently — one failing endpoint must not blank the page
    const [o, fh, fw, hist, ing] = await Promise.allSettled([
      get<OccupancyData>('/dashboard/occupancy/current'),
      get<ForecastPoint[]>('/dashboard/forecasts/hours'),
      get<ForecastPoint[]>('/dashboard/forecasts/week'),
      get<Interval[]>(`/dashboard/occupancy/history?from=${encodeURIComponent(from)}`),
      get<IngestStatus>('/dashboard/ingest/status'),
    ]);
    if (o.status === 'fulfilled') setOcc(o.value);
    if (fh.status === 'fulfilled') setForecastH(fh.value);
    if (fw.status === 'fulfilled') setForecastW(fw.value);
    if (hist.status === 'fulfilled') setHistory(hist.value);
    if (ing.status === 'fulfilled') setIngest(ing.value);

    const failures = [o, fh, fw, hist, ing].filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected'
    );
    if (failures.length === 5) {
      const reason = failures[0].reason;
      setError(reason instanceof Error ? reason.message : 'Fehler beim Laden');
    } else {
      setError('');
    }
    setRefreshing(false);
  }, [historyDays]);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 60_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-md border border-danger/20 bg-danger/10 p-4 text-sm text-danger">{error}</p>
      )}
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge>Übersicht</Badge>
          <h1 className="mt-4 text-4xl font-normal leading-tight tracking-[-0.02em] text-foreground">
            Auslastung &amp; Prognose
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Live-Belegung, stündliche Prognose des KI-Modells und der öffentliche Embed auf einen Blick.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {occ && (
            <div className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground">
              Stand{' '}
              <span className="font-medium text-foreground">
                {new Date(occ.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </span>{' '}
              Uhr
            </div>
          )}
          <Button variant="secondary" onClick={fetchAll} disabled={refreshing} aria-label="Daten aktualisieren">
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            Aktualisieren
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Aktuelle Auslastung</CardTitle>
            <CardDescription>Belegung im Verhältnis zur Kapazität</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col items-center justify-center">
            {occ ? (
              <OccupancyGauge occupancy={occ.occupancy} maxOccupancy={occ.max_occupancy} percent={occ.percent} />
            ) : (
              <div className="h-[160px] w-[180px] animate-pulse rounded-full bg-muted" />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Prognose · nächste Stunden</CardTitle>
            <CardDescription>Erwartete Belegung in 30-Minuten-Schritten</CardDescription>
          </CardHeader>
          <CardContent>
            {forecastH === null ? (
              <SkeletonChart />
            ) : forecastH.length > 0 ? (
              <ForecastChart data={forecastH} />
            ) : (
              <EmptyForecast />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Prognose · nächste 7 Tage</CardTitle>
            <CardDescription>Tagesspitze und Tagesdurchschnitt je Tag</CardDescription>
          </CardHeader>
          <CardContent>
            {forecastW === null ? (
              <SkeletonChart />
            ) : forecastW.length > 0 ? (
              <WeeklyForecastChart data={forecastW} />
            ) : (
              <EmptyForecast />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div className="space-y-1.5">
              <CardTitle>Verlauf</CardTitle>
              <CardDescription>Tagesdurchschnitt und Tagesspitze der Belegung</CardDescription>
            </div>
            <div className="flex rounded-md border border-border bg-bg-raised p-0.5">
              {HISTORY_RANGES.map(days => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setHistoryDays(days)}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                    historyDays === days
                      ? 'bg-card text-foreground shadow-none ring-1 ring-border'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {days} Tage
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {history === null ? (
              <SkeletonChart />
            ) : history.length > 0 ? (
              <HistoricalChart data={history} />
            ) : (
              <p className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                Für diesen Zeitraum liegen noch keine Daten vor.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datenempfang</CardTitle>
          <CardDescription>Zuletzt empfangene Zählereignisse der Eingangssensoren</CardDescription>
        </CardHeader>
        <CardContent>
          {ingest ? (
            <IngestStatusCard recent={ingest.recent} total={ingest.total} />
          ) : (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />)}
            </div>
          )}
        </CardContent>
      </Card>

      <WidgetPreview />
    </div>
  );
}

function SkeletonChart() {
  return <div className="h-[200px] animate-pulse rounded-md bg-muted" />;
}

function EmptyForecast() {
  return (
    <p className="flex h-[200px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
      Noch keine Prognose verfügbar — sobald ein trainiertes Modell aktiv ist, erscheint sie hier.
    </p>
  );
}
