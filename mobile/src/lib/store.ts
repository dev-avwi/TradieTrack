import { create } from 'zustand';
import api from './api';

// ============ TYPES ============

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  tradeType?: string;
  role?: string;
  abn?: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
  brandColor?: string;
  gstEnabled?: boolean;
}

interface BusinessSettings {
  id: string;
  businessName: string;
  abn?: string;
  phone?: string;
  email?: string;
  address?: string;
  logoUrl?: string;
  primaryColor?: string;
  teamSize?: string;
}

interface Job {
  id: string;
  title: string;
  description?: string;
  address?: string;
  status: 'pending' | 'scheduled' | 'in_progress' | 'done' | 'invoiced';
  scheduledAt?: string;
  clientId?: string;
  assignedTo?: string;
  clientName?: string;
}

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

interface QuoteLineItem {
  id: string;
  quoteId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Quote {
  id: string;
  quoteNumber: string;
  clientId: string;
  jobId?: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  subtotal: number;
  gstAmount: number;
  total: number;
  validUntil?: string;
  notes?: string;
  createdAt: string;
  lineItems?: QuoteLineItem[];
  clientName?: string;
}

interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  jobId?: string;
  quoteId?: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  subtotal: number;
  gstAmount: number;
  total: number;
  amountPaid: number;
  dueDate?: string;
  paidAt?: string;
  notes?: string;
  createdAt: string;
  lineItems?: InvoiceLineItem[];
  clientName?: string;
}

interface TimeEntry {
  id: string;
  userId: string;
  jobId?: string;
  description?: string;
  startTime: string;
  endTime?: string;
  notes?: string;
}

// ============ AUTH STORE ============

interface AuthState {
  user: User | null;
  businessSettings: BusinessSettings | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isInitialized: boolean;
  error: string | null;
  
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  updateBusinessSettings: (settings: Partial<BusinessSettings>) => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  businessSettings: null,
  isLoading: false,
  isAuthenticated: false,
  isInitialized: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    
    const response = await api.login(email, password);
    
    if (response.error) {
      set({ isLoading: false, error: response.error });
      return false;
    }

    if (!response.data?.user) {
      set({ isLoading: false, error: 'Invalid response from server' });
      return false;
    }

    set({ 
      user: response.data.user, 
      isAuthenticated: true, 
      isLoading: false,
      isInitialized: true,
      error: null 
    });

    const settingsResponse = await api.get<BusinessSettings>('/api/business-settings');
    if (settingsResponse.data) {
      set({ businessSettings: settingsResponse.data });
    }

    return true;
  },

  logout: async () => {
    set({ isLoading: true });
    await api.logout();
    set({ 
      user: null, 
      businessSettings: null,
      isAuthenticated: false,
      isLoading: false,
      error: null 
    });
  },

  checkAuth: async () => {
    set({ isLoading: true });
    
    await api.loadToken();
    
    if (!api.hasToken()) {
      set({ 
        user: null, 
        isAuthenticated: false, 
        isLoading: false,
        isInitialized: true 
      });
      return;
    }

    const response = await api.getCurrentUser();
    
    if (response.error) {
      await api.setToken(null);
      set({ 
        user: null, 
        isAuthenticated: false, 
        isLoading: false,
        isInitialized: true 
      });
      return;
    }

    set({ 
      user: response.data, 
      isAuthenticated: true, 
      isLoading: false,
      isInitialized: true 
    });

    const settingsResponse = await api.get<BusinessSettings>('/api/business-settings');
    if (settingsResponse.data) {
      set({ businessSettings: settingsResponse.data });
    }
  },

  clearError: () => set({ error: null }),

  updateBusinessSettings: async (settings: Partial<BusinessSettings>) => {
    const response = await api.patch<BusinessSettings>('/api/business-settings', settings);
    if (response.data) {
      set({ businessSettings: response.data });
      return true;
    }
    return false;
  },
}));

// ============ JOBS STORE ============

interface JobsState {
  jobs: Job[];
  todaysJobs: Job[];
  isLoading: boolean;
  error: string | null;
  
  fetchJobs: () => Promise<void>;
  fetchTodaysJobs: () => Promise<void>;
  getJob: (id: string) => Promise<Job | null>;
  updateJobStatus: (jobId: string, status: Job['status']) => Promise<boolean>;
  createJob: (job: Partial<Job>) => Promise<Job | null>;
}

