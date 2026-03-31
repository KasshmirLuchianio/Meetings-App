import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import MeetingCard from '../components/MeetingCard';
import { Calendar } from '../components/ui/calendar';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Separator } from '../components/ui/separator';
import { FileAudio, CalendarDays, Mic, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { AnimatedList, AnimatedItem, FadeIn } from '../components/AnimatedList';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [meetingDates, setMeetingDates] = useState({});
  const [dayMeetings, setDayMeetings] = useState([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [pollingIds, setPollingIds] = useState([]);
  const navigate = useNavigate();

  // Fetch meeting dates for the visible month (for calendar dots)
  const fetchMeetingDates = useCallback(async (date) => {
    try {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const res = await fetch(`${BACKEND_URL}/api/meetings/calendar-dates?year=${year}&month=${month}`);
      const data = await res.json();
      setMeetingDates(data.dates || {});
    } catch (err) {
      console.error('Failed to fetch meeting dates:', err);
    }
  }, []);

  // Fetch meetings for selected date
  const fetchDayMeetings = useCallback(async (date) => {
    setLoadingMeetings(true);
    try {
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const res = await fetch(`${BACKEND_URL}/api/meetings/calendar-by-date?date=${dateStr}`);
      const data = await res.json();
      setDayMeetings(data.meetings || []);

      const processing = (data.meetings || []).filter(
        m => m.status === 'processing' || m.status === 'uploading' || m.status === 'pending'
      ).map(m => m._id);
      setPollingIds(processing);
    } catch (err) {
      console.error('Failed to fetch day meetings:', err);
    } finally {
      setLoadingMeetings(false);
    }
  }, []);

  // Load dates when month changes
  useEffect(() => {
    fetchMeetingDates(currentMonth);
  }, [currentMonth, fetchMeetingDates]);

  // Load meetings when selected date changes
  useEffect(() => {
    if (selectedDate) {
      fetchDayMeetings(selectedDate);
    }
  }, [selectedDate, fetchDayMeetings]);

  // Poll for processing meetings
  useEffect(() => {
    if (pollingIds.length === 0) return;
    const interval = setInterval(() => {
      if (selectedDate) fetchDayMeetings(selectedDate);
    }, 3000);
    return () => clearInterval(interval);
  }, [pollingIds, selectedDate, fetchDayMeetings]);

  // Compute which days have meetings for calendar modifiers
  const daysWithMeetings = useMemo(() => {
    return Object.keys(meetingDates).map(dateStr => {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d);
    });
  }, [meetingDates]);

  const formatSelectedDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('ro-RO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const selectedDateStr = selectedDate
    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
    : '';
  const selectedCount = meetingDates[selectedDateStr] || dayMeetings.length;

  return (
    <div className="px-4 py-4 space-y-4 safe-bottom">
      {/* Back to recordings button */}
      <FadeIn delay={0}>
        <Button
          variant="outline"
          onClick={() => navigate('/')}
          className="w-full h-12 rounded-xl gap-2 text-sm font-medium border-primary/20 text-primary hover:bg-primary/5 active:scale-[0.98] transition-transform"
          data-testid="calendar-back-to-record"
        >
          <Mic className="h-4 w-4" />
          Înapoi la înregistrări
        </Button>
      </FadeIn>

      {/* Calendar Card */}
      <FadeIn delay={0.05}>
      <Card className="rounded-2xl shadow-[0_6px_18px_hsl(var(--gal-shadow))] overflow-hidden" data-testid="meetings-calendar">
        <div className="px-4 pt-4 pb-2 flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold font-['Space_Grotesk']">
            Calendar rapoarte
          </h2>
        </div>

        <div className="px-2">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && setSelectedDate(date)}
            onMonthChange={setCurrentMonth}
            modifiers={{
              hasMeetings: daysWithMeetings,
            }}
            modifiersClassNames={{
              hasMeetings: 'has-meetings-dot',
            }}
            className="w-full"
            locale={{
              localize: {
                day: (n) => ['Du', 'Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ'][n],
                month: (n) => ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'][n],
                ordinalNumber: (n) => `${n}`,
                era: (n) => n,
                quarter: (n) => n,
                dayPeriod: (n) => n
              },
              formatLong: {
                date: () => 'dd/MM/yyyy',
                time: () => 'HH:mm',
                dateTime: () => 'dd/MM/yyyy HH:mm'
              },
              match: {},
              options: { weekStartsOn: 1 }
            }}
          />
        </div>

        {/* Selected date info */}
        <div className="px-4 pb-4">
          <Separator className="mb-3" />
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground capitalize">
              {formatSelectedDate(selectedDate)}
            </p>
            {selectedCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {selectedCount} {selectedCount === 1 ? 'raport' : 'rapoarte'}
              </Badge>
            )}
          </div>
        </div>
      </Card>
      </FadeIn>

      {/* Meetings for selected date */}
      <FadeIn delay={0.1}>
      <div>
        <h2 className="text-base font-semibold font-['Space_Grotesk'] mb-3">
          Rapoarte — {selectedDate ? selectedDate.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' }) : 'azi'}
        </h2>

        {loadingMeetings ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : dayMeetings.length === 0 ? (
          <div className="text-center py-10">
            <FileAudio className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-muted-foreground text-sm">
              Niciun raport în această zi.
            </p>
            <p className="text-muted-foreground/60 text-xs mt-1">
              Selectați altă dată din calendar.
            </p>
          </div>
        ) : (
          <AnimatedList className="space-y-3">
            {dayMeetings.map((meeting) => (
              <AnimatedItem key={meeting._id}>
                <MeetingCard
                  meeting={meeting}
                  onDeleted={(id) => {
                    setDayMeetings(prev => prev.filter(m => m._id !== id));
                    fetchMeetingDates(currentMonth);
                  }}
                  onUpdated={(updated) => {
                    setDayMeetings(prev => prev.map(m => m._id === updated._id ? updated : m));
                  }}
                />
              </AnimatedItem>
            ))}
          </AnimatedList>
        )}
      </div>
      </FadeIn>
    </div>
  );
}
