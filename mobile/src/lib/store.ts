import { create } from 'zustand';
import api from './api';
import offlineStorage, { useOfflineStore } from './offline-storage';

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
  themeColor?: string;
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

interface RoleInfo {
  roleId: string;
  roleName: string;
  permissions: string[];
  hasCustomPermissions: boolean;
  isOwner: boolean;
}

interface AuthState {
  user: User | null;
  businessSettings: BusinessSettings | null;
  roleInfo: RoleInfo | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isInitialized: boolean;
  error: string | null;
  
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  fetchRoleInfo: () => Promise<void>;
  clearError: () => void;
  updateBusinessSettings: (settings: Partial<BusinessSettings>) => Promise<boolean>;
  hasPermission: (permission: string) => boolean;
  isOwner: () => boolean;
  isStaff: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  businessSettings: null,
  roleInfo: null,
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
    
    // Fetch role info for permissions
    await get().fetchRoleInfo();

    return true;
  },

  logout: async () => {
    set({ isLoading: true });
    await api.logout();
    set({ 
      user: null, 
      businessSettings: null,
      roleInfo: null,
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
    
    // Fetch role info for permissions
    await get().fetchRoleInfo();
  },

  fetchRoleInfo: async () => {
    // Try to fetch role info (for team members)
    const roleResponse = await api.get<{
      roleId: string;
      roleName: string;
      permissions: string[];
      hasCustomPermissions: boolean;
    }>('/api/team/my-role');
    
    if (roleResponse.data) {
      // User is a team member with specific role
      set({
        roleInfo: {
          roleId: roleResponse.data.roleId,
          roleName: roleResponse.data.roleName,
          permissions: roleResponse.data.permissions,
          hasCustomPermissions: roleResponse.data.hasCustomPermissions,
          isOwner: false,
        }
      });
    } else {
      // User is an owner (not a team member of another business)
      set({
        roleInfo: {
          roleId: 'owner',
          roleName: 'OWNER',
          permissions: ['*'], // Owners have all permissions
          hasCustomPermissions: false,
          isOwner: true,
        }
      });
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
  
  hasPermission: (permission: string) => {
    const { roleInfo } = get();
    if (!roleInfo) return false;
    if (roleInfo.isOwner) return true;
    if (roleInfo.permissions.includes('*')) return true;
    return roleInfo.permissions.includes(permission);
  },
  
  isOwner: () => {
    const { roleInfo } = get();
    return roleInfo?.isOwner ?? false;
  },
  
  isStaff: () => {
    const { roleInfo } = get();
    return roleInfo !== null && !roleInfo.isOwner;
  },
}));

// ============ JOBS STORE (with offline support) ============

interface JobsState {
  jobs: Job[];
  todaysJobs: Job[];
  isLoading: boolean;
  error: string | null;
  isOfflineData: boolean;
  
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
  isOfflineData: false,

  fetchJobs: async () => {
    set({ isLoading: true, error: null });
    
    const response = await api.get<Job[]>('/api/jobs');
    
    if (response.error) {
      // Fall back to cached data when offline
      try {
        const cachedJobs = await offlineStorage.getCachedJobs();
        if (cachedJobs.length > 0) {
          set({ 
            jobs: cachedJobs as Job[], 
            isLoading: false, 
            isOfflineData: true,
            error: null 
          });
          return;
        }
      } catch (e) {
        console.log('[JobsStore] Cache fallback failed:', e);
      }
      set({ isLoading: false, error: response.error });
      return;
    }

    // Cache the data for offline use
    try {
      await offlineStorage.cacheJobs(response.data || []);
    } catch (e) {
      console.log('[JobsStore] Failed to cache jobs:', e);
    }

    set({ jobs: response.data || [], isLoading: false, isOfflineData: false });
  },

  fetchTodaysJobs: async () => {
    set({ isLoading: true, error: null });
    
    const response = await api.get<Job[]>('/api/jobs/today');
    
    if (response.error) {
      // Fall back to cached data filtered for today
      try {
        const cachedJobs = await offlineStorage.getCachedJobs();
        const today = new Date().toDateString();
        const todaysJobs = cachedJobs.filter(j => 
          j.scheduledAt && new Date(j.scheduledAt).toDateString() === today
        );
        if (cachedJobs.length > 0) {
          set({ 
            todaysJobs: todaysJobs as Job[], 
            isLoading: false,
            isOfflineData: true,
            error: null 
          });
          return;
        }
      } catch (e) {
        console.log('[JobsStore] Cache fallback failed:', e);
      }
      set({ isLoading: false, error: response.error });
      return;
    }

    set({ todaysJobs: response.data || [], isLoading: false, isOfflineData: false });
  },

  getJob: async (id: string) => {
    const response = await api.get<Job>(`/api/jobs/${id}`);
    if (response.data) {
      return response.data;
    }
    
    // Fall back to cache
    try {
      const cached = await offlineStorage.getCachedJob(id);
      return cached as Job | null;
    } catch (e) {
      return null;
    }
  },

  updateJobStatus: async (jobId: string, status: Job['status']) => {
    const { jobs, todaysJobs } = get();
    const isOnline = useOfflineStore.getState().isOnline;
    
    // Update local state immediately (optimistic update)
    const updatedJob = jobs.find(j => j.id === jobId);
    set({
      jobs: jobs.map(j => j.id === jobId ? { ...j, status } : j),
      todaysJobs: todaysJobs.map(j => j.id === jobId ? { ...j, status } : j),
    });
    
    if (isOnline) {
      try {
        const response = await api.patch<Job>(`/api/jobs/${jobId}`, { status });
        
        if (response.error) {
          // Queue for later sync
          await offlineStorage.updateJobOffline(jobId, { status });
        } else if (response.data) {
          // Update cache with successful response
          await offlineStorage.cacheJobs([response.data]);
        }
      } catch (e) {
        // Network error - queue for offline sync
        console.log('[JobsStore] Network error, queueing status update:', e);
        await offlineStorage.updateJobOffline(jobId, { status });
      }
    } else {
      // Offline - queue the update
      try {
        await offlineStorage.updateJobOffline(jobId, { status });
      } catch (e) {
        console.log('[JobsStore] Failed to queue offline update:', e);
      }
    }

    return true;
  },

  createJob: async (job: Partial<Job>) => {
    const isOnline = useOfflineStore.getState().isOnline;
    
    if (isOnline) {
      try {
        const response = await api.post<Job>('/api/jobs', job);
        if (response.data) {
          const { jobs } = get();
          set({ jobs: [...jobs, response.data] });
          
          // Cache the new job
          await offlineStorage.cacheJobs([response.data]);
          
          return response.data;
        }
        // API error - fall through to offline creation
      } catch (e) {
        // Network error - create offline
        console.log('[JobsStore] Network error, creating job offline:', e);
      }
      
      // Fall back to offline creation
      try {
        const offlineJob = await offlineStorage.saveJobOffline(job, 'create');
        const { jobs } = get();
        set({ jobs: [...jobs, offlineJob as Job] });
        return offlineJob as Job;
      } catch (e) {
        console.log('[JobsStore] Failed to create offline job:', e);
        return null;
      }
    } else {
      // Create offline
      try {
        const offlineJob = await offlineStorage.saveJobOffline(job, 'create');
        const { jobs } = get();
        set({ jobs: [...jobs, offlineJob as Job] });
        return offlineJob as Job;
      } catch (e) {
        console.log('[JobsStore] Failed to create offline job:', e);
        return null;
      }
    }
  },
}));

