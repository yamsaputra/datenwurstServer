'use client';

import { useEffect, useState, useCallback } from 'react';
import { get, put } from '@/lib/api';
import ModelStatusCard from '@/components/ModelStatusCard';
import RetrainButton from '@/components/RetrainButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

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
  const [status, setStatus] = useState<MLStatus | null>(null);
  const [maxOcc, setMaxOcc] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const fetchStatus = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([
        get<MLStatus>('/ml/status'),
        get<Config>('/dashboard/config'),
      ]);
      setStatus(s);
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
    <div className="space-y-8">
      <section>
        <Badge>KI-Modell</Badge>
        <h1 className="mt-4 text-4xl font-normal leading-tight tracking-[-0.02em] text-foreground">
          Training und Konfiguration
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Status des aktiven Prognosemodells, manuelles Retraining und Kapazitätsparameter.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Modellstatus</CardTitle>
            <CardDescription>Aktive Version und Qualität der letzten Trainingsläufe</CardDescription>
          </CardHeader>
          <CardContent>
            {status ? (
              <ModelStatusCard
                isTraining={status.is_training}
                activeVersion={status.active_version}
                versions={status.versions}
              />
            ) : (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manuelles Training</CardTitle>
            <CardDescription>
              Trainiert das Modell neu mit den letzten 12 Monaten Daten. Kann einige Minuten dauern.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RetrainButton onComplete={fetchStatus} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Konfiguration</CardTitle>
          <CardDescription>Kapazität, gegen die Auslastung und Prognosen normalisiert werden.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm space-y-3">
            <label className="block text-sm font-medium text-foreground" htmlFor="max-occupancy">
              Maximale Auslastung
            </label>
            <div className="flex gap-2">
              <Input
                id="max-occupancy"
                type="number"
                min="1"
                max="9999"
                value={maxOcc}
                onChange={e => setMaxOcc(e.target.value)}
              />
              <Button onClick={saveMaxOcc} disabled={saving}>
                {saving ? '...' : 'Speichern'}
              </Button>
            </div>
            {saveMsg && <p className="text-xs text-muted-foreground">{saveMsg}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
