import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { useOfflineStore } from './offline-storage';

// Automatic API URL detection
// - Development (Expo): Uses Replit dev URL
// - Production (App Store): Uses production domain
const getApiBaseUrl = (): string => {
  // Explicit environment variable takes priority
  if (Constants.expoConfig?.extra?.apiUrl) {
    return Constants.expoConfig.extra.apiUrl;
  }
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  
  // Auto-detect based on __DEV__ flag (set by React Native/Expo)
  if (__DEV__) {
    // Development mode - use Replit dev server
    // This URL is the current Replit workspace
    return 'https://ff735932-1a5e-42dc-89e5-b025f7feea5d-00-3hwzylsjthmgp.worf.replit.dev';
  }
  
  // Production builds use the production domain
  return 'https://tradietrack.com';
};

const API_BASE_URL = getApiBaseUrl();

// Log which API URL is being used (helps debug connection issues)
console.log(`[API] Mode: ${__DEV__ ? 'Development' : 'Production'}, URL: ${API_BASE_URL}`);

export const API_URL = API_BASE_URL;

interface ApiResponse<T> {
  data?: T;
  error?: string;
  isOffline?: boolean;
}

interface LoginResponse {
  success: boolean;
  user: any;
  sessionToken: string;
}

class ApiClient {
  private baseUrl: string;
  private sessionToken: string | null = null;
  private tokenLoaded: boolean = false;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async isOnline(): Promise<boolean> {
    return useOfflineStore.getState().isOnline;
  }

  async loadToken(): Promise<string | null> {
    if (this.tokenLoaded) {
      return this.sessionToken;
    }
    try {
      this.sessionToken = await SecureStore.getItemAsync('session_token');
      this.tokenLoaded = true;
    } catch (error) {
      console.error('Failed to load session token:', error);
    }
    return this.sessionToken;
  }

  async setToken(token: string | null) {
    this.sessionToken = token;
    this.tokenLoaded = true;
    try {
      if (token) {
        await SecureStore.setItemAsync('session_token', token);
      } else {
        await SecureStore.deleteItemAsync('session_token');
      }
    } catch (error) {
      console.error('Failed to save session token:', error);
    }
  }

  async getToken(): Promise<string | null> {
    if (!this.tokenLoaded) {
      await this.loadToken();
    }
    return this.sessionToken;
  }

  hasToken(): boolean {
    return !!this.sessionToken;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private async getHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    const token = await this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }

  async request<T>(
    method: string,
    endpoint: string,
    body?: any,
    options?: { headers?: Record<string, string> }
  ): Promise<ApiResponse<T>> {
    try {
      const headers = await this.getHeaders();
      if (options?.headers) {
        Object.assign(headers, options.headers);
      }
      const config: RequestInit = {
        method,
        headers,
      };

      if (body && method !== 'GET') {
        if (body instanceof FormData) {
          config.body = body;
          delete (headers as any)['Content-Type'];
        } else {
          config.body = JSON.stringify(body);
        }
      }

      const url = `${this.baseUrl}${endpoint}`;
      console.log(`[API] ${method} ${endpoint}`);
      
      const response = await fetch(url, config);
      
      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      
      if (!response.ok) {
        if (isJson) {
          const errorData = await response.json().catch(() => ({}));
          console.log(`[API] Error ${response.status}:`, errorData);
          return { error: errorData.error || errorData.message || `Request failed: ${response.status}` };
        } else {
          const text = await response.text().catch(() => '');
          console.log(`[API] Non-JSON Error ${response.status}:`, text.substring(0, 100));
          return { error: `Server error (${response.status}). Please try again.` };
        }
      }

      if (!isJson) {
        console.log(`[API] Warning: Non-JSON response for ${endpoint}`);
        return { data: {} as T };
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      const online = await this.isOnline();
      if (!online) {
        console.log(`[API] Offline - skipping ${method} ${endpoint}`);
        return { error: 'offline', isOffline: true };
      }
      console.warn(`[API] Network Error [${method} ${endpoint}]:`, error);
      return { error: error instanceof Error ? error.message : 'Network error' };
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>('GET', endpoint);
  }

  async post<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>('POST', endpoint, body);
  }

  async patch<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', endpoint, body);
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', endpoint);
  }

