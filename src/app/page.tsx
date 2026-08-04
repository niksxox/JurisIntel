'use client';

import { useEffect, useState, lazy, Suspense } from 'react';
import { getSession, type Session } from '@/lib/auth';
import { Login } from '@/components/jurisintel/Login';
import { Layout, type ViewId } from '@/components/jurisintel/Layout';
import { Dashboard } from '@/components/jurisintel/views/Dashboard';
import { Cases } from '@/components/jurisintel/views/Cases';
import { Trends } from '@/components/jurisintel/views/Trends';
import { Search } from '@/components/jurisintel/views/Search';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy-load heavy components for performance
const AIChat = lazy(() => import('@/components/jurisintel/views/AIChat').then(m => ({ default: m.AIChat })));
const NetworkGraph = lazy(() => import('@/components/jurisintel/views/NetworkGraph').then(m => ({ default: m.NetworkGraph })));
const CrimeMap = lazy(() => import('@/components/jurisintel/views/CrimeMap').then(m => ({ default: m.CrimeMap })));
const SocioDemo = lazy(() => import('@/components/jurisintel/views/SocioDemo').then(m => ({ default: m.SocioDemo })));
const Financial = lazy(() => import('@/components/jurisintel/views/Financial').then(m => ({ default: m.Financial })));
const Forecast = lazy(() => import('@/components/jurisintel/views/Forecast').then(m => ({ default: m.Forecast })));
const WantedList = lazy(() => import('@/components/jurisintel/views/WantedList').then(m => ({ default: m.WantedList })));
const Stations = lazy(() => import('@/components/jurisintel/views/Stations').then(m => ({ default: m.Stations })));
const Users = lazy(() => import('@/components/jurisintel/views/Users').then(m => ({ default: m.Users })));
const AuditLog = lazy(() => import('@/components/jurisintel/views/AuditLog').then(m => ({ default: m.AuditLog })));

function ViewSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-6 w-72" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px]" />
        ))}
      </div>
      <Skeleton className="h-[300px]" />
      <Skeleton className="h-[300px]" />
    </div>
  );
}

type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; session: Session };

export default function Home() {
  const [authState, setAuthState] = useState<AuthState>({ status: 'loading' });
  const [currentView, setCurrentView] = useState<ViewId>('dashboard');

  useEffect(() => {
    const existing = getSession();
    setAuthState(
      existing
        ? { status: 'authenticated', session: existing }
        : { status: 'unauthenticated' }
    );
  }, []);

  const handleLogin = (session: Session) => {
    setAuthState({ status: 'authenticated', session });
  };

  if (authState.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2">
          <span className="pulse-dot emerald" />
          <span className="font-mono-label">INITIALIZING SYSTEM...</span>
        </div>
      </div>
    );
  }

  if (authState.status === 'unauthenticated') {
    return <Login onLogin={handleLogin} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'cases': return <Cases />;
      case 'chat': return <Suspense fallback={<ViewSkeleton />}><AIChat /></Suspense>;
      case 'trends': return <Trends />;
      case 'network': return <Suspense fallback={<ViewSkeleton />}><NetworkGraph /></Suspense>;
      case 'map': return <Suspense fallback={<ViewSkeleton />}><CrimeMap /></Suspense>;
      case 'sociodemo': return <Suspense fallback={<ViewSkeleton />}><SocioDemo /></Suspense>;
      case 'financial': return <Suspense fallback={<ViewSkeleton />}><Financial /></Suspense>;
      case 'forecast': return <Suspense fallback={<ViewSkeleton />}><Forecast /></Suspense>;
      case 'wanted': return <Suspense fallback={<ViewSkeleton />}><WantedList /></Suspense>;
      case 'stations': return <Suspense fallback={<ViewSkeleton />}><Stations /></Suspense>;
      case 'search': return <Search />;
      case 'users': return <Suspense fallback={<ViewSkeleton />}><Users /></Suspense>;
      case 'audit': return <Suspense fallback={<ViewSkeleton />}><AuditLog /></Suspense>;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout
      session={authState.session}
      currentView={currentView}
      setView={setCurrentView}
    >
      {renderView()}
    </Layout>
  );
}
