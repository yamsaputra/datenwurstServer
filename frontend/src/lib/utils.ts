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
