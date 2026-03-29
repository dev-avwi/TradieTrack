import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

interface JobEditor {
  userId: string;
  userName: string;
  joinedAt: number;
}

interface JobFieldUpdateEvent {
  jobId: string;
  updatedFields: string[];
  updatedBy: string;
  updatedByName: string;
  version: number;
  serverData: Record<string, unknown>;
  timestamp: number;
}

type PresenceListener = (jobId: string, editors: JobEditor[]) => void;
type FieldUpdateListener = (event: JobFieldUpdateEvent) => void;

interface JobCollaborationContextType {
  sendEditingStart: (jobId: string, userName: string) => void;
  sendEditingStop: (jobId: string) => void;
  onPresenceChange: (listener: PresenceListener) => () => void;
  onFieldUpdate: (listener: FieldUpdateListener) => () => void;
  setSendMessage: (fn: (msg: Record<string, unknown>) => void) => void;
  _dispatchPresence: (jobId: string, editors: JobEditor[]) => void;
  _dispatchFieldUpdate: (event: JobFieldUpdateEvent) => void;
}

export const JobCollaborationCtxRaw = createContext<JobCollaborationContextType | null>(null);

export function JobCollaborationProvider({ children }: { children: React.ReactNode }) {
  const sendMessageRef = useRef<(msg: Record<string, unknown>) => void>(() => {});
  const presenceListeners = useRef<Set<PresenceListener>>(new Set());
  const fieldUpdateListeners = useRef<Set<FieldUpdateListener>>(new Set());

  const setSendMessage = useCallback((fn: (msg: Record<string, unknown>) => void) => {
    sendMessageRef.current = fn;
  }, []);

  const sendEditingStart = useCallback((jobId: string, userName: string) => {
    sendMessageRef.current({ type: 'job_editing_start', jobId, userName });
  }, []);

  const sendEditingStop = useCallback((jobId: string) => {
    sendMessageRef.current({ type: 'job_editing_stop', jobId });
  }, []);

  const onPresenceChange = useCallback((listener: PresenceListener) => {
    presenceListeners.current.add(listener);
    return () => { presenceListeners.current.delete(listener); };
  }, []);

  const onFieldUpdate = useCallback((listener: FieldUpdateListener) => {
    fieldUpdateListeners.current.add(listener);
    return () => { fieldUpdateListeners.current.delete(listener); };
  }, []);

  const _dispatchPresence = useCallback((jobId: string, editors: JobEditor[]) => {
    presenceListeners.current.forEach(l => l(jobId, editors));
  }, []);

  const _dispatchFieldUpdate = useCallback((event: JobFieldUpdateEvent) => {
    fieldUpdateListeners.current.forEach(l => l(event));
  }, []);

  const value: JobCollaborationContextType = {
    sendEditingStart,
    sendEditingStop,
    onPresenceChange,
    onFieldUpdate,
    setSendMessage,
    _dispatchPresence,
    _dispatchFieldUpdate,
  };

  return (
    <JobCollaborationCtxRaw.Provider value={value}>
      {children}
    </JobCollaborationCtxRaw.Provider>
  );
}

export function useJobCollaborationContext() {
  const ctx = useContext(JobCollaborationCtxRaw);
  if (!ctx) throw new Error('useJobCollaborationContext must be used within JobCollaborationProvider');
  return ctx;
}
