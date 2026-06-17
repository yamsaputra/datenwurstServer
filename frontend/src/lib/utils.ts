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
  if (percent >= 85) return '#e8394a';
  if (percent >= 60) return '#f5a623';
  return '#22c97a';
}
