import { randomBytes } from 'node:crypto';
import { Redis } from 'ioredis';
import jwt from 'jsonwebtoken';
import { config, jwtConfig } from '@/config';
import type { TokenPayload } from '@/types';

export class JWTService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(config.REDIS_URL);
  }

  generateTokenPair(payload: Omit<TokenPayload, 'iat' | 'exp'>) {
    const accessToken = jwt.sign(payload as any, jwtConfig.access.secret, {
      expiresIn: jwtConfig.access.expiresIn,
    } as any);

    const refreshToken = jwt.sign(payload as any, jwtConfig.refresh.secret, {
      expiresIn: jwtConfig.refresh.expiresIn,
    } as any);

    return { accessToken, refreshToken };
  }

  verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, jwtConfig.access.secret) as TokenPayload;
    } catch (_error) {
      throw new Error('Invalid access token');
    }
  }

  verifyRefreshToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, jwtConfig.refresh.secret) as TokenPayload;
    } catch (_error) {
      throw new Error('Invalid refresh token');
    }
  }

  async rotateRefreshToken(
    oldToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Verify the old token
    const payload = this.verifyRefreshToken(oldToken);

    // Check if token is blacklisted
    const isBlacklisted = await this.isTokenBlacklisted(oldToken);
    if (isBlacklisted) {
      throw new Error('Token has been revoked');
    }

    // Blacklist the old token
    await this.blacklistToken(oldToken);

    // Generate new token pair
    return this.generateTokenPair({
      sub: payload.sub,
      email: payload.email,
    });
  }

  async blacklistToken(token: string) {
    // Get token expiration time
    const decoded = jwt.decode(token) as any;
    if (!decoded || !decoded.exp) {
      return;
    }

    // Calculate TTL (time until token expires)
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);

    if (ttl > 0) {
      // Store token in Redis blacklist with TTL
      await this.redis.setex(`blacklist:${token}`, ttl, '1');
    }
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const result = await this.redis.get(`blacklist:${token}`);
    return result === '1';
  }

  // Extract token from Authorization header
  extractTokenFromHeader(authHeader?: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }

  // Generate a secure random token for other purposes (e.g., password reset)
  generateSecureToken(length = 32): string {
    return randomBytes(length).toString('hex');
  }

  async cleanup() {
    await this.redis.quit();
  }
}

// Singleton instance
export const jwtService = new JWTService();
