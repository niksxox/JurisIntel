'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FolderOpen,
  Bot,
  TrendingUp,
  Share2,
  Map,
  Users,
  Banknote,
  Brain,
  AlertTriangle,
  Building2,
  Search,
  ShieldCheck,
  ScrollText,
  LogOut,
  Menu,
  Bell,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { clearSession, type Session, type Role } from '@/lib/auth';

// ─── Types ───
export type ViewId =
  | 'dashboard'
  | 'cases'
  | 'chat'
  | 'trends'
  | 'network'
  | 'map'
  | 'sociodemo'
  | 'financial'
  | 'forecast'
  | 'wanted'
  | 'stations'
  | 'search'
  | 'users'
  | 'audit';

interface NavItem {
  id: ViewId;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'cases', label: 'Case Files', icon: <FolderOpen className="w-4 h-4" /> },
  { id: 'chat', label: 'AI Chat', icon: <Bot className="w-4 h-4" /> },
  { id: 'trends', label: 'Trends', icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'network', label: 'Network Graph', icon: <Share2 className="w-4 h-4" /> },
  { id: 'map', label: 'Crime Map', icon: <Map className="w-4 h-4" /> },
  { id: 'sociodemo', label: 'Socio-Demo', icon: <Users className="w-4 h-4" /> },
  { id: 'financial', label: 'Financial', icon: <Banknote className="w-4 h-4" /> },
  { id: 'forecast', label: 'Forecast', icon: <Brain className="w-4 h-4" /> },
  { id: 'wanted', label: 'Wanted', icon: <AlertTriangle className="w-4 h-4" /> },
  { id: 'stations', label: 'Stations', icon: <Building2 className="w-4 h-4" /> },
  { id: 'search', label: 'Search', icon: <Search className="w-4 h-4" /> },
  { id: 'users', label: 'Users', icon: <ShieldCheck className="w-4 h-4" />, adminOnly: true },
  { id: 'audit', label: 'Audit Log', icon: <ScrollText className="w-4 h-4" />, adminOnly: true },
];

const ROLE_LABELS: Record<Role, string> = {
  admin: 'ADMIN',
  analyst: 'ANALYST',
  investigator: 'INV',
  supervisor: 'SUP',
};

// ─── Clock ───
function LiveClock() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      // IST = UTC+5:30
      const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000) + (now.getTimezoneOffset() * 60 * 1000));
      setTime(
        ist.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="font-mono text-sm tracking-wider text-muted-foreground">
      IST {time}
    </span>
  );
}

