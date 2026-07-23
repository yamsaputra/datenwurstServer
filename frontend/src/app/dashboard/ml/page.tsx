'use client';

import { useEffect, useState, useCallback } from 'react';
import { CalendarClock } from 'lucide-react';
import { get, post, put } from '@/lib/api';
import ModelStatusCard, { type ForecastMeta, type ModelVersion } from '@/components/ModelStatusCard';
import ModelVersionsTable from '@/components/ModelVersionsTable';
import RetrainButton from '@/components/RetrainButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface MLStatus {
  is_training: boolean;
  active_version: number | null;
  versions: ModelVersion[];
}
interface Config { [key: string]: unknown; }

export default function MLPage() {
  const [status, setStatus] = useState<MLStatus | null>(null);
  const [statusError, setStatusError] = useState('');
  const [meta, setMeta] = useState<ForecastMeta | null>(null);
  const [maxOcc, setMaxOcc] = useState('');
  const [widgetTitle, setWidgetTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveFailed, setSaveFailed] = useState(false);
  const [forecasting, setForecasting] = useState(false);
  const [forecastMsg, setForecastMsg] = useState('');
  const [forecastFailed, setForecastFailed] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      setStatus(await get<MLStatus>('/ml/status'));
      setStatusError('');
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : 'Fehler beim Laden des Modellstatus.');
    }
    // Coverage info is secondary — the status card renders without it
    try {
      setMeta(await get<ForecastMeta>('/dashboard/forecasts/meta'));
    } catch {
      setMeta(null);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 10_000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  // Config is loaded once — polling it would overwrite the inputs while typing
  useEffect(() => {
    get<Config>('/dashboard/config')
      .then(c => {
        setMaxOcc(String(c.max_occupancy ?? ''));
        setWidgetTitle(String(c.widget_title ?? ''));
      })
      .catch(e => console.error(e));
  }, []);

  async function generateForecast() {
    setForecasting(true);
    setForecastMsg('');
    setForecastFailed(false);
    try {
      const result = await post<{ count: number }>('/ml/forecast', {});
      setForecastMsg(`${result.count} Intervalle berechnet — Dashboard und Widget sind aktuell.`);
      fetchStatus();
    } catch (err) {
      setForecastFailed(true);
      const msg = err instanceof Error ? err.message : '';
      setForecastMsg(
        msg.includes('No trained model')
          ? 'Kein trainiertes Modell vorhanden — bitte zuerst ein Training starten.'
          : msg.includes('history rows')
            ? 'Noch nicht genügend Besucherdaten für eine Prognose vorhanden.'
            : msg || 'Prognose konnte nicht berechnet werden.'
      );
    } finally {
      setForecasting(false);
    }
  }

  async function saveConfig() {
    const v = parseInt(maxOcc);
    if (!v || v < 1) {
      setSaveFailed(true);
      setSaveMsg('Die maximale Kapazität muss eine Zahl größer 0 sein.');
      return;
    }
    setSaving(true);
    setSaveMsg('');
    setSaveFailed(false);
    try {
      await put('/dashboard/config', { key: 'max_occupancy', value: v });
      if (widgetTitle.trim()) {
        await put('/dashboard/config', { key: 'widget_title', value: widgetTitle.trim() });
      }
      setSaveMsg('Einstellungen gespeichert.');
    } catch {
      setSaveFailed(true);
      setSaveMsg('Speichern fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <Badge>KI-Modell</Badge>
        <h1 className="mt-4 text-4xl font-normal leading-tight tracking-[-0.02em] text-foreground">
          Modell &amp; Training
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Das Prognosemodell lernt aus den historischen Besucherdaten und sagt die Belegung in
          30-Minuten-Intervallen für die kommende Woche voraus. Hier sehen Sie Qualität und Historie der
          Trainingsläufe und starten bei Bedarf ein neues Training.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Modellstatus</CardTitle>
            <CardDescription>Kennzahlen des aktiven Modells und aktueller Prognosestand</CardDescription>
          </CardHeader>
          <CardContent>
            {status ? (
              <ModelStatusCard
                isTraining={status.is_training}
                activeVersion={status.active_version}
                versions={status.versions}
                meta={meta}
              />
            ) : statusError ? (
              <p className="rounded-md border border-danger/20 bg-danger/10 p-4 text-sm text-danger">
                {statusError}
              </p>
            ) : (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />)}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Neues Training</CardTitle>
              <CardDescription>
                Trainiert das Modell neu, aktiviert es und berechnet die Prognose direkt im Anschluss.
                Dauert je nach Datenmenge einige Minuten — die Seite kann dabei geöffnet bleiben.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {meta?.training_ready && (
                <p className="rounded-md border border-success/20 bg-success/10 p-3 text-xs text-success">
                  Genug Daten gesammelt ({meta.valid_windows} von {meta.min_training_windows} benötigten
                  Trainingsfenstern) — ein Training wird empfohlen.
                </p>
              )}
              {meta && typeof meta.data_days_available === 'number' &&
                meta.data_days_available < (meta.min_training_days_recommended ?? 182) && (
                <p className="rounded-md border border-warning/20 bg-warning/10 p-3 text-xs text-warning">
                  Nur {meta.data_days_available} Tage an Daten vorhanden — für ein stabiles Modell werden
                  mindestens {Math.round((meta.min_training_days_recommended ?? 182) / 30)} Monate empfohlen.
                  Das Training kann trotzdem gestartet werden.
                </p>
              )}
              <RetrainButton isTraining={status?.is_training ?? false} onComplete={fetchStatus} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Prognose berechnen</CardTitle>
              <CardDescription>
                Berechnet die 7-Tage-Prognose mit dem aktiven Modell sofort neu, ohne auf den
                stündlichen Zeitplan zu warten.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="secondary" onClick={generateForecast} disabled={forecasting}>
                <CalendarClock size={15} className={forecasting ? 'animate-pulse' : ''} />
                {forecasting ? 'Berechnet…' : 'Prognose jetzt berechnen'}
              </Button>
              {forecastMsg && (
                <p className={`text-sm ${forecastFailed ? 'text-danger' : 'text-muted-foreground'}`}>
                  {forecastMsg}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trainingshistorie</CardTitle>
          <CardDescription>
            Die letzten Trainingsläufe im Vergleich — ein niedrigerer MAE bedeutet genauere Prognosen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status ? (
            <ModelVersionsTable versions={status.versions} />
          ) : (
            <div className="h-32 animate-pulse rounded-md bg-muted" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Einstellungen</CardTitle>
          <CardDescription>Kapazität und Beschriftung für Dashboard, Prognose und Widget.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="max-occupancy">
                Maximale Kapazität
              </label>
              <Input
                id="max-occupancy"
                type="number"
                min="1"
                max="9999"
                value={maxOcc}
                onChange={e => setMaxOcc(e.target.value)}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Anzahl Plätze im Lernbereich — der Sensor erfasst nur den Haupteingang des
                Lernbereichs, nicht das gesamte Gebäude. Bezugsgröße für Prozentwerte und Statusfarben.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="widget-title">
                Widget-Titel
              </label>
              <Input
                id="widget-title"
                type="text"
                maxLength={60}
                value={widgetTitle}
                onChange={e => setWidgetTitle(e.target.value)}
                placeholder="Bibliothek Auslastung"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Überschrift im öffentlichen Widget, z. B. der Name Ihrer Bibliothek.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={saveConfig} disabled={saving}>
                {saving ? 'Speichert…' : 'Speichern'}
              </Button>
              {saveMsg && (
                <p className={`text-sm ${saveFailed ? 'text-danger' : 'text-success'}`}>{saveMsg}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