// ============ CLIENTS STORE (with offline support) ============

interface ClientsState {
  clients: Client[];
  isLoading: boolean;
  error: string | null;
  isOfflineData: boolean;
  
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
  isOfflineData: false,

  fetchClients: async () => {
    set({ isLoading: true, error: null });
    
    const response = await api.get<Client[]>('/api/clients');
    
    if (response.error) {
      // Fall back to cached data
      try {
        const cachedClients = await offlineStorage.getCachedClients();
        if (cachedClients.length > 0) {
          set({ 
            clients: cachedClients as Client[], 
            isLoading: false,
            isOfflineData: true,
            error: null 
          });
          return;
        }
      } catch (e) {
        console.log('[ClientsStore] Cache fallback failed:', e);
      }
      set({ isLoading: false, error: response.error });
      return;
    }

    // Cache the data
    try {
      await offlineStorage.cacheClients(response.data || []);
    } catch (e) {
      console.log('[ClientsStore] Failed to cache clients:', e);
    }

    set({ clients: response.data || [], isLoading: false, isOfflineData: false });
  },

  getClient: async (id: string) => {
    const response = await api.get<Client>(`/api/clients/${id}`);
    if (response.data) {
      return response.data;
    }
    
    // Fall back to cache
    try {
      const cached = await offlineStorage.getCachedClient(id);
      return cached as Client | null;
    } catch (e) {
      return null;
    }
  },

