import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { Separator } from '../components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import StatusBadge from '../components/StatusBadge';
import AudioPlayer from '../components/AudioPlayer';
import { toast } from 'sonner';
import {
  MapPin, Calendar, FileDown, FileText, RefreshCw, Loader2,
  Search, Edit3, Check, X, Users, FileSignature, Scroll,
  ChevronDown, ChevronUp, Clock,
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function MeetingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting]               = useState(null);
  const [loading, setLoading]               = useState(true);
  const [regenerating, setRegenerating]     = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [editingLocality, setEditingLocality] = useState(false);
  const [newLocality, setNewLocality]       = useState('');
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [expandedSpeakers, setExpandedSpeakers] = useState({});

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

  useEffect(() => { fetchMeeting(); }, [fetchMeeting]);

  // Poll while processing or report is generating
  useEffect(() => {
    if (!meeting) return;
    const needsPoll =
      meeting.status === 'processing' ||
      meeting.status === 'uploading' ||
      meeting.report_status === 'generating';
    if (!needsPoll) return;
    const interval = setInterval(fetchMeeting, 3000);
    return () => clearInterval(interval);
  }, [meeting, fetchMeeting]);

  // Sync report generation state with server
  useEffect(() => {
    if (!meeting) return;
    if (meeting.report_status === 'done' || meeting.report_status === 'error') {
      setGeneratingReport(false);
    }
  }, [meeting]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/meetings/${id}/regenerate`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      toast.success('Regenerare pornită...');
      setMeeting(prev => ({ ...prev, status: 'processing' }));
    } catch {
      toast.error('Eroare la regenerare');
    } finally {
      setRegenerating(false);
    }
  };

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/meetings/${id}/generate-report`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Eroare');
      }
      toast.success('Se generează Procesul Verbal...');
      setMeeting(prev => ({ ...prev, report_status: 'generating' }));
    } catch (err) {
      toast.error(err.message);
      setGeneratingReport(false);
    }
  };

  const handleExport = (format) => {
    window.open(`${BACKEND_URL}/api/meetings/${id}/export/${format}`, '_blank');
  };

  const handleUpdateLocality = async () => {
    if (!newLocality.trim()) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/meetings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locality: newLocality.trim() }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setMeeting(data);
      setEditingLocality(false);
      toast.success('Localitate actualizată');
    } catch {
      toast.error('Eroare la actualizare');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('ro-RO', {
        weekday: 'long', day: '2-digit', month: 'long',
        year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch { return dateStr; }
  };

  const highlightText = (text, query) => {
    if (!query || !text) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.split(regex).map((part, i) =>
      regex.test(part)
        ? <mark key={i} className="bg-[hsl(var(--gal-warning))]/30 rounded px-0.5">{part}</mark>
        : part,
    );
  };

  const toggleSpeaker = (key) =>
    setExpandedSpeakers(prev => ({ ...prev, [key]: !prev[key] }));

  // ── Loading ────────────────────────────────────────────────────────────────
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

  const isProcessing  = meeting.status === 'processing' || meeting.status === 'uploading';
  const isDone        = meeting.status === 'done';
  const hasReport     = !!meeting.proces_verbal;
  const reportPending = meeting.report_status === 'generating' || generatingReport;
  const diarized      = meeting.diarized_segments || [];
  const hasDiarized   = diarized.length > 0;

  // Group diarized segments by speaker for summary view
  const speakerGroups = diarized.reduce((acc, seg) => {
    const spk = seg.speaker || 'Vorbitor necunoscut';
    if (!acc[spk]) acc[spk] = { role: seg.role || '', segments: [] };
    acc[spk].segments.push(seg);
    return acc;
  }, {});

  return (
    <div className="px-4 py-4 space-y-4 safe-bottom">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-xl font-bold leading-tight">
            {meeting.title || 'Ședință fără titlu'}
          </h1>
          <StatusBadge status={meeting.status} />
        </div>

        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {editingLocality ? (
            <div className="flex items-center gap-1">
              <Input
                value={newLocality}
                onChange={e => setNewLocality(e.target.value)}
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
              onClick={() => { setNewLocality(meeting.locality || ''); setEditingLocality(true); }}
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

      {/* ── Action buttons ──────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="outline" size="sm"
          className="h-10 rounded-xl gap-1.5 flex-1"
          onClick={() => handleExport('pdf')}
          disabled={!isDone}
          data-testid="meeting-export-pdf-button"
        >
          <FileDown className="h-4 w-4" /> PDF
        </Button>
        <Button
          variant="outline" size="sm"
          className="h-10 rounded-xl gap-1.5 flex-1"
          onClick={() => handleExport('docx')}
          disabled={!isDone}
          data-testid="meeting-export-docx-button"
        >
          <FileText className="h-4 w-4" /> DOCX
        </Button>
        <Button
          variant="outline" size="sm"
          className="h-10 rounded-xl gap-1.5"
          onClick={handleRegenerate}
          disabled={isProcessing || regenerating}
          data-testid="meeting-regenerate-button"
        >
          {regenerating || isProcessing
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <RefreshCw className="h-4 w-4" />}
          Regenerează
        </Button>
      </div>

      {/* ── Proces Verbal button ────────────────────────────────────────────── */}
      {isDone && (
        <div className="space-y-2">
          {!hasReport && !reportPending && (
            <Button
              className="w-full h-12 rounded-xl gap-2 font-semibold"
              onClick={handleGenerateReport}
            >
              <Scroll className="h-5 w-5" />
              Generează Proces Verbal
            </Button>
          )}

          {reportPending && (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card">
              <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">Se generează Procesul Verbal...</p>
                <p className="text-xs text-muted-foreground">AI structurează transcriera</p>
              </div>
            </div>
          )}

          {hasReport && !reportPending && (
            <div className="flex gap-2">
              <Button
                variant="outline" size="sm"
                className="h-10 rounded-xl gap-1.5 flex-1 border-primary/20 text-primary"
                onClick={() => handleExport('proces-verbal/docx')}
              >
                <FileSignature className="h-4 w-4" /> Proces Verbal DOCX
              </Button>
              <Button
                variant="outline" size="sm"
                className="h-10 rounded-xl gap-1.5 flex-1 border-primary/20 text-primary"
                onClick={() => handleExport('proces-verbal/pdf')}
              >
                <FileDown className="h-4 w-4" /> Proces Verbal PDF
              </Button>
            </div>
          )}

          {meeting.report_status === 'error' && (
            <div className="p-3 rounded-xl bg-[hsl(var(--gal-danger))]/10 text-[hsl(var(--gal-danger))] text-sm flex items-center gap-2">
              <X className="h-4 w-4 shrink-0" />
              Eroare raport: {meeting.report_error || 'Necunoscută'}
              <Button
                variant="ghost" size="sm" className="ml-auto h-7 text-xs"
                onClick={handleGenerateReport}
              >
                Reîncearcă
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Processing indicator ────────────────────────────────────────────── */}
      {isProcessing && (
        <Card className="p-6 rounded-2xl text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-3" />
          <p className="font-medium">Se procesează...</p>
          <p className="text-sm text-muted-foreground mt-1">Transcriere și analiză AI în curs</p>
        </Card>
      )}

      {/* ── Content tabs ────────────────────────────────────────────────────── */}
      {isDone && (
        <Tabs defaultValue={hasReport ? 'report' : hasDiarized ? 'speakers' : 'fields'} className="w-full">
          <TabsList className={`w-full grid h-11 rounded-xl mb-3 ${hasReport || hasDiarized ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {(hasReport || hasDiarized) && (
              <TabsTrigger value="report" className="rounded-lg text-xs gap-1">
                <Scroll className="h-3.5 w-3.5" /> Raport
              </TabsTrigger>
            )}
            <TabsTrigger value="fields" className="rounded-lg text-xs gap-1">
              <FileText className="h-3.5 w-3.5" /> Date
            </TabsTrigger>
            <TabsTrigger value="transcript" className="rounded-lg text-xs gap-1">
              <FileDown className="h-3.5 w-3.5" /> Transcriere
            </TabsTrigger>
          </TabsList>

          {/* ── Report / Proces Verbal tab ─────────────────────────────────── */}
          {(hasReport || hasDiarized) && (
            <TabsContent value="report" className="mt-0 space-y-3">

              {/* Participants */}
              {hasDiarized && (
                <Card className="p-4 rounded-2xl">
                  <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                    <Users className="h-4 w-4 text-primary" />
                    Participanți identificați
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(speakerGroups).map(([speaker, data]) => {
                      const key = speaker;
                      const expanded = expandedSpeakers[key];
                      const segCount = data.segments.length;
                      return (
                        <div key={key} className="rounded-xl border border-border overflow-hidden">
                          <button
                            className="w-full flex items-center justify-between p-3 hover:bg-secondary/30 transition-colors"
                            onClick={() => toggleSpeaker(key)}
                          >
                            <div className="flex items-center gap-2 text-left">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                                {speaker.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{speaker}</p>
                                {data.role && (
                                  <p className="text-xs text-muted-foreground">{data.role}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">{segCount} intervenții</Badge>
                              {expanded
                                ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            </div>
                          </button>
                          {expanded && (
                            <div className="border-t border-border divide-y divide-border">
                              {data.segments.map((seg, i) => (
                                <div key={i} className="px-3 py-2">
                                  <div className="flex items-center gap-1 mb-1">
                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground font-mono">
                                      {seg.timestamp}
                                    </span>
                                  </div>
                                  <p className="text-sm leading-relaxed">{seg.text}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* Structured Proces Verbal sections */}
              {hasReport && (() => {
                const pv = meeting.proces_verbal;
                return (
                  <div className="space-y-3">
                    {/* Ordinea de zi */}
                    {pv.ordine_de_zi?.length > 0 && (
                      <Card className="p-4 rounded-2xl">
                        <h3 className="font-semibold text-xs uppercase text-muted-foreground mb-2">
                          Ordinea de zi
                        </h3>
                        <ol className="space-y-1">
                          {pv.ordine_de_zi.map((item, i) => (
                            <li key={i} className="text-sm flex gap-2">
                              <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                              {item}
                            </li>
                          ))}
                        </ol>
                      </Card>
                    )}

                    {/* Dezbateri */}
                    {pv.dezbateri?.length > 0 && (
                      <Card className="p-4 rounded-2xl">
                        <h3 className="font-semibold text-xs uppercase text-muted-foreground mb-3">
                          Dezbateri
                        </h3>
                        <div className="space-y-4">
                          {pv.dezbateri.map((punct, pi) => (
                            <div key={pi}>
                              <p className="text-sm font-semibold mb-2">
                                {punct.punct ? `Punctul ${punct.punct}. ` : ''}{punct.titlu}
                              </p>
                              <div className="space-y-2 pl-3 border-l-2 border-primary/20">
                                {(punct.interventii || []).map((interv, ii) => (
                                  <div key={ii}>
                                    <p className="text-xs text-muted-foreground font-medium mb-0.5">
                                      {interv.speaker}
                                      {interv.functie ? ` (${interv.functie})` : ''}
                                      {interv.timestamp ? ` · ${interv.timestamp}` : ''}
                                    </p>
                                    <p className="text-sm leading-relaxed">{interv.continut}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    )}

                    {/* Hotărâri */}
                    {pv.hotarari?.length > 0 && (
                      <Card className="p-4 rounded-2xl">
                        <h3 className="font-semibold text-xs uppercase text-muted-foreground mb-2">
                          Hotărâri
                        </h3>
                        <ol className="space-y-2">
                          {pv.hotarari.map((h, i) => (
                            <li key={i} className="text-sm flex gap-2">
                              <span className="font-semibold text-primary shrink-0">{i + 1}.</span>
                              {h}
                            </li>
                          ))}
                        </ol>
                      </Card>
                    )}

                    {/* Observații */}
                    {pv.observatii && (
                      <Card className="p-4 rounded-2xl">
                        <h3 className="font-semibold text-xs uppercase text-muted-foreground mb-2">
                          Observații
                        </h3>
                        <p className="text-sm leading-relaxed">{pv.observatii}</p>
                      </Card>
                    )}
                  </div>
                );
              })()}

              {!hasReport && !hasDiarized && (
                <Card className="p-6 rounded-2xl text-center">
                  <Scroll className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Niciun raport generat. Apăsați „Generează Proces Verbal".
                  </p>
                </Card>
              )}
            </TabsContent>
          )}

          {/* ── GAL fields tab ─────────────────────────────────────────────── */}
          <TabsContent value="fields" className="mt-0 space-y-3">
            {[
              ['data_desfasurare', 'Data desfășurare'],
              ['format_intalnire', 'Format întâlnire'],
              ['loc_desfasurare', 'Loc desfășurare'],
              ['mod_promovare', 'Mod promovare'],
              ['obiectiv', 'Obiectiv'],
              ['tematica', 'Tematică'],
              ['scurta_descriere', 'Scurtă descriere'],
              ['numar_participanti', 'Număr participanți'],
              ['concluzia', 'Concluzia'],
            ].map(([field, label]) =>
              meeting[field] ? (
                <Card key={field} className="p-4 rounded-2xl">
                  <h3 className="font-semibold text-xs uppercase text-muted-foreground mb-2">{label}</h3>
                  <p className="text-sm leading-relaxed">{meeting[field]}</p>
                </Card>
              ) : null,
            )}
            {![
              'data_desfasurare','format_intalnire','loc_desfasurare','mod_promovare',
              'obiectiv','tematica','scurta_descriere','numar_participanti','concluzia',
            ].some(f => meeting[f]) && (
              <Card className="p-6 rounded-2xl text-center">
                <p className="text-sm text-muted-foreground">Nicio dată structurată disponibilă.</p>
              </Card>
            )}
          </TabsContent>

          {/* ── Transcript tab ─────────────────────────────────────────────── */}
          <TabsContent value="transcript" className="mt-0">
            {meeting.transcript ? (
              <Card className="p-4 rounded-2xl">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Caută în transcriere..."
                    value={transcriptSearch}
                    onChange={e => setTranscriptSearch(e.target.value)}
                    className="pl-10 h-10 rounded-xl"
                    data-testid="transcript-search-input"
                  />
                </div>
                <Separator className="mb-3" />
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {highlightText(meeting.transcript, transcriptSearch)}
                </p>
              </Card>
            ) : (
              <Card className="p-6 rounded-2xl text-center">
                <p className="text-sm text-muted-foreground">Nicio transcriere disponibilă.</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* ── Audio Player ────────────────────────────────────────────────────── */}
      {meeting.audio_url && (
        <AudioPlayer audioUrl={`${BACKEND_URL}${meeting.audio_url}`} />
      )}
    </div>
  );
}
