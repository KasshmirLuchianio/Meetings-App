import React, { createContext, useContext, useState, useRef, useCallback } from 'react';

interface RecordingContextType {
  isRecording: boolean;
  setIsRecording: (val: boolean) => void;
  duration: string;
  setDuration: (val: string) => void;
  stopRecording: () => void;
  registerStopHandler: (fn: () => void) => void;
}

const RecordingContext = createContext<RecordingContextType>({
  isRecording: false,
  setIsRecording: () => {},
  duration: '00:00',
  setDuration: () => {},
  stopRecording: () => {},
  registerStopHandler: () => {},
});

export function RecordingProvider({ children }: { children: React.ReactNode }) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState('00:00');
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
        duration,
        setDuration,
        stopRecording,
        registerStopHandler,
      }}
    >
      {children}
    </RecordingContext.Provider>
  );
}

export const useRecording = () => useContext(RecordingContext);