  createClient: async (client: Partial<Client>) => {
    const isOnline = useOfflineStore.getState().isOnline;
    
    if (isOnline) {
      try {
        const response = await api.post<Client>('/api/clients', client);
        if (response.data) {
          const { clients } = get();
          set({ clients: [...clients, response.data] });
          
          // Cache the new client
          await offlineStorage.cacheClients([response.data]);
          
          return response.data;
        }
        // API error - fall through to offline creation
      } catch (e) {
        // Network error - create offline
        console.log('[ClientsStore] Network error, creating client offline:', e);
      }
      
      // Fall back to offline creation
      try {
        const offlineClient = await offlineStorage.saveClientOffline(client, 'create');
        const { clients } = get();
        set({ clients: [...clients, offlineClient as Client] });
        return offlineClient as Client;
      } catch (e) {
        console.log('[ClientsStore] Failed to create offline client:', e);
        return null;
      }
    } else {
      // Create offline
      try {
        const offlineClient = await offlineStorage.saveClientOffline(client, 'create');
        const { clients } = get();
        set({ clients: [...clients, offlineClient as Client] });
        return offlineClient as Client;
      } catch (e) {
        console.log('[ClientsStore] Failed to create offline client:', e);
        return null;
      }
    }
  },

  updateClient: async (id: string, client: Partial<Client>) => {
    const { clients } = get();
    const isOnline = useOfflineStore.getState().isOnline;
    
    // Optimistic update
    set({ clients: clients.map(c => c.id === id ? { ...c, ...client } : c) });
    
    if (isOnline) {
      try {
        const response = await api.patch<Client>(`/api/clients/${id}`, client);
        if (response.error) {
          // Queue for later sync
          await offlineStorage.updateClientOffline(id, client);
        } else if (response.data) {
          set({ clients: clients.map(c => c.id === id ? response.data! : c) });
          // Update cache
          await offlineStorage.cacheClients([response.data]);
        }
      } catch (e) {
        // Network error - queue for offline sync
        console.log('[ClientsStore] Network error, queueing update:', e);
        await offlineStorage.updateClientOffline(id, client);
      }
    } else {
      // Offline - queue the update
      try {
        await offlineStorage.updateClientOffline(id, client);
      } catch (e) {
        console.log('[ClientsStore] Failed to queue offline update:', e);
      }
    }
    return true;
  },

  deleteClient: async (id: string) => {
    const { clients } = get();
    const isOnline = useOfflineStore.getState().isOnline;
    
    if (!isOnline) {
      // Can't delete while offline - inform user
      console.log('[ClientsStore] Cannot delete while offline');
      return false;
    }
    
    // Optimistic update
    set({ clients: clients.filter(c => c.id !== id) });
    
    try {
      const response = await api.delete(`/api/clients/${id}`);
      if (response.error) {
        // Revert optimistic update if delete fails
        set({ clients });
        return false;
      }
      // Remove from cache on successful delete
      await offlineStorage.removeFromCache('clients', id);
      return true;
    } catch (e) {
      // Network error - revert optimistic update
      console.log('[ClientsStore] Network error during delete:', e);
      set({ clients });
      return false;
    }
  },
}));

