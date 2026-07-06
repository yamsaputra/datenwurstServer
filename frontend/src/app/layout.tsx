import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bibliothek · Auslastung & Prognose',
  description: 'Live-Auslastung und KI-gestützte Besucherprognose für die Bibliothek',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
