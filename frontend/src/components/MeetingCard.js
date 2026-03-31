import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import StatusBadge from './StatusBadge';
import { MapPin, Calendar, ChevronRight } from 'lucide-react';

export default function MeetingCard({ meeting }) {
  const navigate = useNavigate();

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('ro-RO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Card
      className="p-4 rounded-2xl shadow-[0_6px_18px_hsl(var(--gal-shadow))] cursor-pointer hover:shadow-[0_10px_30px_hsl(var(--gal-shadow))] active:scale-[0.98] transition-all duration-150"
      onClick={() => navigate(`/meeting/${meeting._id}`)}
      data-testid="meeting-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base truncate font-['Space_Grotesk']">
            {meeting.title || 'Ședință fără titlu'}
          </h3>
          <div className="flex items-center gap-2 mt-1.5">
            {meeting.locality && (
              <Badge variant="secondary" className="text-xs gap-1 shrink-0">
                <MapPin className="h-3 w-3" />
                {meeting.locality}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {formatDate(meeting.date || meeting.created_at)}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <StatusBadge status={meeting.status} />
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </Card>
  );
}
