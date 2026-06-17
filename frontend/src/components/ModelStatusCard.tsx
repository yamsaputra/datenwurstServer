'use client';

import { Activity, CheckCircle, AlertCircle } from 'lucide-react';

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
  const active = versions.find(v => v.is_active);

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="flex items-center gap-2">
        {isTraining ? (
          <>
            <Activity size={16} className="text-warning animate-pulse" />
            <span className="text-warning text-sm">Training läuft…</span>
          </>
        ) : active ? (
          <>
            <CheckCircle size={16} className="text-success" />
            <span className="text-success text-sm">Modell v{active.id} aktiv</span>
          </>
        ) : (
          <>
            <AlertCircle size={16} className="text-text-muted" />
            <span className="text-text-muted text-sm">Kein Modell vorhanden</span>
          </>
        )}
      </div>

      {/* Active model metrics */}
      {active && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'MAE',    value: active.mae_final?.toFixed(2) ?? '—' },
            { label: 'Loss',   value: active.loss_final?.toFixed(4) ?? '—' },
            { label: 'Epochs', value: active.epochs ?? '—' },
            { label: 'Trainiert', value: new Date(active.created_at).toLocaleDateString('de-DE') },
          ].map(({ label, value }) => (
            <div key={label} className="bg-bg-raised rounded-md p-3">
              <p className="text-text-muted text-xs mb-1">{label}</p>
              <p className="text-text-primary text-sm font-medium">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Recent versions */}
      {versions.length > 0 && (
        <div>
          <p className="text-xs text-text-muted mb-2">Letzte Versionen</p>
          <div className="space-y-1">
            {versions.slice(0, 3).map(v => (
              <div key={v.id} className="flex items-center justify-between text-xs py-1.5 border-t border-border">
                <span className={v.is_active ? 'text-accent-glow font-medium' : 'text-text-muted'}>
                  v{v.id} {v.is_active ? '(aktiv)' : ''}
                </span>
                <span className="text-text-muted">MAE {v.mae_final?.toFixed(2) ?? '—'}</span>
                <span className="text-text-muted">{new Date(v.created_at).toLocaleDateString('de-DE')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
