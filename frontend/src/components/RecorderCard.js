import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Mic, Square, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function RecorderCard({ backendUrl, onRecordingComplete }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevels, setAudioLevels] = useState(new Array(32).fill(0));
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const streamRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const updateWaveform = useCallback(() => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const bars = 32;
    const step = Math.floor(dataArray.length / bars);
    const levels = [];
    for (let i = 0; i < bars; i++) {
      const value = dataArray[i * step] / 255;
      levels.push(value);
    }
    setAudioLevels(levels);
    animFrameRef.current = requestAnimationFrame(updateWaveform);
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true,
          sampleRate: 44100 
        } 
      });
      streamRef.current = stream;

      // Setup analyser for waveform
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Find supported mime type
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
      let selectedMime = '';
      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMime = mime;
          break;
        }
      }

      const mediaRecorder = new MediaRecorder(stream, selectedMime ? { mimeType: selectedMime } : {});
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop waveform animation
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        setAudioLevels(new Array(32).fill(0));
        
        const blob = new Blob(audioChunksRef.current, { type: selectedMime || 'audio/webm' });
        await uploadRecording(blob);
      };

      mediaRecorder.start(250); // Collect data every 250ms
      setIsRecording(true);
      setDuration(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      // Start waveform
      updateWaveform();

      toast.success('Înregistrare pornită');
    } catch (err) {
      console.error('Recording error:', err);
      if (err.name === 'NotAllowedError') {
        toast.error('Acces la microfon refuzat. Verificați permisiunile browserului.');
      } else {
        toast.error('Nu s-a putut porni înregistrarea: ' + err.message);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  };

  const uploadRecording = async (blob) => {
    setIsUploading(true);
    try {
      // Step 1: Create meeting
      const createRes = await fetch(`${backendUrl}/api/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const meeting = await createRes.json();
      const meetingId = meeting._id;

      // Step 2: Upload audio
      const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm';
      const formData = new FormData();
      formData.append('file', blob, `recording.${ext}`);

      const uploadRes = await fetch(`${backendUrl}/api/meetings/${meetingId}/upload`, {
        method: 'POST',
        body: formData
      });

      if (!uploadRes.ok) throw new Error('Upload failed');

      toast.success('Înregistrare trimisă! Se procesează...');
      if (onRecordingComplete) onRecordingComplete(meetingId);
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Eroare la trimiterea înregistrării: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="p-6 rounded-2xl shadow-[0_6px_18px_hsl(var(--gal-shadow))]" data-testid="recorder-card">
      {/* Timer */}
      <div className="text-center mb-6">
        <p className="font-mono-timer text-4xl font-semibold tracking-wider" data-testid="recording-timer">
          {formatTime(duration)}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {isRecording ? 'Se înregistrează...' : isUploading ? 'Se trimite...' : 'Gata de înregistrare'}
        </p>
      </div>

      {/* Waveform */}
      <div 
        className="flex items-center justify-center gap-[2px] h-16 mb-6 px-4"
        data-testid="recording-waveform"
      >
        {audioLevels.map((level, i) => (
          <div
            key={i}
            className="w-1.5 rounded-full transition-all duration-75"
            style={{
              height: isRecording 
                ? `${Math.max(8, level * 100)}%` 
                : '12%',
              backgroundColor: isRecording
                ? level > 0.7 
                  ? 'hsl(var(--gal-warning))' 
                  : 'hsl(var(--gal-danger))'
                : 'hsl(var(--muted))'
            }}
          />
        ))}
      </div>

      {/* Record Button */}
      <div className="flex justify-center">
        <div className="relative">
          {isRecording && (
            <div className="absolute inset-[-12px] rounded-full border-2 border-[hsl(var(--gal-danger))]/30 animate-record-pulse pointer-events-none" />
          )}
          <Button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isUploading}
            className={`h-20 w-20 rounded-full shadow-[0_14px_40px_hsl(var(--gal-shadow))] relative z-10 ${
              isRecording 
                ? 'bg-[hsl(var(--gal-danger))] hover:bg-[hsl(var(--gal-danger))]/90' 
                : 'bg-primary hover:bg-primary/90'
            } text-white`}
            data-testid="record-toggle-button"
          >
            {isUploading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : isRecording ? (
              <Square className="h-8 w-8" />
            ) : (
              <Mic className="h-8 w-8" />
            )}
          </Button>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-4">
        {isRecording ? 'Apăsați pentru a opri' : isUploading ? 'Se încarcă și procesează...' : 'Apăsați pentru a înregistra'}
      </p>
    </Card>
  );
}
