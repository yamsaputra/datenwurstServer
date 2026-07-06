'use client';

import { ExternalLink, MonitorSmartphone, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function WidgetPreview() {
  const embed = '<iframe src="/widget" width="420" height="520" loading="lazy"></iframe>';

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border bg-bg-raised/70">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Badge>Widget</Badge>
              <Badge variant="outline">Live Preview</Badge>
            </div>
            <CardTitle className="text-[26px] font-normal leading-tight tracking-[-0.01em]">
              Einbettbare Vorhersage
            </CardTitle>
            <CardDescription className="mt-2 max-w-2xl">
              Vorschau des öffentlichen Iframes mit aktueller Auslastung und kompaktem 3-Tage-Ausblick.
            </CardDescription>
          </div>
          <Button variant="secondary" className="shrink-0" onClick={() => window.open('/widget', '_blank')}>
            <ExternalLink size={16} />
            Öffnen
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 p-4 lg:grid-cols-[minmax(320px,420px)_1fr] lg:p-6">
        <div className="rounded-xl border border-border bg-[#26251e] p-2">
          <div className="mb-2 flex items-center gap-1.5 px-2 py-1">
            <span className="h-2.5 w-2.5 rounded-full bg-[#dfa88f]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#9fc9a2]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#9fbbe0]" />
            <span className="ml-auto font-mono text-[11px] text-[#f7f7f4]/65">/widget</span>
          </div>
          <iframe
            title="Bibliothek Widget Vorschau"
            src="/widget"
            loading="lazy"
            className="h-[520px] w-full rounded-lg border border-white/10 bg-bg-base"
          />
        </div>

        <div className="flex flex-col justify-between gap-6 rounded-lg border border-border bg-bg-raised p-5">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <MonitorSmartphone size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Optimiert für externe Seiten</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Der Frame hat feste Vorschauhöhe, klare Kanten und vermeidet Scroll-Überraschungen im Embed.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-foreground">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Cursor-inspirierte Oberfläche</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Warmes Canvas, Hairline-Border und sparsames Orange halten die Prognose ruhig lesbar.
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Embed-Code
            </p>
            <pre className="overflow-x-auto rounded-lg border border-border bg-card p-4 font-mono text-xs text-foreground">
              <code>{embed}</code>
            </pre>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
