import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { Separator } from '../components/ui/separator';
import StatusBadge from '../components/StatusBadge';
import AudioPlayer from '../components/AudioPlayer';
import { toast } from 'sonner';
import {
  MapPin, Calendar, FileDown, FileText, RefreshCw, Loader2,
  Search, Edit3, Check, X
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function MeetingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [editingLocality, setEditingLocality] = useState(false);
  const [newLocality, setNewLocality] = useState('');
  const [transcriptSearch, setTranscriptSearch] = useState('');

  const fetchMeeting = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/meetings/${id}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      setMeeting(data);
    } catch (err) {
      console.error('Failed to fetch meeting:', err);
      toast.error('Ședința nu a fost găsită');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchMeeting();
  }, [fetchMeeting]);

  // Poll if processing
  useEffect(() => {
    if (!meeting || (meeting.status !== 'processing' && meeting.status !== 'uploading')) return;
    const interval = setInterval(fetchMeeting, 3000);
    return () => clearInterval(interval);
  }, [meeting, fetchMeeting]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/meetings/${id}/regenerate`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Regenerare pornită...');
      setMeeting(prev => ({ ...prev, status: 'processing' }));
    } catch (err) {
      toast.error('Eroare la regenerare');
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = (format) => {
    const url = `${BACKEND_URL}/api/meetings/${id}/export/${format}`;
    window.open(url, '_blank');
  };

  const handleUpdateLocality = async () => {
    if (!newLocality.trim()) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/meetings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locality: newLocality.trim() })
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setMeeting(data);
      setEditingLocality(false);
      toast.success('Localitate actualizată');
    } catch (err) {
      toast.error('Eroare la actualizare');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('ro-RO', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const highlightText = (text, query) => {
    if (!query || !text) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-[hsl(var(--gal-warning))]/30 rounded px-0.5">{part}</mark>
      ) : part
    );
  };

  if (loading) {
    return (
      <div className="px-4 py-4 space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-muted-foreground">Ședința nu a fost găsită.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/browse')}>
          Înapoi la listă
        </Button>
      </div>
    );
  }

  const isProcessing = meeting.status === 'processing' || meeting.status === 'uploading';

  return (
    <div className="px-4 py-4 space-y-4 safe-bottom">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-xl font-bold font-semibold leading-tight">
            {meeting.title || 'Ședință fără titlu'}
          </h1>
          <StatusBadge status={meeting.status} />
        </div>

        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {editingLocality ? (
            <div className="flex items-center gap-1">
              <Input
                value={newLocality}
                onChange={(e) => setNewLocality(e.target.value)}
                placeholder="Localitate..."
                className="h-8 w-36 text-sm"
                autoFocus
              />
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleUpdateLocality}>
                <Check className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingLocality(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Badge
              variant="secondary"
              className="gap-1 cursor-pointer hover:bg-secondary/80"
              onClick={() => {
                setNewLocality(meeting.locality || '');
                setEditingLocality(true);
              }}
              data-testid="meeting-locality-badge"
            >
              <MapPin className="h-3 w-3" />
              {meeting.locality || 'Necunoscut'}
              <Edit3 className="h-3 w-3 ml-1 opacity-50" />
            </Badge>
          )}

          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(meeting.date || meeting.created_at)}
          </span>
        </div>

        {meeting.error && (
          <div className="mt-2 p-3 rounded-xl bg-[hsl(var(--gal-danger))]/10 text-[hsl(var(--gal-danger))] text-sm">
            Eroare: {meeting.error}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-10 rounded-xl gap-1.5 flex-1"
          onClick={() => handleExport('pdf')}
          disabled={meeting.status !== 'done'}
          data-testid="meeting-export-pdf-button"
        >
          <FileDown className="h-4 w-4" />
          PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-10 rounded-xl gap-1.5 flex-1"
          onClick={() => handleExport('docx')}
          disabled={meeting.status !== 'done'}
          data-testid="meeting-export-docx-button"
        >
          <FileText className="h-4 w-4" />
          DOCX
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-10 rounded-xl gap-1.5"
          onClick={handleRegenerate}
          disabled={isProcessing || regenerating}
          data-testid="meeting-regenerate-button"
        >
          {regenerating || isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Regenerează
        </Button>
      </div>

      {/* Processing indicator */}
      {isProcessing && (
        <Card className="p-6 rounded-2xl text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-3" />
          <p className="font-medium">Se procesează...</p>
          <p className="text-sm text-muted-foreground mt-1">Transcriere și analiză AI în curs</p>
        </Card>
      )}

      {/* GAL Report Structure - Replace Tabs */}
      {meeting.status === 'done' && (
        <div className="space-y-3">
          {/* Data desfășurare */}
          {meeting.data_desfasurare && (
            <Card className="p-4 rounded-2xl">
              <h3 className="font-semibold text-xs uppercase text-muted-foreground mb-2">Data desfășurare</h3>
              <p className="text-sm">{meeting.data_desfasurare}</p>
            </Card>
          )}

          {/* Format întâlnire */}
          {meeting.format_intalnire && (
            <Card className="p-4 rounded-2xl">
              <h3 className="font-semibold text-xs uppercase text-muted-foreground mb-2">Format întâlnire</h3>
              <p className="text-sm">{meeting.format_intalnire}</p>
            </Card>
          )}

          {/* Loc desfășurare */}
          {meeting.loc_desfasurare && (
            <Card className="p-4 rounded-2xl">
              <h3 className="font-semibold text-xs uppercase text-muted-foreground mb-2">Loc desfășurare</h3>
              <p className="text-sm">{meeting.loc_desfasurare}</p>
            </Card>
          )}

          {/* Mod promovare */}
          {meeting.mod_promovare && (
            <Card className="p-4 rounded-2xl">
              <h3 className="font-semibold text-xs uppercase text-muted-foreground mb-2">Mod promovare</h3>
              <p className="text-sm">{meeting.mod_promovare}</p>
            </Card>
          )}

          {/* Obiectiv */}
          {meeting.obiectiv && (
            <Card className="p-4 rounded-2xl">
              <h3 className="font-semibold text-xs uppercase text-muted-foreground mb-2">Obiectiv</h3>
              <p className="text-sm leading-relaxed">{meeting.obiectiv}</p>
            </Card>
          )}

          {/* Tematica */}
          {meeting.tematica && (
            <Card className="p-4 rounded-2xl">
              <h3 className="font-semibold text-xs uppercase text-muted-foreground mb-2">Tematica</h3>
              <p className="text-sm leading-relaxed">{meeting.tematica}</p>
            </Card>
          )}

          {/* Scurtă descriere */}
          {meeting.scurta_descriere && (
            <Card className="p-4 rounded-2xl">
              <h3 className="font-semibold text-xs uppercase text-muted-foreground mb-2">Scurtă descriere</h3>
              <p className="text-sm leading-relaxed">{meeting.scurta_descriere}</p>
            </Card>
          )}

          {/* Număr participanți */}
          {meeting.numar_participanti && (
            <Card className="p-4 rounded-2xl">
              <h3 className="font-semibold text-xs uppercase text-muted-foreground mb-2">Număr participanți</h3>
              <p className="text-sm">{meeting.numar_participanti}</p>
            </Card>
          )}

          {/* Concluzia */}
          {meeting.concluzia && (
            <Card className="p-4 rounded-2xl">
              <h3 className="font-semibold text-xs uppercase text-muted-foreground mb-2">Concluzia</h3>
              <p className="text-sm leading-relaxed">{meeting.concluzia}</p>
            </Card>
          )}

          {/* Transcriere - Always show if available */}
          {meeting.transcript && (
            <Card className="p-4 rounded-2xl mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Transcriere completă</h3>
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Caută în transcriere..."
                  value={transcriptSearch}
                  onChange={(e) => setTranscriptSearch(e.target.value)}
                  className="pl-10 h-10 rounded-xl"
                  data-testid="transcript-search-input"
                />
              </div>
              <Separator className="mb-3" />
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {highlightText(meeting.transcript, transcriptSearch)}
              </p>
            </Card>
          )}
        </div>
      )}

      {/* Audio Player */}
      {meeting.audio_url && (
        <AudioPlayer audioUrl={`${BACKEND_URL}${meeting.audio_url}`} />
      )}
    </div>
  );
}
