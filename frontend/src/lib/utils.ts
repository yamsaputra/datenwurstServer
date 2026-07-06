import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function occupancyColor(percent: number): string {
  if (percent >= 85) return '#cf2d56';
  if (percent >= 60) return '#c08532';
  return '#1f8a65';
}

export function occupancyStatus(percent: number) {
  if (percent >= 85) return { label: 'Sehr voll', variant: 'destructive' as const };
  if (percent >= 60) return { label: 'Gut besucht', variant: 'warning' as const };
  return { label: 'Ruhig', variant: 'success' as const };
}

// Day key in the viewer's timezone — slicing the ISO string would bucket
// late-evening intervals into the wrong (UTC) day.
export function localDayKey(iso: string | Date) {
  return new Date(iso).toLocaleDateString('en-CA');
}
