'use client';

import { type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: string;
  severity?: 'normal' | 'warning' | 'critical';
}

const severityBorder: Record<string, string> = {
  normal: 'border-border',
  warning: 'border-ops-amber/30',
  critical: 'border-ops-red/30',
};

const severityGlow: Record<string, string> = {
  normal: '',
  warning: 'hover:shadow-[0_0_16px_-4px_oklch(0.75_0.15_70/0.2)]',
  critical: 'hover:shadow-[0_0_16px_-4px_oklch(0.65_0.24_25/0.2)]',
};

export function StatCard({ label, value, icon, trend, severity = 'normal' }: StatCardProps) {
  const isPositive = trend?.startsWith('+');
  const isNegative = trend?.startsWith('-');

  return (
    <Card
      className={`ops-border transition-all duration-300 ${severityBorder[severity]} ${severityGlow[severity]}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="font-mono-label mb-1">{label}</p>
            <p className="text-2xl font-bold font-mono tracking-tight">{value}</p>
            {trend && (
              <div className="flex items-center gap-1 mt-1.5">
                {isPositive && <ArrowUp className="w-3 h-3 text-ops-emerald" />}
                {isNegative && <ArrowDown className="w-3 h-3 text-ops-red" />}
                {!isPositive && !isNegative && (
                  <span className="w-3 h-3" />
                )}
                <span
                  className={`font-mono text-xs ${
                    isPositive
                      ? 'text-ops-emerald'
                      : isNegative
                        ? 'text-ops-red'
                        : 'text-muted-foreground'
                  }`}
                >
                  {trend}
                </span>
              </div>
            )}
          </div>
          {icon && (
            <div className="text-muted-foreground/60 ml-3 mt-1">{icon}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
