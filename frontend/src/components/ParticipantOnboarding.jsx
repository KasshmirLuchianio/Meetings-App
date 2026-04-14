import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import {
  Mic, Square, Trash2, UserPlus, ChevronRight,
  CheckCircle2, Loader2, Users, Info,
} from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// ── Single participant recorder ──────────────────────────────────────────────

function ParticipantRecorder({ participant, index, onRecorded, onRemove }) {
  const [recording, setRecording]   = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [recorded, setRecorded]     = useState(!!participant.uploaded);
  const [duration, setDuration]     = useState(0);
  const [levels, setLevels]         = useState(new Array(20).fill(0));

  const mediaRecRef   = useRef(null);
  const chunksRef     = useRef([]);
  const timerRef      = useRef(null);
  const animFrameRef  = useRef(null);
  const analyserRef   = useRef(null);
  const streamRef     = useRef(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  const updateWave = useCallback(() => {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    const step = Math.floor(data.length / 20);
    setLevels(Array.from({ length: 20 }, (_, i) => data[i * step] / 255));
    animFrameRef.current = requestAnimationFrame(updateWave);
  }, []);

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx      = new (window.AudioContext || window.webkitAudioContext)();
      const src      = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      src.connect(analyser);
      analyserRef.current = analyser;

      const mimes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      const mime  = mimes.find(m => MediaRecorder.isTypeSupported(m)) || '';
      const rec   = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
      mediaRecRef.current = rec;
      chunksRef.current   = [];
      rec.ondataavailable = e => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        cancelAnimationFrame(animFrameRef.current);
        setLevels(new Array(20).fill(0));
        const blob = new Blob(chunksRef.current, { type: mime || 'audio/webm' });
        handleUpload(blob, mime);
      };
      rec.start(200);
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      updateWave();
    } catch {
      toast.error('Nu s-a putut accesa microfonul.');
    }
  };

  const stopRec = () => {
    mediaRecRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    clearInterval(timerRef.current);
    setRecording(false);
  };

  const handleUpload = async (blob, mime) => {
    if (!participant.meetingId) return;
    setUploading(true);
    try {
      const ext  = mime?.includes('mp4') ? 'mp4' : 'webm';
      const form = new FormData();
      form.append('file', blob, `sample.${ext}`);
      if (participant.name) form.append('name', participant.name);
      if (participant.role) form.append('role', participant.role);

      const res = await fetch(
        `${BACKEND_URL}/api/meetings/${participant.meetingId}/speakers/onboard`,
        { method: 'POST', body: form },
      );
      if (!res.ok) throw new Error('Upload eșuat');
      const data = await res.json();
      setRecorded(true);
      onRecorded(index, data.participant_id);
      toast.success(`Eșantion vocal salvat pentru ${participant.name || 'participant'}`);
    } catch {
      toast.error('Nu s-a putut încărca eșantionul vocal.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border p-3 space-y-2 bg-card">
      <div className="flex items-center gap-2">
        <div
          className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
            recorded
              ? 'bg-[hsl(var(--gal-success))]/15 text-[hsl(var(--gal-success))]'
              : 'bg-primary/10 text-primary'
          }`}
        >
          {recorded ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
        </div>
        <span className="font-medium text-sm truncate flex-1">
          {participant.name || `Participant ${index + 1}`}
        </span>
        {participant.role && (
          <Badge variant="secondary" className="text-xs shrink-0">
            {participant.role}
          </Badge>
        )}
        {!recorded && !recording && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-[hsl(var(--gal-danger))]"
            onClick={() => onRemove(index)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Waveform (only during recording) */}
      {recording && (
        <div className="flex items-center gap-[2px] h-8 px-1">
          {levels.map((lvl, i) => (
            <div
              key={i}
              className="flex-1 rounded-full transition-all duration-75 bg-[hsl(var(--gal-danger))]"
              style={{ height: `${Math.max(15, lvl * 100)}%` }}
            />
          ))}
        </div>
      )}

      {/* Controls */}
      {!recorded ? (
        <Button
          size="sm"
          variant={recording ? 'destructive' : 'outline'}
          className="w-full h-9 rounded-lg gap-2 text-xs"
          onClick={recording ? stopRec : startRec}
          disabled={uploading}
        >
          {uploading ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Se încarcă...</>
          ) : recording ? (
            <><Square className="h-3.5 w-3.5" /> Oprește ({duration}s)</>
          ) : (
            <><Mic className="h-3.5 w-3.5" /> Înregistrează eșantion</>
          )}
        </Button>
      ) : (
        <p className="text-xs text-[hsl(var(--gal-success))] flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" /> Eșantion înregistrat
        </p>
      )}
    </div>
  );
}

// ── Add participant form ──────────────────────────────────────────────────────

function AddParticipantForm({ onAdd }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');

  const submit = () => {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), role: role.trim() });
    setName('');
    setRole('');
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="Numele complet"
          value={name}
          onChange={e => setName(e.target.value)}
          className="h-10 rounded-xl text-sm flex-1"
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
        <Input
          placeholder="Funcția (ex: Secretar)"
          value={role}
          onChange={e => setRole(e.target.value)}
          className="h-10 rounded-xl text-sm flex-1"
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full h-9 rounded-xl gap-2 text-sm border-primary/20 text-primary"
        onClick={submit}
        disabled={!name.trim()}
      >
        <UserPlus className="h-4 w-4" />
        Adaugă participant
      </Button>
    </div>
  );
}

// ── Main dialog ───────────────────────────────────────────────────────────────

export default function ParticipantOnboarding({ open, onClose, meetingId, onComplete }) {
  const [step, setStep] = useState('instructions');  // 'instructions' | 'record' | 'done'
  const [participants, setParticipants] = useState([]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep('instructions');
      setParticipants([]);
    }
  }, [open]);

  const addParticipant = useCallback(({ name, role }) => {
    setParticipants(prev => [...prev, { name, role, meetingId, uploaded: false, participantId: null }]);
  }, [meetingId]);

  const removeParticipant = useCallback(index => {
    setParticipants(prev => prev.filter((_, i) => i !== index));
  }, []);

  const onRecorded = useCallback((index, participantId) => {
    setParticipants(prev =>
      prev.map((p, i) => i === index ? { ...p, uploaded: true, participantId } : p),
    );
  }, []);

  const allRecorded = participants.length > 0 && participants.every(p => p.uploaded);
  const anyRecorded = participants.some(p => p.uploaded);

  const handleFinish = () => {
    onComplete(participants.filter(p => p.uploaded));
    onClose();
  };

  const handleSkip = () => {
    onComplete([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto rounded-2xl p-0 overflow-hidden">

        {/* ── Step: instructions ─────────────────────────────────────────── */}
        {step === 'instructions' && (
          <>
            <DialogHeader className="px-6 pt-6 pb-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <DialogTitle className="text-lg font-semibold">
                Identificare vorbitori
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed mt-1">
                Fiecare participant trebuie să se prezinte cu numele și funcția
                pentru a putea fi identificat în transcriere.
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 pb-2">
              <div className="rounded-xl bg-primary/5 border border-primary/10 p-3 flex gap-3">
                <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Fiecare participant va înregistra un eșantion vocal de <strong>5–10 secunde</strong>.
                  Vă rugăm să spuneți:{' '}
                  <em className="text-foreground">
                    „Numele meu este [Prenume Nume] și sunt [funcția]."
                  </em>
                </p>
              </div>
            </div>

            <DialogFooter className="px-6 py-4 flex-col gap-2">
              <Button
                className="w-full h-12 rounded-xl gap-2"
                onClick={() => setStep('record')}
              >
                Continuă
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                className="w-full h-10 rounded-xl text-muted-foreground text-sm"
                onClick={handleSkip}
              >
                Sari peste (fără identificare)
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Step: record ───────────────────────────────────────────────── */}
        {step === 'record' && (
          <>
            <DialogHeader className="px-6 pt-6 pb-3">
              <DialogTitle className="text-lg font-semibold">
                Prezentare participanți
              </DialogTitle>
              <DialogDescription className="text-sm">
                Adăugați fiecare participant și înregistrați eșantionul vocal.
              </DialogDescription>
            </DialogHeader>

            <Separator />

            <div className="px-4 py-3 space-y-2 max-h-[50vh] overflow-y-auto">
              {participants.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Niciun participant adăugat încă.
                </p>
              )}
              {participants.map((p, i) => (
                <ParticipantRecorder
                  key={i}
                  participant={p}
                  index={i}
                  onRecorded={onRecorded}
                  onRemove={removeParticipant}
                />
              ))}
            </div>

            <div className="px-4 pb-3">
              <AddParticipantForm onAdd={addParticipant} />
            </div>

            <Separator />

            <div className="px-4 py-3 flex gap-2">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl text-sm"
                onClick={handleSkip}
              >
                Sari peste
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl text-sm gap-2"
                onClick={handleFinish}
                disabled={!anyRecorded && participants.length > 0}
              >
                {allRecorded ? (
                  <><CheckCircle2 className="h-4 w-4" /> Finalizează</>
                ) : (
                  <>Continuă fără toți</>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
