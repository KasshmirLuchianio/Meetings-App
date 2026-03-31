import React from 'react';
import { Badge } from './ui/badge';
import { Loader2, Check, AlertCircle, Clock, Upload } from 'lucide-react';

const statusConfig = {
  pending: {
    label: 'În așteptare',
    classes: 'bg-secondary text-secondary-foreground border',
    icon: Clock,
  },
  uploading: {
    label: 'Se încarcă',
    classes: 'bg-[hsl(var(--gal-info))]/10 text-[hsl(var(--gal-info))] border border-[hsl(var(--gal-info))]/20',
    icon: Upload,
  },
  processing: {
    label: 'Se procesează',
    classes: 'bg-[hsl(var(--gal-info))]/10 text-[hsl(var(--gal-info))] border border-[hsl(var(--gal-info))]/20',
    icon: Loader2,
    animate: true,
  },
  done: {
    label: 'Gata',
    classes: 'bg-[hsl(var(--gal-success))]/10 text-[hsl(var(--gal-success))] border border-[hsl(var(--gal-success))]/20',
    icon: Check,
  },
  error: {
    label: 'Eroare',
    classes: 'bg-[hsl(var(--gal-danger))]/10 text-[hsl(var(--gal-danger))] border border-[hsl(var(--gal-danger))]/20',
    icon: AlertCircle,
  },
};

export default function StatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={`${config.classes} text-xs font-medium gap-1 px-2 py-0.5`}
      data-testid={`status-badge-${status}`}
    >
      <Icon className={`h-3 w-3 ${config.animate ? 'animate-spin' : ''}`} />
      {config.label}
    </Badge>
  );
}
