import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { useOfflineStore } from './offline-storage';

const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl || 
  process.env.EXPO_PUBLIC_API_URL || 
  'https://ff735932-1a5e-42dc-89e5-b025f7feea5d-00-3hwzylsjthmgp.worf.replit.dev';

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
  }): Promise<ApiResponse<any>> {
    return this.patch<any>('/api/business-settings', data);
  }
}

export const api = new ApiClient(API_BASE_URL);
export default api;
