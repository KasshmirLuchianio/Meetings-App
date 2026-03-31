import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Play, Pause, RotateCcw, AlertCircle } from 'lucide-react';

export default function AudioPlayer({ audioUrl }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setIsLoading(false);
      setError(null);
    };
    const onDurationChange = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onEnded = () => setIsPlaying(false);
    const onCanPlayThrough = () => {
      setIsLoading(false);
      setError(null);
    };
    const onError = (e) => {
      console.error('Audio error:', e);
      setError('Eroare la redarea audio');
      setIsPlaying(false);
      setIsLoading(false);
    };
    const onWaiting = () => setIsLoading(true);
    const onPlaying = () => {
      setIsLoading(false);
      setError(null);
    };
    const onStalled = () => {
      // Don't set error on stall, just wait
      console.warn('Audio stalled, waiting for data...');
    };
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('canplaythrough', onCanPlayThrough);
    audio.addEventListener('error', onError);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('stalled', onStalled);
    audio.addEventListener('pause', onPause);

    // Force load
    audio.load();

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('canplaythrough', onCanPlayThrough);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('stalled', onStalled);
      audio.removeEventListener('pause', onPause);
    };
  }, [audioUrl]);

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      setError(null);
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.error('Play error:', err);
            // On mobile, user gesture might be needed
            if (err.name === 'NotAllowedError') {
              setError('Apăsați din nou pentru a reda');
            } else {
              setError('Eroare la redare');
            }
            setIsPlaying(false);
          });
      } else {
        setIsPlaying(true);
      }
    }
  }, [isPlaying]);

  const handleSeek = useCallback((value) => {
    const audio = audioRef.current;
    if (!audio || !isFinite(value[0])) return;
    audio.currentTime = value[0];
    setCurrentTime(value[0]);
  }, []);

  const restart = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setCurrentTime(0);
    if (!isPlaying) {
      togglePlay();
    }
  }, [isPlaying, togglePlay]);

  if (!audioUrl) return null;

  return (
    <div
      className="audio-player-sticky bg-background/95 backdrop-blur border-t border-border p-4"
      data-testid="meeting-audio-player"
    >
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="auto"
        playsInline
        crossOrigin="anonymous"
      />
      
      {error && (
        <div className="flex items-center gap-2 text-xs text-[hsl(var(--gal-danger))] mb-2">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={restart}
          className="h-10 w-10 rounded-xl shrink-0"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        <Button
          onClick={togglePlay}
          className="h-12 w-12 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
          data-testid="audio-play-button"
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </Button>

        <div className="flex-1 flex items-center gap-2">
          <span className="text-xs font-mono-timer text-muted-foreground w-10 text-right">
            {formatTime(currentTime)}
          </span>
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="flex-1"
          />
          <span className="text-xs font-mono-timer text-muted-foreground w-10">
            {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}
