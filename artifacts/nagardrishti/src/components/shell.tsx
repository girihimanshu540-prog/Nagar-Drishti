import { type ReactNode, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { LayoutDashboard, ListOrdered, ClipboardCheck, HardHat, SlidersHorizontal, Globe, Camera, LogIn, LogOut, Menu, X, Eye } from 'lucide-react';
import { useLogout } from '@workspace/api-client-react';
import { useAuth, useResetSession, ROLE_LABEL } from '@/lib/core';
import { cn } from '@/lib/utils';

type Nav = { href: string; label: string; icon: typeof Eye; roles?: string[] };
const NAV: Nav[] = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/tickets', label: 'Tickets', icon: ListOrdered },
  { href: '/reviews', label: 'JE Review', icon: ClipboardCheck, roles: ['je', 'commissioner'] },
  { href: '/contractors', label: 'Contractors', icon: HardHat },
  { href: '/settings', label: 'Thresholds', icon: SlidersHorizontal, roles: ['commissioner'] },
  { href: '/report', label: 'Report hazard', icon: Camera, roles: ['citizen'] },
  { href: '/public', label: 'Public tracker', icon: Globe },
];

export function Shell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const reset = useResetSession();
  const [, nav] = useLocation();
  const logout = useLogout({ mutation: { onSettled: () => { reset(); nav('/'); } } });
  const items = NAV.filter((n) => !n.roles || (user && n.roles.includes(user.role)));
  if (loc === '/login') return <>{children}</>;

  const side = (
    <nav className="flex h-full flex-col">
      <Link href="/" className="flex items-center gap-2.5 px-4 py-4" data-testid="link-home">
        <span className="relative grid h-8 w-8 place-items-center rounded-sm bg-primary text-primary-foreground"><Eye className="h-4 w-4" strokeWidth={2.5} /><span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#0A6CFF] ring-2 ring-sidebar" /></span>
        <span>
          <span className="block font-display text-[17px] font-extrabold leading-none">NagarDrishti</span>
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">road health ops</span>
        </span>
      </Link>
      <div className="mx-4 mb-3 rounded-sm border border-primary/30 bg-primary/5 px-2.5 py-2 font-mono text-[9.5px] uppercase leading-relaxed tracking-wider text-primary">No closure without verified evidence</div>
      <div className="flex-1 space-y-0.5 px-2">
        {items.map((n) => {
          const active = n.href === '/' ? loc === '/' : loc.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} data-testid={`link-nav-${n.label.toLowerCase().replace(/\s/g, '-')}`}
              className={cn('group relative flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm transition-colors', active ? 'bg-sidebar-accent text-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-foreground')}>
              <span className={cn('absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-primary transition-transform origin-center', active ? 'scale-y-100' : 'scale-y-0 group-hover:scale-y-50')} />
              <n.icon className={cn('h-4 w-4', active && 'text-primary')} />{n.label}
            </Link>
          );
        })}
      </div>
      <div className="border-t border-sidebar-border p-3">
        {loading ? <div className="h-10 animate-pulse rounded-sm bg-muted" /> : user ? (
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-sm bg-[#0A6CFF]/20 font-mono text-xs font-bold text-[#6EA8FF]">{user.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}</span>
            <div className="min-w-0 flex-1">
              <div data-testid="text-user-name" className="truncate text-sm font-medium">{user.name}</div>
              <div data-testid="text-user-role" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{ROLE_LABEL[user.role]}</div>
            </div>
            <button data-testid="button-logout" title="Sign out" disabled={logout.isPending} onClick={() => logout.mutate()} className="rounded-sm p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><LogOut className="h-4 w-4" /></button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-sm border border-[#0A6CFF]/40 bg-[#0A6CFF]/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-[#6EA8FF]" data-testid="badge-public-preview"><Eye className="h-3 w-3" />Public preview</div>
            <Link href="/login" data-testid="link-sign-in" className="flex items-center justify-center gap-2 rounded-sm bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-transform active:scale-95"><LogIn className="h-4 w-4" />Sign in</Link>
          </div>
        )}
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-[100dvh]">
      <aside className="sticky top-0 hidden h-[100dvh] w-60 shrink-0 border-r border-sidebar-border bg-sidebar/90 backdrop-blur md:block">{side}</aside>
      <div className={cn('fixed inset-0 z-[1000] md:hidden transition-opacity', open ? 'opacity-100' : 'pointer-events-none opacity-0')}>
        <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
        <aside className={cn('absolute left-0 top-0 h-full w-64 border-r border-sidebar-border bg-sidebar transition-transform duration-300', open ? 'translate-x-0' : '-translate-x-full')}>{side}</aside>
      </div>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-[500] flex items-center justify-between gap-3 border-b border-border/60 bg-background/80 px-4 py-2 backdrop-blur md:px-6">
          <button className="md:hidden" data-testid="button-menu" onClick={() => setOpen(!open)}>{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />Live · polling 15s
          </div>
          {!user && !loading ? (
            <div className="flex items-center gap-2">
              <span className="hidden rounded-sm border border-[#0A6CFF]/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-[#6EA8FF] sm:inline">Public preview · read only</span>
              <Link href="/login" data-testid="link-header-sign-in" className="rounded-sm border border-primary/60 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground">Sign in</Link>
            </div>
          ) : user ? <span className="font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">{ROLE_LABEL[user.role]} · Ward {user.ward_id}</span> : <span />}
        </header>
        <main className="mx-auto max-w-[1500px] px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}

export function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-40 animate-pulse rounded-md bg-muted/50" />;
  if (!user || !roles.includes(user.role))
    return (
      <div className="mx-auto mt-16 max-w-md rounded-md border border-border bg-card p-6 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Restricted</div>
        <h2 className="mt-1 font-display text-xl font-bold">{user ? 'Your role cannot open this view' : 'Sign in required'}</h2>
        <p className="mt-2 text-sm text-muted-foreground">This area needs one of: {roles.map((r) => ROLE_LABEL[r]).join(', ')}.</p>
        {!user && <Link href="/login" data-testid="link-restricted-sign-in" className="mt-4 inline-block rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Sign in</Link>}
      </div>
    );
  return <>{children}</>;
}
