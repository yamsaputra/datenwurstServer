'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart2, Brain, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_BASE } from '@/lib/api';

const navItems = [
  { href: '/dashboard',    label: 'Übersicht',  icon: BarChart2 },
  { href: '/dashboard/ml', label: 'KI-Modell',  icon: Brain },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();

  async function logout() {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
    router.push('/login');
  }

  return (
    <div className="flex min-h-screen bg-bg-base">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-bg-surface border-r border-border flex flex-col">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
            </div>
            <div>
              <p className="text-text-primary text-sm font-semibold leading-tight">Bibliothek</p>
              <p className="text-text-muted text-xs">Dashboard</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors',
                  active
                    ? 'bg-bg-raised text-text-primary border-l-[3px] border-accent pl-[9px]'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-raised'
                )}
              >
                <Icon size={16} className={active ? 'text-accent-glow' : ''} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm
                       text-text-muted hover:text-danger hover:bg-bg-raised
                       transition-colors w-full min-h-[44px]"
          >
            <LogOut size={16} />
            Abmelden
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8 max-w-[1440px]">
        {children}
      </main>
    </div>
  );
}
