'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DEMO_USERS, setSession, type Session } from '@/lib/auth';
import { Shield } from 'lucide-react';

interface LoginProps {
  onLogin: (session: Session) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('CREDENTIALS REQUIRED');
      return;
    }

    setLoading(true);

    // Simulate a brief network delay for authenticity
    await new Promise((r) => setTimeout(r, 600));

    const match = DEMO_USERS.find(
      (u) => u.username === username.trim() && u.password === password
    );

    if (!match) {
      setLoading(false);
      setError('ACCESS DENIED — INVALID CREDENTIALS');
      return;
    }

    const session: Session = {
      username: match.username,
      role: match.role,
      name: match.name,
    };

    setSession(session);
    onLogin(session);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle radial glow behind the form */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="ops-border rounded-lg p-8 bg-card/80 backdrop-blur-sm">
          {/* Logo + Wordmark */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-primary/10 border border-primary/20">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <div className="text-center">
              <h1 className="font-mono text-2xl font-bold tracking-widest text-primary">
                JURISINTEL
              </h1>
              <p className="font-mono-label mt-1">
                CRIME INTELLIGENCE PLATFORM
              </p>
            </div>
          </div>

          {/* Secure access header */}
          <div className="flex items-center gap-2 mb-6 px-1">
            <span className="pulse-dot emerald" />
            <span className="font-mono-label text-ops-emerald">
              SECURE ACCESS TERMINAL
            </span>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label
                htmlFor="ji-username"
                className="font-mono-label block mb-2"
              >
                OPERATOR ID
              </label>
              <Input
                id="ji-username"
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="username"
                className="font-mono bg-background border-border h-11"
                autoFocus
              />
            </div>

            <div>
              <label
                htmlFor="ji-password"
                className="font-mono-label block mb-2"
              >
                ACCESS CODE
              </label>
              <Input
                id="ji-password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="current-password"
                className="font-mono bg-background border-border h-11"
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="font-mono-label text-ops-red text-xs"
              >
                {error}
              </motion.p>
            )}

            <Button
              onClick={handleLogin}
              disabled={loading}
              className="w-full h-11 font-mono uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? 'AUTHENTICATING...' : 'AUTHENTICATE'}
            </Button>
          </div>

          {/* Demo credentials hint */}
          <div className="mt-6 pt-4 border-t border-border">
            <p className="font-mono-label text-center mb-2">
              DEMO CREDENTIALS
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono text-muted-foreground">
              <span>admin / ChangeMe@2026</span>
              <span>analyst1 / Analyst@2026</span>
              <span>inv1 / Inv@2026</span>
              <span>sup1 / Sup@2026</span>
            </div>
          </div>
        </div>

        {/* Bottom status bar */}
        <div className="mt-4 flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <span className="pulse-dot emerald" />
            <span className="font-mono-label text-ops-emerald text-[11px]">
              SYSTEM ONLINE
            </span>
          </div>
          <span className="font-mono-label text-[11px]">
            AES-256 // ENCRYPTED SESSION
          </span>
        </div>
      </motion.div>
    </div>
  );
}
