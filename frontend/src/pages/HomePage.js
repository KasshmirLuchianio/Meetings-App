import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import RecorderCard from '../components/RecorderCard';
import MeetingCard from '../components/MeetingCard';
import { Skeleton } from '../components/ui/skeleton';
import { FileAudio, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function HomePage({ backendUrl, onMeetingCreated }) {
  const [recentMeetings, setRecentMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pollingIds, setPollingIds] = useState([]);
  const navigate = useNavigate();

  const fetchRecentMeetings = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl}/api/meetings?limit=5`);
      const data = await res.json();
      setRecentMeetings(data.meetings || []);
      
      // Find meetings that need polling
      const processing = (data.meetings || []).filter(
        m => m.status === 'processing' || m.status === 'uploading' || m.status === 'pending'
      ).map(m => m._id);
      setPollingIds(processing);
    } catch (err) {
      console.error('Failed to fetch meetings:', err);
    } finally {
      setLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    fetchRecentMeetings();
  }, [fetchRecentMeetings]);

  // Poll for processing meetings
  useEffect(() => {
    if (pollingIds.length === 0) return;
    
    const interval = setInterval(() => {
      fetchRecentMeetings();
    }, 3000);
    
    return () => clearInterval(interval);
  }, [pollingIds, fetchRecentMeetings]);

  const handleRecordingComplete = (meetingId) => {
    // Add to polling list and refresh
    setPollingIds(prev => [...prev, meetingId]);
    fetchRecentMeetings();
    if (onMeetingCreated) onMeetingCreated();
  };

  return (
    <div className="px-4 py-4 space-y-6 safe-bottom">
      {/* Recorder */}
      <RecorderCard
        backendUrl={backendUrl}
        onRecordingComplete={handleRecordingComplete}
      />

      {/* Recent Meetings */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold font-['Space_Grotesk']">
            Întâlniri recente
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/browse')}
            className="text-xs text-primary gap-1"
            data-testid="view-all-meetings-button"
          >
            Vezi toate
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : recentMeetings.length === 0 ? (
          <div className="text-center py-12">
            <FileAudio className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">
              Nicio întâlnire încă.
            </p>
            <p className="text-muted-foreground/70 text-xs mt-1">
              Apăsați butonul de înregistrare pentru a începe.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentMeetings.map((meeting) => (
              <MeetingCard
                key={meeting._id}
                meeting={meeting}
                onDeleted={(id) => {
                  setRecentMeetings(prev => prev.filter(m => m._id !== id));
                  if (onMeetingCreated) onMeetingCreated();
                }}
                onUpdated={(updated) => {
                  setRecentMeetings(prev => prev.map(m => m._id === updated._id ? updated : m));
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