export const useJobsStore = create<JobsState>((set, get) => ({
  jobs: [],
  todaysJobs: [],
  isLoading: false,
  error: null,

  fetchJobs: async () => {
    set({ isLoading: true, error: null });
    
    const response = await api.get<Job[]>('/api/jobs');
    
    if (response.error) {
      set({ isLoading: false, error: response.error });
      return;
    }

    set({ jobs: response.data || [], isLoading: false });
  },

  fetchTodaysJobs: async () => {
    set({ isLoading: true, error: null });
    
    const response = await api.get<Job[]>('/api/jobs/today');
    
    if (response.error) {
      set({ isLoading: false, error: response.error });
      return;
    }

    set({ todaysJobs: response.data || [], isLoading: false });
  },

  getJob: async (id: string) => {
    const response = await api.get<Job>(`/api/jobs/${id}`);
    return response.data || null;
  },

  updateJobStatus: async (jobId: string, status: Job['status']) => {
    const response = await api.patch<Job>(`/api/jobs/${jobId}`, { status });
    
    if (response.error) {
      return false;
    }

    const { jobs, todaysJobs } = get();
    
    set({
      jobs: jobs.map(j => j.id === jobId ? { ...j, status } : j),
      todaysJobs: todaysJobs.map(j => j.id === jobId ? { ...j, status } : j),
    });

    return true;
  },

  createJob: async (job: Partial<Job>) => {
    const response = await api.post<Job>('/api/jobs', job);
    if (response.data) {
      const { jobs } = get();
      set({ jobs: [...jobs, response.data] });
      return response.data;
    }
    return null;
  },
}));

// ============ CLIENTS STORE ============

interface ClientsState {
  clients: Client[];
  isLoading: boolean;
  error: string | null;
  
  fetchClients: () => Promise<void>;
  getClient: (id: string) => Promise<Client | null>;
  createClient: (client: Partial<Client>) => Promise<Client | null>;
  updateClient: (id: string, client: Partial<Client>) => Promise<boolean>;
  deleteClient: (id: string) => Promise<boolean>;
}

export const useClientsStore = create<ClientsState>((set, get) => ({
  clients: [],
  isLoading: false,
  error: null,

  fetchClients: async () => {
    set({ isLoading: true, error: null });
    
    const response = await api.get<Client[]>('/api/clients');
    
    if (response.error) {
      set({ isLoading: false, error: response.error });
      return;
    }

    set({ clients: response.data || [], isLoading: false });
  },

  getClient: async (id: string) => {
    const response = await api.get<Client>(`/api/clients/${id}`);
    return response.data || null;
  },

  createClient: async (client: Partial<Client>) => {
    const response = await api.post<Client>('/api/clients', client);
    if (response.data) {
      const { clients } = get();
      set({ clients: [...clients, response.data] });
      return response.data;
    }
    return null;
  },

  updateClient: async (id: string, client: Partial<Client>) => {
    const response = await api.patch<Client>(`/api/clients/${id}`, client);
    if (response.data) {
      const { clients } = get();
      set({ clients: clients.map(c => c.id === id ? response.data! : c) });
      return true;
    }
    return false;
  },

  deleteClient: async (id: string) => {
    const response = await api.delete(`/api/clients/${id}`);
    if (!response.error) {
      const { clients } = get();
      set({ clients: clients.filter(c => c.id !== id) });
      return true;
    }
    return false;
  },
}));

// ============ QUOTES STORE ============

interface QuotesState {
  quotes: Quote[];
  isLoading: boolean;
  error: string | null;
  
  fetchQuotes: () => Promise<void>;
  getQuote: (id: string) => Promise<Quote | null>;
  createQuote: (quote: Partial<Quote>) => Promise<Quote | null>;
  updateQuote: (id: string, quote: Partial<Quote>) => Promise<boolean>;
  updateQuoteStatus: (id: string, status: Quote['status']) => Promise<boolean>;
  deleteQuote: (id: string) => Promise<boolean>;
}

