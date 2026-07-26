'use client';

import { useEffect, useState } from 'react';
import { getSession, type Session } from '@/lib/auth';
import { Login } from '@/components/jurisintel/Login';
import { Layout, type ViewId } from '@/components/jurisintel/Layout';
import { Dashboard } from '@/components/jurisintel/views/Dashboard';
import { Cases } from '@/components/jurisintel/views/Cases';
import { AIChat } from '@/components/jurisintel/views/AIChat';
import { Trends } from '@/components/jurisintel/views/Trends';
import { NetworkGraph } from '@/components/jurisintel/views/NetworkGraph';
import { CrimeMap } from '@/components/jurisintel/views/CrimeMap';
import { SocioDemo } from '@/components/jurisintel/views/SocioDemo';
import { Financial } from '@/components/jurisintel/views/Financial';
import { Forecast } from '@/components/jurisintel/views/Forecast';
import { WantedList } from '@/components/jurisintel/views/WantedList';
import { Stations } from '@/components/jurisintel/views/Stations';
import { Search } from '@/components/jurisintel/views/Search';
import { Users } from '@/components/jurisintel/views/Users';
import { AuditLog } from '@/components/jurisintel/views/AuditLog';

type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; session: Session };

export default function Home() {
  const [authState, setAuthState] = useState<AuthState>({ status: 'loading' });
  const [currentView, setCurrentView] = useState<ViewId>('dashboard');

  useEffect(() => {
    const existing = getSession();
    // Restoring saved auth session on mount — client-only, runs once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      case 'chat': return <AIChat />;
      case 'trends': return <Trends />;
      case 'network': return <NetworkGraph />;
      case 'map': return <CrimeMap />;
      case 'sociodemo': return <SocioDemo />;
      case 'financial': return <Financial />;
      case 'forecast': return <Forecast />;
      case 'wanted': return <WantedList />;
      case 'stations': return <Stations />;
      case 'search': return <Search />;
      case 'users': return <Users />;
      case 'audit': return <AuditLog />;
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