// ============ QUOTES STORE (with offline support) ============

interface QuotesState {
  quotes: Quote[];
  isLoading: boolean;
  error: string | null;
  isOfflineData: boolean;
  
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
  isOfflineData: false,

  fetchQuotes: async () => {
    set({ isLoading: true, error: null });
    
    const response = await api.get<Quote[]>('/api/quotes');
    
    if (response.error) {
      // Fall back to cached data
      try {
        const cachedQuotes = await offlineStorage.getCachedQuotes();
        if (cachedQuotes.length > 0) {
          set({ 
            quotes: cachedQuotes as Quote[], 
            isLoading: false,
            isOfflineData: true,
            error: null 
          });
          return;
        }
      } catch (e) {
        console.log('[QuotesStore] Cache fallback failed:', e);
      }
      set({ isLoading: false, error: response.error });
      return;
    }

    // Cache the data
    try {
      await offlineStorage.cacheQuotes(response.data || []);
    } catch (e) {
      console.log('[QuotesStore] Failed to cache quotes:', e);
    }

    set({ quotes: response.data || [], isLoading: false, isOfflineData: false });
  },

  getQuote: async (id: string) => {
    const response = await api.get<Quote>(`/api/quotes/${id}`);
    if (response.data) {
      return response.data;
    }
    
    // Fall back to cache
    try {
      const cached = await offlineStorage.getCachedQuote(id);
      return cached as Quote | null;
    } catch (e) {
      return null;
    }
  },

  createQuote: async (quote: Partial<Quote>) => {
    const isOnline = useOfflineStore.getState().isOnline;
    
    if (isOnline) {
      try {
        const response = await api.post<Quote>('/api/quotes', quote);
        if (response.data) {
          const { quotes } = get();
          set({ quotes: [...quotes, response.data] });
          
          // Cache the new quote
          await offlineStorage.cacheQuotes([response.data]);
          
          return response.data;
        }
        // API error - fall through to offline creation
      } catch (e) {
        // Network error - create offline
        console.log('[QuotesStore] Network error, creating quote offline:', e);
      }
      
      // Fall back to offline creation
      try {
        const offlineQuote = await offlineStorage.saveQuoteOffline(quote, 'create');
        const { quotes } = get();
        set({ quotes: [...quotes, offlineQuote as Quote] });
        return offlineQuote as Quote;
      } catch (e) {
        console.log('[QuotesStore] Failed to create offline quote:', e);
        return null;
      }
    } else {
      // Create offline
      try {
        const offlineQuote = await offlineStorage.saveQuoteOffline(quote, 'create');
        const { quotes } = get();
        set({ quotes: [...quotes, offlineQuote as Quote] });
        return offlineQuote as Quote;
      } catch (e) {
        console.log('[QuotesStore] Failed to create offline quote:', e);
        return null;
      }
    }
  },

  updateQuote: async (id: string, quote: Partial<Quote>) => {
    const { quotes } = get();
    const isOnline = useOfflineStore.getState().isOnline;
    
    // Optimistic update
    set({ quotes: quotes.map(q => q.id === id ? { ...q, ...quote } : q) });
    
    if (isOnline) {
      try {
        const response = await api.patch<Quote>(`/api/quotes/${id}`, quote);
        if (response.error) {
          // Queue for later sync
          await offlineStorage.updateQuoteOffline(id, quote);
        } else if (response.data) {
          set({ quotes: quotes.map(q => q.id === id ? response.data! : q) });
          await offlineStorage.cacheQuotes([response.data]);
        }
      } catch (e) {
        // Network error - queue for offline sync
        console.log('[QuotesStore] Network error, queueing update:', e);
        await offlineStorage.updateQuoteOffline(id, quote);
      }
    } else {
      // Offline - queue the update
      try {
        await offlineStorage.updateQuoteOffline(id, quote);
      } catch (e) {
        console.log('[QuotesStore] Failed to queue offline update:', e);
      }
    }
    return true;
  },