export const useQuotesStore = create<QuotesState>((set, get) => ({
  quotes: [],
  isLoading: false,
  error: null,

  fetchQuotes: async () => {
    set({ isLoading: true, error: null });
    
    const response = await api.get<Quote[]>('/api/quotes');
    
    if (response.error) {
      set({ isLoading: false, error: response.error });
      return;
    }

    set({ quotes: response.data || [], isLoading: false });
  },

  getQuote: async (id: string) => {
    const response = await api.get<Quote>(`/api/quotes/${id}`);
    return response.data || null;
  },

  createQuote: async (quote: Partial<Quote>) => {
    const response = await api.post<Quote>('/api/quotes', quote);
    if (response.data) {
      const { quotes } = get();
      set({ quotes: [...quotes, response.data] });
      return response.data;
    }
    return null;
  },

  updateQuote: async (id: string, quote: Partial<Quote>) => {
    const response = await api.patch<Quote>(`/api/quotes/${id}`, quote);
    if (response.data) {
      const { quotes } = get();
      set({ quotes: quotes.map(q => q.id === id ? response.data! : q) });
      return true;
    }
    return false;
  },

  updateQuoteStatus: async (id: string, status: Quote['status']) => {
    const response = await api.patch<Quote>(`/api/quotes/${id}`, { status });
    if (response.data) {
      const { quotes } = get();
      set({ quotes: quotes.map(q => q.id === id ? { ...q, status } : q) });
      return true;
    }
    return false;
  },

  deleteQuote: async (id: string) => {
    const response = await api.delete(`/api/quotes/${id}`);
    if (!response.error) {
      const { quotes } = get();
      set({ quotes: quotes.filter(q => q.id !== id) });
      return true;
    }
    return false;
  },
}));

// ============ INVOICES STORE ============

interface InvoicesState {
  invoices: Invoice[];
  isLoading: boolean;
  error: string | null;
  
  fetchInvoices: () => Promise<void>;
  getInvoice: (id: string) => Promise<Invoice | null>;
  createInvoice: (invoice: Partial<Invoice>) => Promise<Invoice | null>;
  updateInvoice: (id: string, invoice: Partial<Invoice>) => Promise<boolean>;
  updateInvoiceStatus: (id: string, status: Invoice['status']) => Promise<boolean>;
  deleteInvoice: (id: string) => Promise<boolean>;
}

export const useInvoicesStore = create<InvoicesState>((set, get) => ({
  invoices: [],
  isLoading: false,
  error: null,

  fetchInvoices: async () => {
    set({ isLoading: true, error: null });
    
    const response = await api.get<Invoice[]>('/api/invoices');
    
    if (response.error) {
      set({ isLoading: false, error: response.error });
      return;
    }

    set({ invoices: response.data || [], isLoading: false });
  },

  getInvoice: async (id: string) => {
    const response = await api.get<Invoice>(`/api/invoices/${id}`);
    return response.data || null;
  },

  createInvoice: async (invoice: Partial<Invoice>) => {
    const response = await api.post<Invoice>('/api/invoices', invoice);
    if (response.data) {
      const { invoices } = get();
      set({ invoices: [...invoices, response.data] });
      return response.data;
    }
    return null;
  },

  updateInvoice: async (id: string, invoice: Partial<Invoice>) => {
    const response = await api.patch<Invoice>(`/api/invoices/${id}`, invoice);
    if (response.data) {
      const { invoices } = get();
      set({ invoices: invoices.map(i => i.id === id ? response.data! : i) });
      return true;
    }
    return false;
  },

  updateInvoiceStatus: async (id: string, status: Invoice['status']) => {
    const response = await api.patch<Invoice>(`/api/invoices/${id}`, { status });
    if (response.data) {
      const { invoices } = get();
      set({ invoices: invoices.map(i => i.id === id ? { ...i, status } : i) });
      return true;
    }
    return false;
  },

  deleteInvoice: async (id: string) => {
    const response = await api.delete(`/api/invoices/${id}`);
    if (!response.error) {
      const { invoices } = get();
      set({ invoices: invoices.filter(i => i.id !== id) });
      return true;
    }
    return false;
  },
}));

// ============ DASHBOARD STATS ============

interface DashboardStats {
  jobsToday: number;
  overdueJobs: number;
  pendingQuotes: number;
  thisMonthRevenue: number;
  unpaidInvoices: number;
}

interface DashboardState {
  stats: DashboardStats;
  isLoading: boolean;
  
  fetchStats: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  stats: {
    jobsToday: 0,
    overdueJobs: 0,
    pendingQuotes: 0,
    thisMonthRevenue: 0,
    unpaidInvoices: 0,
  },
  isLoading: false,