  /**
   * Upload a file using FormData
   * @param endpoint The API endpoint to upload to
   * @param formData FormData containing the file and metadata
   */
  async uploadFile<T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    try {
      const token = await this.getToken();
      const headers: HeadersInit = {};
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      // Note: Don't set Content-Type for FormData - let fetch set it with boundary
      
      const url = `${this.baseUrl}${endpoint}`;
      console.log(`[API] POST (upload) ${endpoint}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });
      
      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      
      if (!response.ok) {
        if (isJson) {
          const errorData = await response.json().catch(() => ({}));
          console.log(`[API] Upload Error ${response.status}:`, errorData);
          return { error: errorData.error || errorData.message || `Upload failed: ${response.status}` };
        } else {
          return { error: `Upload failed (${response.status})` };
        }
      }
      
      if (!isJson) {
        return { data: {} as T };
      }
      
      const data = await response.json();
      return { data };
    } catch (error) {
      const online = await this.isOnline();
      if (!online) {
        console.log(`[API] Offline - skipping upload ${endpoint}`);
        return { error: 'offline', isOffline: true };
      }
      console.warn(`[API] Upload Error [${endpoint}]:`, error);
      return { error: error instanceof Error ? error.message : 'Upload failed' };
    }
  }

  async login(email: string, password: string): Promise<ApiResponse<LoginResponse>> {
    const response = await this.post<LoginResponse>('/api/auth/login', { email, password });
    
    if (response.data?.sessionToken) {
      await this.setToken(response.data.sessionToken);
    }
    
    return response;
  }

  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    businessName: string;
    tradeType: string;
    phone?: string;
  }): Promise<ApiResponse<LoginResponse>> {
    const response = await this.post<LoginResponse>('/api/auth/register', data);
    
    if (response.data?.sessionToken) {
      await this.setToken(response.data.sessionToken);
    }
    
    return response;
  }

  async logout(): Promise<ApiResponse<any>> {
    const response = await this.post<any>('/api/auth/logout');
    await this.setToken(null);
    return response;
  }

  async getCurrentUser(): Promise<ApiResponse<any>> {
    return this.get<any>('/api/auth/me');
  }

  async updateBusinessSettings(data: {
    businessName?: string;
    tradeType?: string;
    abn?: string;
    phone?: string;
    address?: string;
    gstEnabled?: boolean;
    defaultHourlyRate?: number;
    calloutFee?: number;
    brandColor?: string;
    logoUrl?: string;
  }): Promise<ApiResponse<any>> {
    return this.patch<any>('/api/business-settings', data);
  }

  async uploadBusinessLogo(uri: string): Promise<ApiResponse<{ logoUrl: string }>> {
    const formData = new FormData();
    const filename = uri.split('/').pop() || 'logo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : `image/jpeg`;

    formData.append('logo', {
      uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
      name: filename,
      type,
    } as any);

    return this.uploadFile<{ logoUrl: string }>('/api/business-settings/logo', formData);
  }

  async forgotPassword(email: string): Promise<{ success: boolean; error?: string; message?: string }> {
    const response = await this.post<{ success: boolean; message?: string }>('/api/auth/forgot-password', { email });
    
    if (response.error) {
      return { success: false, error: response.error };
    }
    
    return { success: true, message: response.data?.message };
  }

  async resetPassword(token: string, password: string): Promise<{ success: boolean; error?: string; message?: string }> {
    const response = await this.post<{ success: boolean; message?: string }>('/api/auth/reset-password', { token, password });
    
    if (response.error) {
      return { success: false, error: response.error };
    }
    
    return { success: true, message: response.data?.message };
  }

  // Subscription API methods
  async getSubscriptionStatus(): Promise<ApiResponse<{
    tier: string;
    status: string;
    trialEndsAt: string | null;
    nextBillingDate: string | null;
    cancelAtPeriodEnd: boolean;
    paymentMethod: { last4: string; brand: string } | null;
    seats: number | null;
    canUpgrade: boolean;
    canDowngrade: boolean;
  }>> {
    return this.get('/api/subscription/status');
  }

  async createSubscriptionCheckout(tier: 'pro' | 'team', seats?: number): Promise<ApiResponse<{ url: string }>> {
    return this.post('/api/subscription/create-checkout', { tier, seats });
  }

  async getSubscriptionManageUrl(): Promise<ApiResponse<{ url: string }>> {
    return this.post('/api/subscription/manage');
  }

  async getSubscriptionInvoices(): Promise<ApiResponse<{ 
    invoices: Array<{ 
      id: string; 
      amount: number; 
      status: string; 
      date: string; 
      pdfUrl: string | null 
    }> 
  }>> {
    return this.get('/api/subscription/invoices');
  }

  // Google Calendar Integration API methods
  async getGoogleCalendarStatus(): Promise<ApiResponse<{
    configured: boolean;
    connected: boolean;
    email?: string;
    message?: string;
  }>> {
    return this.get('/api/integrations/google-calendar/status');
  }

  async syncJobToCalendar(jobId: string): Promise<ApiResponse<{
    success: boolean;
    eventId: string;
    eventLink: string;
  }>> {
    return this.post('/api/integrations/google-calendar/sync-job', { jobId });
  }

  async syncAllJobsToCalendar(): Promise<ApiResponse<{
    success: boolean;
    synced: number;
    failed: number;
    errors: string[];
    message: string;
  }>> {
    return this.post('/api/integrations/google-calendar/sync-all-jobs');
  }

  async getGoogleCalendarEvents(limit?: number): Promise<ApiResponse<{
    events: Array<{
      id: string;
      summary: string;
      description: string;
      location: string;
      start: string;
      end: string;
      htmlLink: string;
    }>
  }>> {
    return this.get(`/api/integrations/google-calendar/events${limit ? `?limit=${limit}` : ''}`);
  }

  // Xero Integration API methods
  async getXeroStatus(): Promise<ApiResponse<{
    connected: boolean;
    configured: boolean;
    organisationName?: string;
    email?: string;
    lastSyncedAt?: string;
    message?: string;
  }>> {
    return this.get('/api/integrations/xero/status');
  }

  async syncContactsFromXero(): Promise<ApiResponse<{
    success: boolean;
    imported: number;
    skipped: number;
    errors: string[];
  }>> {
    return this.post('/api/integrations/xero/sync-contacts');
  }

  async pushInvoiceToXero(invoiceId: string): Promise<ApiResponse<{
    success: boolean;
    xeroInvoiceId: string;
    xeroInvoiceNumber: string;
  }>> {
    return this.post('/api/integrations/xero/push-invoice', { invoiceId });
  }

  // All integrations status (unified endpoint for mobile)
  async getAllIntegrationsStatus(): Promise<ApiResponse<{
    googleCalendar: {
      configured: boolean;
      connected: boolean;
      email?: string;
      message?: string;
    };
    xero: {
      configured: boolean;
      connected: boolean;
      organisationName?: string;
    };
    stripe: {
      configured: boolean;
      connected: boolean;
    };
    twilio: {
      configured: boolean;
      connected: boolean;
    };
  }>> {
    return this.get('/api/integrations/status');
  }
}

export const api = new ApiClient(API_BASE_URL);
export default api;
