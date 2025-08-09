/**
 * API service wrapper for making authenticated requests
 */

import { AuthService } from './auth.service';
import { ConfigService } from './config.service';
import { Logger } from '../utils/logger';
import { AuthError, NetworkError, parseApiError } from '../utils/errors';

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
  retryOnAuthError?: boolean;
}

export class ApiService {
  private static instance: ApiService;
  private authService: AuthService;
  private configService: ConfigService;
  private logger: Logger;

  private constructor() {
    this.authService = AuthService.getInstance();
    this.configService = ConfigService.getInstance();
    this.logger = Logger.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  /**
   * Make an authenticated API request
   */
  public async request<T>(
    path: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { skipAuth = false, retryOnAuthError = true, ...fetchOptions } = options;
    const serverUrl = this.configService.getServerUrl();
    const url = `${serverUrl}${path}`;

    // Add authentication header if needed
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    };

    if (!skipAuth) {
      const auth = this.configService.getAuth();
      if (!auth?.accessToken) {
        throw new AuthError('Not authenticated. Please login first.');
      }
      headers['Authorization'] = `Bearer ${auth.accessToken}`;
    }

    const requestOptions: RequestInit = {
      ...fetchOptions,
      headers,
    };

    this.logger.request(requestOptions.method || 'GET', url, requestOptions.body);

    try {
      const response = await fetch(url, requestOptions);
      this.logger.response(response.status, url);

      // Handle 401 Unauthorized
      if (response.status === 401 && !skipAuth && retryOnAuthError) {
        this.logger.debug('Access token expired, attempting refresh...');
        
        try {
          await this.authService.refreshToken();
          
          // Retry request with new token
          const newAuth = this.configService.getAuth();
          if (newAuth?.accessToken) {
            headers['Authorization'] = `Bearer ${newAuth.accessToken}`;
            const retryResponse = await fetch(url, { ...requestOptions, headers });
            this.logger.response(retryResponse.status, url);
            
            if (!retryResponse.ok) {
              const error = await retryResponse.json().catch(() => ({}));
              throw new Error(parseApiError(error));
            }
            
            return await this.parseResponse<T>(retryResponse);
          }
        } catch (refreshError) {
          this.logger.error('Token refresh failed', refreshError);
          throw new AuthError('Session expired. Please login again.');
        }
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new AuthError(parseApiError(error));
        }
        throw new Error(parseApiError(error));
      }

      return await this.parseResponse<T>(response);
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError('Unable to connect to server. Please check your connection.');
      }
      throw error;
    }
  }

  /**
   * GET request
   */
  public async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  public async post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PATCH request
   */
  public async patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * DELETE request
   */
  public async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }

  /**
   * Parse response based on content type
   */
  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      const data = await response.json();
      this.logger.verbose('Response data:', data);
      return data as T;
    }
    
    if (contentType?.includes('text/')) {
      const text = await response.text();
      return text as unknown as T;
    }
    
    // Default to JSON parsing
    return await response.json() as T;
  }
}