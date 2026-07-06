'use client';

import { Activity, AlertCircle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Version {
  id: number;
  created_at: string;
  train_from: string;
  train_to: string;
  epochs: number;
  loss_final: number;
  mae_final: number;
  is_active: boolean;
}

interface Props {
  isTraining: boolean;
  activeVersion: number | null;
  versions: Version[];
}

export default function ModelStatusCard({ isTraining, activeVersion, versions }: Props) {
  const active = versions.find(v => v.is_active) ?? versions.find(v => v.id === activeVersion);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        {isTraining ? (
          <>
            <Activity size={16} className="animate-pulse text-warning" />
            <Badge variant="warning">Training läuft</Badge>
          </>
        ) : active ? (
          <>
            <CheckCircle size={16} className="text-success" />
            <Badge variant="success">Modell v{active.id} aktiv</Badge>
          </>
        ) : (
          <>
            <AlertCircle size={16} className="text-muted-foreground" />
            <Badge variant="outline">Kein Modell vorhanden</Badge>
          </>
        )}
      </div>

      {active && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'MAE', value: active.mae_final?.toFixed(2) ?? '-' },
            { label: 'Loss', value: active.loss_final?.toFixed(4) ?? '-' },
            { label: 'Epochs', value: active.epochs ?? '-' },
            { label: 'Trainiert', value: new Date(active.created_at).toLocaleDateString('de-DE') },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-md border border-border bg-bg-raised p-3">
              <p className="mb-1 text-xs text-muted-foreground">{label}</p>
              <p className="text-sm font-medium text-foreground">{value}</p>
            </div>
          ))}
        </div>
      )}

      {versions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Letzte Versionen
          </p>
          <div className="divide-y divide-border rounded-md border border-border bg-card">
            {versions.slice(0, 3).map(v => (
              <div key={v.id} className="grid grid-cols-3 items-center gap-2 px-3 py-2 text-xs">
                <span className={v.is_active ? 'font-medium text-primary' : 'text-muted-foreground'}>
                  v{v.id} {v.is_active ? '(aktiv)' : ''}
                </span>
                <span className="text-muted-foreground">MAE {v.mae_final?.toFixed(2) ?? '-'}</span>
                <span className="text-right text-muted-foreground">
                  {new Date(v.created_at).toLocaleDateString('de-DE')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
