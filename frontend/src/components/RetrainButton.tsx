'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { post, get } from '@/lib/api';

interface Props { onComplete?: () => void; }

export default function RetrainButton({ onComplete }: Props) {
  const [loading, setLoading]   = useState(false);
  const [message, setMessage]   = useState('');

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
      <button
        onClick={handleRetrain}
        disabled={loading}
        className="flex items-center gap-2 bg-accent hover:bg-accent-dim disabled:opacity-50
                   text-white text-sm font-medium rounded-sm px-4 py-2.5
                   transition-colors min-h-[44px]"
      >
        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        {loading ? 'Trainiert…' : 'Neu trainieren'}
      </button>
      {message && (
        <p className="text-sm text-text-muted">{message}</p>
      )}
    </div>
  );
}
