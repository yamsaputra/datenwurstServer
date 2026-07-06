'use client';

import { Activity, AlertCircle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface ModelVersion {
  id: number;
  created_at: string;
  train_from: string;
  train_to: string;
  epochs: number;
  loss_final: number;
  mae_final: number;
  is_active: boolean;
}

export interface ForecastMeta {
  upcoming_intervals: number;
  horizon: string | null;
  generated_at: string | null;
}

interface Props {
  isTraining: boolean;
  activeVersion: number | null;
  versions: ModelVersion[];
  meta?: ForecastMeta | null;
}

// Metrics may arrive as strings or NaN from older training runs
export const fmtMetric = (v: unknown, digits: number) =>
  Number.isFinite(Number(v)) ? Number(v).toFixed(digits) : '–';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('de-DE');

export default function ModelStatusCard({ isTraining, activeVersion, versions, meta }: Props) {
  const active = versions.find(v => v.is_active) ?? versions.find(v => v.id === activeVersion);

  const tiles = active
    ? [
        { label: 'Aktive Version', value: `v${active.id}`, hint: `trainiert am ${fmtDate(active.created_at)}` },
        {
          label: 'MAE',
          value: fmtMetric(active.mae_final, 2),
          hint: 'Ø Abweichung in Personen pro Intervall',
        },
        { label: 'Loss (final)', value: fmtMetric(active.loss_final, 4), hint: 'Trainingsfehler der letzten Epoche' },
        { label: 'Epochen', value: String(active.epochs ?? '–'), hint: 'Durchläufe über die Trainingsdaten' },
        {
          label: 'Trainingszeitraum',
          value: `${fmtDate(active.train_from)} – ${fmtDate(active.train_to)}`,
          hint: 'verwendete historische Daten',
        },
        {
          label: 'Prognosehorizont',
          value: meta?.horizon
            ? new Date(meta.horizon).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
            : '–',
          hint: meta?.upcoming_intervals
            ? `${meta.upcoming_intervals} anstehende 30-Min-Intervalle`
            : 'noch keine Prognosen berechnet',
        },
      ]
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {isTraining ? (
          <>
            <Activity size={16} className="animate-pulse text-warning" />
            <Badge variant="warning">Training läuft</Badge>
            <span className="text-xs text-muted-foreground">
              Das Modell wird gerade neu trainiert — der Status aktualisiert sich automatisch.
            </span>
          </>
        ) : active ? (
          <>
            <CheckCircle size={16} className="text-success" />
            <Badge variant="success">Modell v{active.id} aktiv</Badge>
            {meta?.generated_at && (
              <span className="text-xs text-muted-foreground">
                Prognosen zuletzt berechnet am{' '}
                {new Date(meta.generated_at).toLocaleString('de-DE', {
                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                })}{' '}
                Uhr
              </span>
            )}
          </>
        ) : (
          <>
            <AlertCircle size={16} className="text-muted-foreground" />
            <Badge variant="outline">Kein Modell vorhanden</Badge>
            <span className="text-xs text-muted-foreground">
              Starten Sie ein Training, sobald genügend Besucherdaten vorliegen.
            </span>
          </>
        )}
      </div>

      {active && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {tiles.map(({ label, value, hint }) => (
            <div key={label} className="rounded-md border border-border bg-bg-raised p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 font-mono text-sm font-medium text-foreground">{value}</p>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
