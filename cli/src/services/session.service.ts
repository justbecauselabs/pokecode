/**
 * Session management service
 */

import type { Session, CreateSessionRequest, Prompt, CreatePromptRequest } from '../types/api';
import type { RecentSession } from '../types';
import { ApiService } from './api';
import { ConfigService } from './config.service';
import { Logger } from '../utils/logger';
import { SessionError } from '../utils/errors';

export class SessionService {
  private static instance: SessionService;
  private apiService: ApiService;
  private configService: ConfigService;
  private logger: Logger;
  private currentSessionId: string | null = null;

  private constructor() {
    this.apiService = ApiService.getInstance();
    this.configService = ConfigService.getInstance();
    this.logger = Logger.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }

  /**
   * Create a new session
   */
  public async createSession(projectPath: string, context?: string): Promise<Session> {
    this.logger.debug('Creating new session', { projectPath, context });

    try {
      const session = await this.apiService.post<Session>(
        '/api/claude-code/sessions',
        {
          projectPath,
          context,
          metadata: {
            client: 'cli',
            version: '1.0.0'
          }
        } as CreateSessionRequest
      );

      // Add to recent sessions
      this.configService.addRecentSession({
        id: session.id,
        projectPath: session.projectPath,
        lastUsedAt: new Date().toISOString(),
        context: session.context
      });

      this.currentSessionId = session.id;
      this.logger.success(`Session created: ${session.id}`);
      return session;
    } catch (error) {
      this.logger.error('Failed to create session', error);
      throw new SessionError('Failed to create session');
    }
  }

  /**
   * List user sessions
   */
  public async listSessions(): Promise<Session[]> {
    this.logger.debug('Fetching user sessions');

    try {
      const sessions = await this.apiService.get<Session[]>('/api/claude-code/sessions');
      this.logger.verbose(`Found ${sessions.length} sessions`);
      return sessions;
    } catch (error) {
      this.logger.error('Failed to list sessions', error);
      throw new SessionError('Failed to fetch sessions');
    }
  }

  /**
   * Get session details
   */
  public async getSession(sessionId: string): Promise<Session> {
    this.logger.debug('Fetching session details', { sessionId });

    try {
      const session = await this.apiService.get<Session>(
        `/api/claude-code/sessions/${sessionId}`
      );
      return session;
    } catch (error) {
      this.logger.error('Failed to get session', error);
      throw new SessionError('Failed to fetch session details');
    }
  }

  /**
   * Update session context or metadata
   */
  public async updateSession(
    sessionId: string,
    updates: { context?: string; status?: Session['status']; metadata?: Record<string, unknown> }
  ): Promise<Session> {
    this.logger.debug('Updating session', { sessionId, updates });

    try {
      const session = await this.apiService.patch<Session>(
        `/api/claude-code/sessions/${sessionId}`,
        updates
      );
      return session;
    } catch (error) {
      this.logger.error('Failed to update session', error);
      throw new SessionError('Failed to update session');
    }
  }

  /**
   * Delete a session
   */
  public async deleteSession(sessionId: string): Promise<void> {
    this.logger.debug('Deleting session', { sessionId });

    try {
      await this.apiService.delete(`/api/claude-code/sessions/${sessionId}`);
      
      if (this.currentSessionId === sessionId) {
        this.currentSessionId = null;
      }
      
      this.logger.success(`Session deleted: ${sessionId}`);
    } catch (error) {
      this.logger.error('Failed to delete session', error);
      throw new SessionError('Failed to delete session');
    }
  }

  /**
   * Get session history
   */
  public async getSessionHistory(sessionId: string): Promise<Prompt[]> {
    this.logger.debug('Fetching session history', { sessionId });

    try {
      const history = await this.apiService.get<Prompt[]>(
        `/api/claude-code/sessions/${sessionId}/history`
      );
      return history;
    } catch (error) {
      this.logger.error('Failed to get session history', error);
      throw new SessionError('Failed to fetch session history');
    }
  }

  /**
   * Create a new prompt in the session
   */
  public async createPrompt(sessionId: string, message: string): Promise<Prompt> {
    this.logger.debug('Creating prompt', { sessionId, message: message.substring(0, 50) + '...' });

    try {
      const prompt = await this.apiService.post<Prompt>(
        `/api/claude-code/sessions/${sessionId}/prompts`,
        { prompt: message } as CreatePromptRequest
      );
      
      this.logger.verbose(`Prompt created: ${prompt.id}`);
      return prompt;
    } catch (error) {
      this.logger.error('Failed to create prompt', error);
      
      // Pass through more specific error information
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          throw new SessionError('Authentication failed. Please check your API key configuration.');
        } else if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
          throw new SessionError('Backend server error. Please ensure the worker process is running.');
        } else if (error.message.includes('fetch') || error.message.includes('network')) {
          throw new SessionError('Cannot connect to backend server. Please check if the server is running.');
        }
        throw new SessionError(error.message);
      }
      throw new SessionError('Failed to send message');
    }
  }

  /**
   * Get prompt details
   */
  public async getPrompt(sessionId: string, promptId: string): Promise<Prompt> {
    this.logger.debug('Fetching prompt details', { sessionId, promptId });

    try {
      const prompt = await this.apiService.get<Prompt>(
        `/api/claude-code/sessions/${sessionId}/prompts/${promptId}`
      );
      return prompt;
    } catch (error) {
      this.logger.error('Failed to get prompt', error);
      throw new SessionError('Failed to fetch prompt details');
    }
  }

  /**
   * Set current session
   */
  public setCurrentSession(sessionId: string): void {
    this.currentSessionId = sessionId;
    this.logger.debug('Current session set', { sessionId });
  }

  /**
   * Get current session ID
   */
  public getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Get recent sessions from config
   */
  public getRecentSessions(): RecentSession[] {
    return this.configService.getRecentSessions();
  }

  /**
   * Resume most recent session
   */
  public async resumeRecentSession(): Promise<Session | null> {
    const recentSessions = this.getRecentSessions();
    if (recentSessions.length === 0) {
      return null;
    }

    const mostRecent = recentSessions[0];
    try {
      const session = await this.getSession(mostRecent.id);
      this.currentSessionId = session.id;
      
      // Update last used time
      this.configService.addRecentSession({
        ...mostRecent,
        lastUsedAt: new Date().toISOString()
      });
      
      return session;
    } catch (error) {
      this.logger.warn(`Failed to resume session ${mostRecent.id}`);
      return null;
    }
  }
}