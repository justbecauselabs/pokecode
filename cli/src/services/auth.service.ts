/**
 * Authentication service for managing user authentication
 */

import type { AuthTokens, LoginRequest, RegisterRequest, User } from '../types/api';
import type { Config } from '../types';
import { ConfigService } from './config.service';
import { Logger } from '../utils/logger';
import { AuthError, NetworkError, parseApiError } from '../utils/errors';

export class AuthService {
  private static instance: AuthService;
  private config: ConfigService;
  private logger: Logger;

  private constructor() {
    this.config = ConfigService.getInstance();
    this.logger = Logger.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Login user with email and password
   */
  public async login(email: string, password: string): Promise<User> {
    const serverUrl = this.config.getServerUrl();
    const url = `${serverUrl}/api/auth/login`;
    
    this.logger.debug('Attempting login', { email });
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password } as LoginRequest),
      });

      this.logger.response(response.status, url);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new AuthError('Invalid email or password');
        }
        throw new AuthError(parseApiError(error));
      }

      const data = await response.json() as { accessToken: string; refreshToken: string; user: User };
      
      // Store tokens and user info
      this.config.setAuth({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
        },
      });

      this.logger.success('Login successful');
      return data.user;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      this.logger.error('Login failed', error);
      throw new NetworkError('Failed to connect to server');
    }
  }

  /**
   * Register new user
   */
  public async register(email: string, password: string, name?: string): Promise<User> {
    const serverUrl = this.config.getServerUrl();
    const url = `${serverUrl}/api/auth/register`;
    
    this.logger.debug('Attempting registration', { email, name });
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name } as RegisterRequest),
      });

      this.logger.response(response.status, url);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        if (response.status === 409) {
          throw new AuthError('Email already registered');
        }
        throw new AuthError(parseApiError(error));
      }

      const data = await response.json() as { accessToken: string; refreshToken: string; user: User };
      
      // Store tokens and user info
      this.config.setAuth({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
        },
      });

      this.logger.success('Registration successful');
      return data.user;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      this.logger.error('Registration failed', error);
      throw new NetworkError('Failed to connect to server');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  public async refreshToken(): Promise<AuthTokens> {
    const auth = this.config.getAuth();
    if (!auth?.refreshToken) {
      throw new AuthError('No refresh token available');
    }

    const serverUrl = this.config.getServerUrl();
    const url = `${serverUrl}/api/auth/refresh`;
    
    this.logger.debug('Refreshing access token');
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: auth.refreshToken }),
      });

      this.logger.response(response.status, url);

      if (!response.ok) {
        if (response.status === 401) {
          // Refresh token is invalid, clear auth
          this.config.clearAuth();
          throw new AuthError('Session expired. Please login again.');
        }
        const error = await response.json().catch(() => ({}));
        throw new AuthError(parseApiError(error));
      }

      const tokens = await response.json() as AuthTokens;
      
      // Update tokens
      this.config.setAuth({
        ...auth,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });

      this.logger.debug('Token refreshed successfully');
      return tokens;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      this.logger.error('Token refresh failed', error);
      throw new NetworkError('Failed to refresh token');
    }
  }

  /**
   * Logout user and clear tokens
   */
  public async logout(): Promise<void> {
    const auth = this.config.getAuth();
    if (!auth?.refreshToken) {
      // Already logged out
      this.config.clearAuth();
      return;
    }

    const serverUrl = this.config.getServerUrl();
    const url = `${serverUrl}/api/auth/logout`;
    
    this.logger.debug('Logging out');
    
    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.accessToken}`,
        },
        body: JSON.stringify({ refreshToken: auth.refreshToken }),
      });

      // Clear auth regardless of response
      this.config.clearAuth();
      this.logger.success('Logged out successfully');
    } catch (error) {
      // Clear auth even if request fails
      this.config.clearAuth();
      this.logger.warn('Logout request failed, but local session cleared');
    }
  }

  /**
   * Get current user info
   */
  public async getCurrentUser(): Promise<User> {
    const auth = this.config.getAuth();
    if (!auth?.accessToken) {
      throw new AuthError('Not authenticated');
    }

    const serverUrl = this.config.getServerUrl();
    const url = `${serverUrl}/api/auth/me`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`,
        },
      });

      if (response.status === 401) {
        // Try to refresh token
        await this.refreshToken();
        // Retry with new token
        const newAuth = this.config.getAuth();
        const retryResponse = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${newAuth?.accessToken}`,
          },
        });
        
        if (!retryResponse.ok) {
          throw new AuthError('Failed to get user info');
        }
        
        return await retryResponse.json() as User;
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new AuthError(parseApiError(error));
      }

      return await response.json() as User;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new NetworkError('Failed to get user info');
    }
  }

  /**
   * Check if user is authenticated
   */
  public isAuthenticated(): boolean {
    return this.config.isAuthenticated();
  }

  /**
   * Get stored user info
   */
  public getUser(): Config['auth'] {
    return this.config.getAuth();
  }
}