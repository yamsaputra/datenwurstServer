'use client';

import { TrendingDown, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { fmtMetric, type ModelVersion } from '@/components/ModelStatusCard';

interface Props { versions: ModelVersion[]; }

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('de-DE');

export default function ModelVersionsTable({ versions }: Props) {
  if (versions.length === 0) {
    return (
      <p className="rounded-md border border-border bg-bg-raised p-4 text-sm text-muted-foreground">
        Noch keine Trainingsläufe. Nach dem ersten Training erscheint hier die Historie mit Kennzahlen
        pro Version.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-bg-raised text-left text-muted-foreground">
            <th className="px-3 py-2 font-medium">Version</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Trainingszeitraum</th>
            <th className="px-3 py-2 text-right font-medium">Epochen</th>
            <th className="px-3 py-2 text-right font-medium">Loss</th>
            <th className="px-3 py-2 text-right font-medium">MAE</th>
            <th className="px-3 py-2 text-right font-medium">Erstellt</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {versions.map((v, i) => {
            // Versions arrive newest-first — compare against the run before this one
            const prev = versions[i + 1];
            const mae = Number(v.mae_final);
            const prevMae = prev ? Number(prev.mae_final) : NaN;
            const delta = Number.isFinite(mae) && Number.isFinite(prevMae) ? mae - prevMae : null;

            return (
              <tr key={v.id} className={v.is_active ? 'bg-bg-raised/60' : ''}>
                <td className="px-3 py-2.5 font-mono font-medium text-foreground">v{v.id}</td>
                <td className="px-3 py-2.5">
                  {v.is_active ? (
                    <Badge variant="success">Aktiv</Badge>
                  ) : (
                    <span className="text-muted-foreground">Archiviert</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {fmtDate(v.train_from)} – {fmtDate(v.train_to)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-foreground">{v.epochs ?? '–'}</td>
                <td className="px-3 py-2.5 text-right font-mono text-foreground">{fmtMetric(v.loss_final, 4)}</td>
                <td className="px-3 py-2.5 text-right">
                  <span className="inline-flex items-center justify-end gap-1.5 font-mono text-foreground">
                    {fmtMetric(v.mae_final, 2)}
                    {delta !== null && Math.abs(delta) >= 0.005 && (
                      delta < 0 ? (
                        <TrendingDown size={13} className="text-success" aria-label="besser als Vorversion" />
                      ) : (
                        <TrendingUp size={13} className="text-danger" aria-label="schlechter als Vorversion" />
                      )
                    )}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{fmtDate(v.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
