'use client';

import { useEffect, useState, useCallback } from 'react';
import { get, put } from '@/lib/api';
import ModelStatusCard from '@/components/ModelStatusCard';
import RetrainButton from '@/components/RetrainButton';

interface MLStatus {
  is_training: boolean;
  active_version: number | null;
  versions: {
    id: number; created_at: string; train_from: string; train_to: string;
    epochs: number; loss_final: number; mae_final: number; is_active: boolean;
  }[];
}
interface Config { [key: string]: unknown; }

export default function MLPage() {
  const [status, setStatus]       = useState<MLStatus | null>(null);
  const [config, setConfig]       = useState<Config>({});
  const [maxOcc, setMaxOcc]       = useState('');
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState('');

  const fetchStatus = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([
        get<MLStatus>('/ml/status'),
        get<Config>('/dashboard/config'),
      ]);
      setStatus(s);
      setConfig(c);
      setMaxOcc(String(c.max_occupancy ?? ''));
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 10_000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  async function saveMaxOcc() {
    const v = parseInt(maxOcc);
    if (!v || v < 1) return;
    setSaving(true);
    setSaveMsg('');
    try {
      await put('/dashboard/config', { key: 'max_occupancy', value: v });
      setSaveMsg('Gespeichert.');
    } catch {
      setSaveMsg('Fehler beim Speichern.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-text-primary">KI-Modell</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model status */}
        <div className="bg-bg-surface border border-border rounded-md p-6">
          <h2 className="text-sm font-medium text-text-muted mb-4">Modellstatus</h2>
          {status ? (
            <ModelStatusCard
              isTraining={status.is_training}
              activeVersion={status.active_version}
              versions={status.versions}
            />
          ) : (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-8 bg-bg-raised rounded-md animate-pulse"/>)}
            </div>
          )}
        </div>

        {/* Retrain */}
        <div className="bg-bg-surface border border-border rounded-md p-6">
          <h2 className="text-sm font-medium text-text-muted mb-4">Manuelles Training</h2>
          <p className="text-xs text-text-muted mb-5">
            Trainiert das Modell neu mit den letzten 12 Monaten Daten.
            Kann einige Minuten dauern.
          </p>
          <RetrainButton onComplete={fetchStatus} />
        </div>
      </div>

      {/* Config */}
      <div className="bg-bg-surface border border-border rounded-md p-6">
        <h2 className="text-sm font-medium text-text-muted mb-4">Konfiguration</h2>
        <div className="max-w-xs space-y-4">
          <div>
            <label className="block text-xs text-text-muted mb-1.5">Maximale Auslastung</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1" max="9999"
                value={maxOcc}
                onChange={e => setMaxOcc(e.target.value)}
                className="flex-1 bg-bg-raised border border-border rounded-sm px-3 py-2
                           text-text-primary text-sm focus:outline-none focus:border-accent"
              />
              <button
                onClick={saveMaxOcc}
                disabled={saving}
                className="bg-accent hover:bg-accent-dim disabled:opacity-50 text-white
                           text-sm px-4 rounded-sm transition-colors min-h-[44px]"
              >
                {saving ? '…' : 'Speichern'}
              </button>
            </div>
            {saveMsg && <p className="text-xs text-text-muted mt-1">{saveMsg}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
