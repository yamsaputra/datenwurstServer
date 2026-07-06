'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { post } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface Props { onComplete?: () => void; }

export default function RetrainButton({ onComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function handleRetrain() {
    setLoading(true);
    setMessage('');
    try {
      await post('/ml/retrain', {});
      setMessage('Training abgeschlossen.');
      onComplete?.();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Fehler beim Trainieren');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button onClick={handleRetrain} disabled={loading}>
        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        {loading ? 'Trainiert...' : 'Neu trainieren'}
      </Button>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