  fetchStats: async () => {
    set({ isLoading: true });
    
    // Fetch all data in parallel
    const [jobsRes, quotesRes, invoicesRes] = await Promise.all([
      api.get<Job[]>('/api/jobs'),
      api.get<Quote[]>('/api/quotes'),
      api.get<Invoice[]>('/api/invoices'),
    ]);

    const jobs = jobsRes.data || [];
    const quotes = quotesRes.data || [];
    const invoices = invoicesRes.data || [];

    // Calculate stats
    const today = new Date().toDateString();
    const jobsToday = jobs.filter(j => 
      j.scheduledAt && new Date(j.scheduledAt).toDateString() === today
    ).length;

    const overdueJobs = jobs.filter(j => 
      j.status === 'scheduled' && 
      j.scheduledAt && 
      new Date(j.scheduledAt) < new Date()
    ).length;

    const pendingQuotes = quotes.filter(q => 
      q.status === 'sent' || q.status === 'draft'
    ).length;

    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();
    const thisMonthRevenue = invoices
      .filter(i => {
        if (i.status !== 'paid' || !i.paidAt) return false;
        const paidDate = new Date(i.paidAt);
        return paidDate.getMonth() === thisMonth && paidDate.getFullYear() === thisYear;
      })
      .reduce((sum, i) => sum + (i.total || 0), 0);

    const unpaidInvoices = invoices.filter(i => 
      i.status === 'sent' || i.status === 'overdue'
    ).length;

    set({
      stats: {
        jobsToday,
        overdueJobs,
        pendingQuotes,
        thisMonthRevenue: thisMonthRevenue / 100, // Convert cents to dollars
        unpaidInvoices,
      },
      isLoading: false,
    });
  },
}));

// ============ TIME TRACKING STORE ============

interface TimeTrackingState {
  activeTimer: TimeEntry | null;
  isLoading: boolean;
  error: string | null;

  fetchActiveTimer: () => Promise<void>;
  startTimer: (jobId: string, description?: string) => Promise<boolean>;
  stopTimer: () => Promise<boolean>;
  getElapsedMinutes: () => number;
}

export const useTimeTrackingStore = create<TimeTrackingState>((set, get) => ({
  activeTimer: null,
  isLoading: false,
  error: null,

  fetchActiveTimer: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<TimeEntry>('/api/time-entries/active');
      set({ activeTimer: response.data || null, isLoading: false, error: null });
    } catch (error: any) {
      // 404 means no active timer, which is fine
      if (error.response?.status === 404) {
        set({ activeTimer: null, isLoading: false, error: null });
      } else {
        const errorMessage = error.response?.data?.error || 'Failed to fetch active timer';
        set({ activeTimer: null, isLoading: false, error: errorMessage });
      }
    }
  },

  startTimer: async (jobId: string, description?: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<TimeEntry>('/api/time-entries', {
        jobId,
        description: description || 'Working on job',
        startTime: new Date().toISOString(),
      });
      
      if (response.data) {
        // Set active timer from the response
        set({ activeTimer: response.data, isLoading: false, error: null });
        return true;
      }
      
      // If no data in response, fetch from server to get actual state
      const activeResponse = await api.get<TimeEntry>('/api/time-entries/active');
      set({ 
        activeTimer: activeResponse.data || null, 
        isLoading: false, 
        error: activeResponse.data ? null : 'Timer created but not returned' 
      });
      return !!activeResponse.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to start timer';
      set({ isLoading: false, error: errorMessage });
      return false;
    }
  },

  stopTimer: async () => {
    const { activeTimer } = get();
    if (!activeTimer) {
      set({ error: 'No active timer to stop' });
      return false;
    }

    const timerId = activeTimer.id;
    set({ isLoading: true, error: null });
    
    try {
      await api.post(`/api/time-entries/${timerId}/stop`);
      // Clear active timer immediately on success
      set({ activeTimer: null, isLoading: false, error: null });
      return true;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to stop timer';
      set({ error: errorMessage });
      
      // Refresh from server to get actual state
      try {
        const response = await api.get<TimeEntry>('/api/time-entries/active');
        set({ activeTimer: response.data || null, isLoading: false });
      } catch {
        set({ activeTimer: null, isLoading: false });
      }
      return false;
    }
  },

  getElapsedMinutes: () => {
    const { activeTimer } = get();
    if (!activeTimer?.startTime) return 0;
    try {
      const start = new Date(activeTimer.startTime);
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - start.getTime()) / (1000 * 60));
      return elapsed >= 0 ? elapsed : 0;
    } catch {
      return 0;
    }
  },
}));