  updateQuoteStatus: async (id: string, status: Quote['status']) => {
    const { quotes } = get();
    const isOnline = useOfflineStore.getState().isOnline;
    
    // Optimistic update
    set({ quotes: quotes.map(q => q.id === id ? { ...q, status } : q) });
    
    if (isOnline) {
      try {
        const response = await api.patch<Quote>(`/api/quotes/${id}`, { status });
        if (response.error) {
          await offlineStorage.updateQuoteOffline(id, { status });
        } else if (response.data) {
          // Update cache with successful response
          await offlineStorage.cacheQuotes([response.data]);
        }
      } catch (e) {
        console.log('[QuotesStore] Network error, queueing status update:', e);
        await offlineStorage.updateQuoteOffline(id, { status });
      }
    } else {
      try {
        await offlineStorage.updateQuoteOffline(id, { status });
      } catch (e) {
        console.log('[QuotesStore] Failed to queue offline update:', e);
      }
    }
    return true;
  },

  deleteQuote: async (id: string) => {
    const { quotes } = get();
    const isOnline = useOfflineStore.getState().isOnline;
    
    if (!isOnline) {
      // Can't delete while offline - inform user
      console.log('[QuotesStore] Cannot delete while offline');
      return false;
    }
    
    // Optimistic update
    set({ quotes: quotes.filter(q => q.id !== id) });
    
    try {
      const response = await api.delete(`/api/quotes/${id}`);
      if (response.error) {
        set({ quotes });
        return false;
      }
      // Remove from cache on successful delete
      await offlineStorage.removeFromCache('quotes', id);
      return true;
    } catch (e) {
      console.log('[QuotesStore] Network error during delete:', e);
      set({ quotes });
      return false;
    }
  },
}));

// ============ INVOICES STORE (with offline support) ============

interface InvoicesState {
  invoices: Invoice[];
  isLoading: boolean;
  error: string | null;
  isOfflineData: boolean;
  
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
  isOfflineData: false,

  fetchInvoices: async () => {
    set({ isLoading: true, error: null });
    
    const response = await api.get<Invoice[]>('/api/invoices');
    
    if (response.error) {
      // Fall back to cached data
      try {
        const cachedInvoices = await offlineStorage.getCachedInvoices();
        if (cachedInvoices.length > 0) {
          set({ 
            invoices: cachedInvoices as Invoice[], 
            isLoading: false,
            isOfflineData: true,
            error: null 
          });
          return;
        }
      } catch (e) {
        console.log('[InvoicesStore] Cache fallback failed:', e);
      }
      set({ isLoading: false, error: response.error });
      return;
    }

    // Cache the data
    try {
      await offlineStorage.cacheInvoices(response.data || []);
    } catch (e) {
      console.log('[InvoicesStore] Failed to cache invoices:', e);
    }

    set({ invoices: response.data || [], isLoading: false, isOfflineData: false });
  },

  getInvoice: async (id: string) => {
    const response = await api.get<Invoice>(`/api/invoices/${id}`);
    if (response.data) {
      return response.data;
    }
    
    // Fall back to cache
    try {
      const cached = await offlineStorage.getCachedInvoice(id);
      return cached as Invoice | null;
    } catch (e) {
      return null;
    }
  },

