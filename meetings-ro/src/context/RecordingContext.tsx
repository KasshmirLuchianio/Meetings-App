import React, { createContext, useContext, useState, useRef, useCallback } from 'react';

interface RecordingContextType {
  isRecording: boolean;
  setIsRecording: (val: boolean) => void;
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
  duration: string;
  setDuration: (val: string) => void;
  durationSeconds: number;
  setDurationSeconds: (val: number) => void;
  stopRecording: () => void;
  registerStopHandler: (fn: () => void) => void;
}

const RecordingContext = createContext<RecordingContextType>({
  isRecording: false,
  setIsRecording: () => {},
  isProcessing: false,
  setIsProcessing: () => {},
  duration: '00:00',
  setDuration: () => {},
  durationSeconds: 0,
  setDurationSeconds: () => {},
  stopRecording: () => {},
  registerStopHandler: () => {},
});

export function RecordingProvider({ children }: { children: React.ReactNode }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [duration, setDuration] = useState('00:00');
  const [durationSeconds, setDurationSeconds] = useState(0);
  const stopHandlerRef = useRef<(() => void) | null>(null);

  const registerStopHandler = useCallback((fn: () => void) => {
    stopHandlerRef.current = fn;
  }, []);

  const stopRecording = useCallback(() => {
    stopHandlerRef.current?.();
  }, []);

  return (
    <RecordingContext.Provider
      value={{
        isRecording,
        setIsRecording,
        isProcessing,
        setIsProcessing,
        duration,
        setDuration,
        durationSeconds,
        setDurationSeconds,
        stopRecording,
        registerStopHandler,
      }}
    >
      {children}
    </RecordingContext.Provider>
  );
}

export const useRecording = () => useContext(RecordingContext);
