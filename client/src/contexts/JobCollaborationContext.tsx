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
}

export const JobCollaborationCtxRaw = createContext<(JobCollaborationContextType & {
  _dispatchPresence: (jobId: string, editors: JobEditor[]) => void;
  _dispatchFieldUpdate: (event: JobFieldUpdateEvent) => void;
}) | null>(null);
const JobCollaborationContext = JobCollaborationCtxRaw;

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

  const value = {
    sendEditingStart,
    sendEditingStop,
    onPresenceChange,
    onFieldUpdate,
    setSendMessage,
    _dispatchPresence: (jobId: string, editors: JobEditor[]) => {
      presenceListeners.current.forEach(l => l(jobId, editors));
    },
    _dispatchFieldUpdate: (event: JobFieldUpdateEvent) => {
      fieldUpdateListeners.current.forEach(l => l(event));
    },
  };

  return (
    <JobCollaborationContext.Provider value={value as any}>
      {children}
    </JobCollaborationContext.Provider>
  );
}

export function useJobCollaborationContext() {
  const ctx = useContext(JobCollaborationContext);
  if (!ctx) throw new Error('useJobCollaborationContext must be used within JobCollaborationProvider');
  return ctx;
}

export function useJobPresence(jobId: string | undefined, currentUserId: string | undefined, userName: string | undefined) {
  const ctx = useContext(JobCollaborationContext);
  const [editors, setEditors] = useState<JobEditor[]>([]);
  const activeJobRef = useRef<string | undefined>();

  useEffect(() => {
    if (!ctx || !jobId) return;

    activeJobRef.current = jobId;
    if (userName) {
      ctx.sendEditingStart(jobId, userName);
    }

    const unsub = (ctx as any).onPresenceChange((evtJobId: string, evtEditors: JobEditor[]) => {
      if (evtJobId === jobId) {
        setEditors(evtEditors.filter(e => e.userId !== currentUserId));
      }
    });

    return () => {
      unsub();
      if (activeJobRef.current) {
        ctx.sendEditingStop(activeJobRef.current);
        activeJobRef.current = undefined;
      }
    };
  }, [ctx, jobId, currentUserId, userName]);

  return editors;
}

export function useJobFieldUpdates(jobId: string | undefined) {
  const ctx = useContext(JobCollaborationContext);
  const [recentUpdates, setRecentUpdates] = useState<{ field: string; updatedByName: string; timestamp: number }[]>([]);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    if (!ctx || !jobId) return;

    const unsub = (ctx as any).onFieldUpdate((event: JobFieldUpdateEvent) => {
      if (event.jobId !== jobId) return;

      const newUpdates = event.updatedFields.map(field => ({
        field,
        updatedByName: event.updatedByName,
        timestamp: event.timestamp,
      }));

      setRecentUpdates(prev => [...prev, ...newUpdates]);

      newUpdates.forEach(update => {
        const existing = timersRef.current.get(update.field);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(() => {
          setRecentUpdates(prev => prev.filter(u =>
            !(u.field === update.field && u.timestamp === update.timestamp)
          ));
          timersRef.current.delete(update.field);
        }, 5000);
        timersRef.current.set(update.field, timer);
      });
    });

    return () => {
      unsub();
      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current.clear();
    };
  }, [ctx, jobId]);

  const isFieldUpdated = useCallback((field: string) => {
    return recentUpdates.some(u => u.field === field);
  }, [recentUpdates]);

  const getFieldUpdateInfo = useCallback((field: string) => {
    return recentUpdates.find(u => u.field === field);
  }, [recentUpdates]);

  return { recentUpdates, isFieldUpdated, getFieldUpdateInfo };
}
