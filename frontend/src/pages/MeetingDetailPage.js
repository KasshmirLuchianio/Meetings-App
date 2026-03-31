import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { Separator } from '../components/ui/separator';
import StatusBadge from '../components/StatusBadge';
import AudioPlayer from '../components/AudioPlayer';
import { toast } from 'sonner';
import {
  MapPin, Calendar, FileDown, FileText, RefreshCw, Loader2,
  Search, User, Clock, CheckCircle2, Circle, Edit3, Check, X
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

  const toggleAction = async (actionId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/meetings/${id}/actions/${actionId}`, {
        method: 'PATCH'
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setMeeting(data);
    } catch (err) {
      toast.error('Eroare la actualizarea acțiunii');
    }
  };

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

      {/* Tabs: Rezumat / Acțiuni / Transcriere */}
      {meeting.status === 'done' && (
        <Tabs defaultValue="summary" className="w-full" data-testid="meeting-detail-tabs">
          <TabsList className="w-full grid grid-cols-3 h-12 rounded-xl">
            <TabsTrigger value="summary" className="rounded-lg text-sm">Rezumat</TabsTrigger>
            <TabsTrigger value="actions" className="rounded-lg text-sm">Acțiuni</TabsTrigger>
            <TabsTrigger value="transcript" className="rounded-lg text-sm">Transcriere</TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary" className="mt-4 space-y-4">
            {meeting.summary && meeting.summary.length > 0 && (
              <Card className="p-4 rounded-2xl">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Rezumat
                </h3>
                <ul className="space-y-2">
                  {meeting.summary.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-primary mt-0.5 shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {meeting.key_points && meeting.key_points.length > 0 && (
              <Card className="p-4 rounded-2xl">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2 font-semibold">
                  <Circle className="h-4 w-4 text-[hsl(var(--gal-warning))]" />
                  Puncte cheie
                </h3>
                <ul className="space-y-2">
                  {meeting.key_points.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-[hsl(var(--gal-warning))] mt-0.5 shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </TabsContent>

          {/* Actions Tab */}
          <TabsContent value="actions" className="mt-4">
            <Card className="p-4 rounded-2xl" data-testid="meeting-action-items-list">
              <h3 className="font-semibold text-sm mb-3 font-semibold">
                Acțiuni ({meeting.actions?.length || 0})
              </h3>
              {meeting.actions && meeting.actions.length > 0 ? (
                <div className="space-y-3">
                  {meeting.actions.map((action) => (
                    <div
                      key={action.id}
                      className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${
                        action.completed ? 'bg-[hsl(var(--gal-success))]/5' : 'bg-secondary/30'
                      }`}
                    >
                      <Checkbox
                        checked={action.completed}
                        onCheckedChange={() => toggleAction(action.id)}
                        className="mt-0.5 h-5 w-5"
                        data-testid={`action-checkbox-${action.id}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${action.completed ? 'line-through text-muted-foreground' : ''}`}>
                          {action.text}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          {action.owner && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {action.owner}
                            </span>
                          )}
                          {action.deadline && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {action.deadline}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nicio acțiune identificată.</p>
              )}
            </Card>
          </TabsContent>

          {/* Transcript Tab */}
          <TabsContent value="transcript" className="mt-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Caută în transcriere..."
                value={transcriptSearch}
                onChange={(e) => setTranscriptSearch(e.target.value)}
                className="pl-10 h-10 rounded-xl"
                data-testid="transcript-search-input"
              />
            </div>
            <Card className="p-4 rounded-2xl">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {meeting.transcript 
                  ? highlightText(meeting.transcript, transcriptSearch)
                  : 'Transcrierea nu este disponibilă.'
                }
              </p>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Audio Player */}
      {meeting.audio_url && (
        <AudioPlayer audioUrl={`${BACKEND_URL}${meeting.audio_url}`} />
      )}
    </div>
  );
}
