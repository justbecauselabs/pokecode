import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { AuthenticationError } from '@/types';
import { jwtService } from '@/utils/jwt';

export class AuthService {
  async register(email: string, password: string, name?: string) {
    // Check if user exists
    const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) {
      throw new AuthenticationError('Email already registered');
    }

    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);

    const [user] = await db
      .insert(users)
      .values({
        id: userId,
        email,
        name: name || email.split('@')[0],
        passwordHash,
      })
      .returning();

    const { accessToken, refreshToken } = jwtService.generateTokenPair({
      sub: user.id,
      email: user.email,
    });

    await db
      .update(users)
      .set({
        refreshToken,
        lastLoginAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  async login(email: string, _password: string) {
    // Verify user exists and password matches
    const user = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (!user || !user.passwordHash) {
      throw new AuthenticationError('Invalid email or password');
    }
    const ok = await bcrypt.compare(_password, user.passwordHash);
    if (!ok) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Generate token pair
    const { accessToken, refreshToken } = jwtService.generateTokenPair({
      sub: user.id,
      email: user.email,
    });

    // Update user's refresh token
    await db
      .update(users)
      .set({
        refreshToken,
        lastLoginAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  async refresh(refreshToken: string) {
    // Verify refresh token
    let payload: import('@/types').TokenPayload;
    try {
      payload = jwtService.verifyRefreshToken(refreshToken);
    } catch (_error) {
      throw new AuthenticationError('Invalid refresh token');
    }

    // Check if token matches user's stored token
    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.sub),
    });

    if (!user || user.refreshToken !== refreshToken) {
      throw new AuthenticationError('Invalid refresh token');
    }

    // Rotate tokens
    const tokens = await jwtService.rotateRefreshToken(refreshToken);

    // Update user's refresh token
    await db
      .update(users)
      .set({
        refreshToken: tokens.refreshToken,
        lastLoginAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return tokens;
  }

  async logout(userId: string, accessToken: string) {
    // Blacklist the access token
    await jwtService.blacklistToken(accessToken);

    // Clear user's refresh token
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (user?.refreshToken) {
      await jwtService.blacklistToken(user.refreshToken);
      await db.update(users).set({ refreshToken: null }).where(eq(users.id, userId));
    }

    return { success: true };
  }

  async getUser(userId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }
}

export const authService = new AuthService();