// ─── Sidebar Nav Items ───
function SidebarNav({
  items,
  activeView,
  onViewChange,
}: {
  items: NavItem[];
  activeView: ViewId;
  onViewChange: (v: ViewId) => void;
}) {
  return (
    <nav className="flex flex-col gap-1 px-3" role="navigation" aria-label="Main navigation">
      {items.map((item) => {
        const isActive = activeView === item.id;
        return (
          <TooltipProvider key={item.id} delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onViewChange(item.id)}
                  className={[
                    'flex items-center gap-3 px-3 py-2.5 rounded-md text-left w-full transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  ].join(' ')}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className={isActive ? 'text-primary' : ''}>
                    {item.icon}
                  </span>
                  <span className="font-mono-label normal-case text-xs tracking-wider">
                    {item.label}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-mono text-xs">
                {item.label}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </nav>
  );
}

// ─── Main Layout ───
interface LayoutProps {
  session: Session;
  currentView: ViewId;
  setView: (v: ViewId) => void;
  children: ReactNode;
}

export function Layout({ session, currentView, setView, children }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const filteredNav = NAV_ITEMS.filter(
    (item) => !item.adminOnly || session.role === 'admin'
  );

  const handleViewChange = useCallback(
    (v: ViewId) => {
      setView(v);
      setMobileOpen(false);
    },
    [setView]
  );

  const handleLogout = () => {
    clearSession();
    window.location.reload();
  };

  const activeLabel =
    NAV_ITEMS.find((i) => i.id === currentView)?.label ?? currentView;

  return (
    <div className="min-h-screen flex flex-col">
      {/* ─── Desktop Sidebar ─── */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-[260px] bg-sidebar border-r border-sidebar-border z-30">
        {/* Brand */}
        <div className="px-5 py-5 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-mono text-sm font-bold tracking-[0.2em] text-primary">
                JURISINTEL
              </p>
              <p className="font-mono-label text-[10px] mt-0.5">
                KSP // CRIME INTEL
              </p>
            </div>
          </div>
        </div>

        <Separator className="bg-sidebar-border" />

        {/* Nav */}
        <ScrollArea className="flex-1 py-3">
          <SidebarNav
            items={filteredNav}
            activeView={currentView}
            onViewChange={handleViewChange}
          />
        </ScrollArea>

        <Separator className="bg-sidebar-border" />

        {/* User info + logout */}
        <div className="px-5 py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-mono font-bold text-primary">
              {session.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{session.name}</p>
              <Badge
                variant="outline"
                className="font-mono text-[10px] px-1.5 py-0 h-4 border-primary/30 text-primary"
              >
                {ROLE_LABELS[session.role]}
              </Badge>
            </div>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-ops-red"
                    onClick={handleLogout}
                    aria-label="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-mono text-xs">
                  Logout
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </aside>

      {/* ─── Main area (offset for sidebar) ─── */}
      <div className="lg:pl-[260px] flex flex-col min-h-screen flex-1">
        {/* ─── Header ─── */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-4 md:px-6 h-14 border-b border-border bg-background/80 backdrop-blur-md">
          {/* Left: hamburger (mobile) + breadcrumb */}
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden h-9 w-9"
                  aria-label="Open navigation menu"
                >
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[260px] p-0 bg-sidebar border-sidebar-border">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="px-5 py-5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-mono text-sm font-bold tracking-[0.2em] text-primary">
                        JURISINTEL
                      </p>
                      <p className="font-mono-label text-[10px] mt-0.5">
                        KSP // CRIME INTEL
                      </p>
                    </div>
                  </div>
                </div>
                <Separator className="bg-sidebar-border" />
                <ScrollArea className="py-3">
                  <SidebarNav
                    items={filteredNav}
                    activeView={currentView}
                    onViewChange={handleViewChange}
                  />
                </ScrollArea>
              </SheetContent>
            </Sheet>

            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-sm">
              <span className="font-mono-label text-xs hidden sm:inline">
                KSP
              </span>
              <ChevronRight className="w-3 h-3 text-muted-foreground/50 hidden sm:block" />
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
                {activeLabel}
              </span>
            </div>
          </div>

          {/* Center: live clock */}
          <div className="hidden md:flex">
            <LiveClock />
          </div>

          {/* Right: status indicators */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="pulse-dot emerald" />
              <span className="font-mono-label text-ops-emerald text-[11px] hidden sm:inline">
                SECURE_LINK_ACTIVE
              </span>
            </div>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground"
                    aria-label="Notifications"
                  >
                    <Bell className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="font-mono text-xs">
                  Notifications
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </header>

        {/* ─── Demo Mode Banner ─── */}
        <div className="demo-banner">
          DEMO MODE // RESPONSES FROM REALISTIC KARNATAKA CRIME SEED DATASET // NO POSTGRESQL CONNECTION
        </div>

        {/* ─── Content ─── */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto" role="main">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* ─── Footer (sticky) ─── */}
        <footer className="mt-auto border-t border-border px-4 py-3 text-center">
          <p className="font-mono-label text-[10px] tracking-wider">
            JURISINTEL v2.0 // KARNATAKA STATE POLICE — CLASSIFIED // USE OF
            SYSTEM IS MONITORED
          </p>
        </footer>
      </div>
    </div>
  );
}
