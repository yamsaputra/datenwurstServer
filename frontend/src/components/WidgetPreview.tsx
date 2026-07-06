'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, MonitorSmartphone, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function WidgetPreview() {
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);

  // window is unavailable during SSR — resolve the embed origin on the client
  useEffect(() => setOrigin(window.location.origin), []);

  const widgetUrl = `${origin || ''}/widget`;
  const embed = `<iframe src="${widgetUrl}" width="420" height="640" style="border:0" loading="lazy" title="Bibliothek Auslastung"></iframe>`;

  async function copyEmbed() {
    try {
      await navigator.clipboard.writeText(embed);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied — the code stays selectable below.
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border bg-bg-raised/70">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Badge>Widget</Badge>
              <Badge variant="outline">Live-Vorschau</Badge>
            </div>
            <CardTitle className="text-[26px] font-normal leading-tight tracking-[-0.01em]">
              Einbettbares Widget
            </CardTitle>
            <CardDescription className="mt-2 max-w-2xl">
              Öffentliche Ansicht mit aktueller Auslastung, stündlicher Tagesprognose und 4-Tage-Ausblick —
              ohne Anmeldung einbettbar auf jeder Website.
            </CardDescription>
          </div>
          <Button variant="secondary" className="shrink-0" onClick={() => window.open('/widget', '_blank')}>
            <ExternalLink size={16} />
            In neuem Tab öffnen
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 p-4 lg:grid-cols-[minmax(320px,420px)_1fr] lg:p-6">
        <div className="rounded-xl border border-border bg-[#26251e] p-2">
          <div className="mb-2 flex items-center gap-1.5 px-2 py-1">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f7f7f4]/30" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#f7f7f4]/30" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#f7f7f4]/30" />
            <span className="ml-auto font-mono text-[11px] text-[#f7f7f4]/65">/widget</span>
          </div>
          <iframe
            title="Widget-Vorschau"
            src="/widget"
            loading="lazy"
            className="h-[640px] w-full rounded-lg border border-white/10 bg-bg-base"
          />
        </div>

        <div className="flex flex-col justify-between gap-6 rounded-lg border border-border bg-bg-raised p-5">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <MonitorSmartphone size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Für externe Seiten gemacht</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Fester Rahmen, keine Anmeldung, keine Cookies — der Inhalt aktualisiert sich alle fünf
                  Minuten von selbst.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-foreground">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Prognose zum Anklicken</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Besucherinnen und Besucher sehen die stündliche Prognose für morgen und können per Klick
                  durch die nächsten vier Tage blättern.
                </p>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Embed-Code
              </p>
              <Button variant="ghost" size="sm" onClick={copyEmbed}>
                {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                {copied ? 'Kopiert' : 'Kopieren'}
              </Button>
            </div>
            <pre className="overflow-x-auto rounded-lg border border-border bg-card p-4 font-mono text-xs text-foreground">
              <code>{embed}</code>
            </pre>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
