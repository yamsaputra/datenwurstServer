'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart2, Brain, LibraryBig, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_BASE } from '@/lib/api';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/dashboard', label: 'Übersicht', icon: BarChart2 },
  { href: '/dashboard/ml', label: 'Modell & Training', icon: Brain },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
    router.push('/login');
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-background lg:flex lg:flex-col">
        <div className="border-b border-border p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <LibraryBig size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight text-foreground">Bibliothek</p>
              <p className="text-xs text-muted-foreground">Auslastung &amp; Prognose</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors',
                  active
                    ? 'bg-card text-foreground ring-1 ring-border'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon size={16} className={active ? 'text-primary' : ''} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <Button variant="ghost" className="w-full justify-start" onClick={logout}>
            <LogOut size={16} />
            Abmelden
          </Button>
        </div>
      </aside>

      <main className="w-full flex-1 overflow-auto">
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <LibraryBig size={17} />
              </div>
              <span className="text-sm font-semibold">Bibliothek</span>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Abmelden">
              <LogOut size={16} />
            </Button>
          </div>
          <nav className="mt-3 grid grid-cols-2 gap-2">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex h-10 items-center justify-center gap-2 rounded-md text-sm transition-colors',
                    active
                      ? 'bg-card text-foreground ring-1 ring-border'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon size={15} className={active ? 'text-primary' : ''} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </header>
        <div className="mx-auto max-w-[1440px] p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
