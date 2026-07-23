'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { post } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface RetrainResult {
  version_id: number;
  status?: 'active' | 'rejected' | 'skipped';
  mae_final: number | null;
  holdout_mae?: number | null;
  baseline_mae?: number | null;
  skip_reason?: string;
  forecasts_generated?: number;
}

interface Props {
  isTraining?: boolean;
  onStarted?: () => void;
  onComplete?: () => void;
}

export default function RetrainButton({ isTraining = false, onStarted, onComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [useRange, setUseRange] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);

  const running = loading || isTraining;

  async function handleRetrain() {
    if (useRange && from && to && from >= to) {
      setFailed(true);
      setMessage('Das Startdatum muss vor dem Enddatum liegen.');
      return;
    }
    setLoading(true);
    setFailed(false);
    setMessage('');
    onStarted?.();
    try {
      const body = useRange
        ? { from: from || undefined, to: to || undefined }
        : {};
      const result = await post<RetrainResult>('/ml/retrain', body);

      if (result.status === 'skipped') {
        setFailed(false);
        setMessage(`Training übersprungen: ${result.skip_reason ?? 'nicht genügend Daten.'}`);
      } else if (result.status === 'rejected') {
        setFailed(false);
        const holdout = Number.isFinite(Number(result.holdout_mae)) ? Number(result.holdout_mae).toFixed(2) : '–';
        const baseline = Number.isFinite(Number(result.baseline_mae)) ? Number(result.baseline_mae).toFixed(2) : '–';
        setMessage(
          `Training abgeschlossen, Modell v${result.version_id} wurde jedoch NICHT aktiviert — ` +
          `Holdout-MAE ${holdout} war nicht besser als die Baseline (${baseline}). ` +
          `Es wird weiter die bisherige Prognose verwendet.`
        );
      } else {
        const mae = Number.isFinite(Number(result.mae_final)) ? ` (MAE ${Number(result.mae_final).toFixed(2)})` : '';
        const forecasts = result.forecasts_generated ? ` Die Prognose wurde direkt neu berechnet.` : '';
        setMessage(`Training abgeschlossen — Modell v${result.version_id} ist jetzt aktiv${mae}.${forecasts}`);
      }
      onComplete?.();
    } catch (err: unknown) {
      setFailed(true);
      const msg = err instanceof Error ? err.message : '';
      setMessage(
        msg.includes('already in progress')
          ? 'Es läuft bereits ein Training — bitte warten, bis es abgeschlossen ist.'
          : msg || 'Das Training ist fehlgeschlagen. Bitte erneut versuchen.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={useRange}
          onChange={e => setUseRange(e.target.checked)}
          className="h-4 w-4 accent-[#f54e00]"
        />
        Eigenen Zeitraum wählen (Standard: letzte 12 Monate)
      </label>

      {useRange && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground" htmlFor="train-from">
              Daten von
            </label>
            <Input id="train-from" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground" htmlFor="train-to">
              Daten bis
            </label>
            <Input id="train-to" type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
        </div>
      )}

      <Button onClick={handleRetrain} disabled={running}>
        <RefreshCw size={15} className={running ? 'animate-spin' : ''} />
        {running ? 'Training läuft…' : 'Training starten'}
      </Button>

      {message && (
        <p className={`text-sm ${failed ? 'text-danger' : 'text-muted-foreground'}`}>{message}</p>
      )}
    </div>
  );
}
