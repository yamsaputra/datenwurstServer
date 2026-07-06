'use client';

import { Radio } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatTime } from '@/lib/utils';

export interface IngestEvent {
  device_id: string;
  event_time: string;
  entries: number;
  exits: number;
  received_at: string;
}

interface Props {
  recent: IngestEvent[];
  total: number;
}

function minutesSince(iso: string) {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
}

export default function IngestStatusCard({ recent, total }: Props) {
  if (recent.length === 0) {
    return (
      <p className="rounded-md border border-border bg-bg-raised p-4 text-sm text-muted-foreground">
        Noch keine Sensordaten empfangen. Sobald ein Zählsensor Daten sendet, erscheinen sie hier.
      </p>
    );
  }

  const lastMin = minutesSince(recent[0].received_at);
  const healthy = lastMin <= 15;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={healthy ? 'success' : 'warning'}>
          <Radio size={11} className="mr-1.5" />
          {healthy ? 'Sensor aktiv' : 'Kein aktuelles Signal'}
        </Badge>
        <span className="text-sm text-muted-foreground">
          Letztes Signal vor{' '}
          <span className="font-medium text-foreground">
            {lastMin < 1 ? 'unter einer Minute' : `${lastMin} Min.`}
          </span>{' '}
          · insgesamt <span className="font-medium text-foreground">{total.toLocaleString('de-DE')}</span>{' '}
          Ereignisse
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-bg-raised text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">Zeitpunkt</th>
              <th className="px-3 py-2 font-medium">Sensor</th>
              <th className="px-3 py-2 text-right font-medium">Eingänge</th>
              <th className="px-3 py-2 text-right font-medium">Ausgänge</th>
              <th className="px-3 py-2 text-right font-medium">Empfangen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {recent.slice(0, 6).map(e => (
              <tr key={`${e.device_id}-${e.received_at}`}>
                <td className="px-3 py-2 font-mono text-foreground">{formatTime(e.event_time)}</td>
                <td className="px-3 py-2 text-muted-foreground">{e.device_id}</td>
                <td className="px-3 py-2 text-right font-mono text-success">+{e.entries}</td>
                <td className="px-3 py-2 text-right font-mono text-danger">−{e.exits}</td>
                <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                  {formatTime(e.received_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