  createInvoice: async (invoice: Partial<Invoice>) => {
    const isOnline = useOfflineStore.getState().isOnline;
    
    if (isOnline) {
      try {
        const response = await api.post<Invoice>('/api/invoices', invoice);
        if (response.data) {
          const { invoices } = get();
          set({ invoices: [...invoices, response.data] });
          
          // Cache the new invoice
          await offlineStorage.cacheInvoices([response.data]);
          
          return response.data;
        }
        // API error - fall through to offline creation
      } catch (e) {
        // Network error - create offline
        console.log('[InvoicesStore] Network error, creating invoice offline:', e);
      }
      
      // Fall back to offline creation
      try {
        const offlineInvoice = await offlineStorage.saveInvoiceOffline(invoice, 'create');
        const { invoices } = get();
        set({ invoices: [...invoices, offlineInvoice as Invoice] });
        return offlineInvoice as Invoice;
      } catch (e) {
        console.log('[InvoicesStore] Failed to create offline invoice:', e);
        return null;
      }
    } else {
      // Create offline
      try {
        const offlineInvoice = await offlineStorage.saveInvoiceOffline(invoice, 'create');
        const { invoices } = get();
        set({ invoices: [...invoices, offlineInvoice as Invoice] });
        return offlineInvoice as Invoice;
      } catch (e) {
        console.log('[InvoicesStore] Failed to create offline invoice:', e);
        return null;
      }
    }
  },

  updateInvoice: async (id: string, invoice: Partial<Invoice>) => {
    const { invoices } = get();
    const isOnline = useOfflineStore.getState().isOnline;
    
    // Optimistic update
    set({ invoices: invoices.map(i => i.id === id ? { ...i, ...invoice } : i) });
    
    if (isOnline) {
      try {
        const response = await api.patch<Invoice>(`/api/invoices/${id}`, invoice);
        if (response.error) {
          // Queue for later sync
          await offlineStorage.updateInvoiceOffline(id, invoice);
        } else if (response.data) {
          set({ invoices: invoices.map(i => i.id === id ? response.data! : i) });
          await offlineStorage.cacheInvoices([response.data]);
        }
      } catch (e) {
        // Network error - queue for offline sync
        console.log('[InvoicesStore] Network error, queueing update:', e);
        await offlineStorage.updateInvoiceOffline(id, invoice);
      }
    } else {
      // Offline - queue the update
      try {
        await offlineStorage.updateInvoiceOffline(id, invoice);
      } catch (e) {
        console.log('[InvoicesStore] Failed to queue offline update:', e);
      }
    }
    return true;
  },

  updateInvoiceStatus: async (id: string, status: Invoice['status']) => {
    const { invoices } = get();
    const isOnline = useOfflineStore.getState().isOnline;
    
    // Optimistic update
    set({ invoices: invoices.map(i => i.id === id ? { ...i, status } : i) });
    
    if (isOnline) {
      try {
        const response = await api.patch<Invoice>(`/api/invoices/${id}`, { status });
        if (response.error) {
          await offlineStorage.updateInvoiceOffline(id, { status });
        } else if (response.data) {
          // Update cache with successful response
          await offlineStorage.cacheInvoices([response.data]);
        }
      } catch (e) {
        console.log('[InvoicesStore] Network error, queueing status update:', e);
        await offlineStorage.updateInvoiceOffline(id, { status });
      }
    } else {
      try {
        await offlineStorage.updateInvoiceOffline(id, { status });
      } catch (e) {
        console.log('[InvoicesStore] Failed to queue offline update:', e);
      }
    }
    return true;
  },

  deleteInvoice: async (id: string) => {
    const { invoices } = get();
    const isOnline = useOfflineStore.getState().isOnline;
    
    if (!isOnline) {
      // Can't delete while offline - inform user
      console.log('[InvoicesStore] Cannot delete while offline');
      return false;
    }
    
    // Optimistic update
    set({ invoices: invoices.filter(i => i.id !== id) });
    
    try {
      const response = await api.delete(`/api/invoices/${id}`);
      if (response.error) {
        set({ invoices });
        return false;
      }
      // Remove from cache on successful delete
      await offlineStorage.removeFromCache('invoices', id);
      return true;
    } catch (e) {
      console.log('[InvoicesStore] Network error during delete:', e);
      set({ invoices });
      return false;
    }
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
