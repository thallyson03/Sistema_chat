import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Response } from 'express';
import prisma from '../config/database';
import { User } from '@prisma/client';
import { validatePassword } from '../utils/passwordPolicy';
import { auditLogService } from './auditLogService';
import { logger } from '../utils/logger';
import { setCsrfCookie, clearCsrfCookie } from '../middleware/csrf';
import {
  getAuthSessionEpoch,
  isRefreshTokenIssuedBeforeCutoff,
} from '../utils/authSessionEpoch';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  role?: 'ADMIN' | 'SUPERVISOR' | 'AGENT';
  sectorIds?: string[];
}

const ACCESS_TOKEN_COOKIE = 'accessToken';
const REFRESH_TOKEN_COOKIE = 'refreshToken';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Configuração JWT não encontrada');
  return secret;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getAccessExpiresIn(): string {
  return process.env.JWT_ACCESS_EXPIRES_IN || '15m';
}

function getRefreshExpiresInMs(): number {
  const raw = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  const match = raw.match(/^(\d+)([dhms])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return value * (multipliers[unit] || multipliers.d);
}

function buildCookieOptions(maxAgeMs: number) {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict' as const,
    maxAge: maxAgeMs,
    path: '/',
  };
}

function signAccessToken(user: { id: string; email: string; role: string }) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      sv: getAuthSessionEpoch(),
    },
    getJwtSecret(),
    { expiresIn: getAccessExpiresIn() } as jwt.SignOptions,
  );
}

async function createRefreshToken(userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + getRefreshExpiresInMs());

  await prisma.refreshToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  return rawToken;
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const accessMs = 15 * 60 * 1000;
  const refreshMs = getRefreshExpiresInMs();
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, buildCookieOptions(accessMs));
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, buildCookieOptions(refreshMs));
  setCsrfCookie(res);
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
  clearCsrfCookie(res);
}

export class AuthService {
  async register(data: RegisterData): Promise<User> {
    const passwordError = validatePassword(data.password);
    if (passwordError) throw new Error(passwordError);

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error('Usuário já existe com este email');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        role: data.role || 'AGENT',
        sectors: data.sectorIds && data.sectorIds.length > 0
          ? {
              create: data.sectorIds.map((sectorId) => ({
                sectorId,
              })),
            }
          : undefined,
      },
      include: {
        sectors: {
          include: {
            sector: true,
          },
        },
      },
    });

    const { password: _, sectors, ...userWithoutSensitive } = user;
    return userWithoutSensitive as User;
  }

  private getLockoutConfig() {
    return {
      maxAttempts: Number(process.env.AUTH_MAX_FAILED_ATTEMPTS || 5),
      lockoutMinutes: Number(process.env.AUTH_LOCKOUT_MINUTES || 15),
    };
  }

  async login(
    credentials: LoginCredentials,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<{ user: User; token: string; refreshToken: string }> {
    const user = await prisma.user.findUnique({
      where: { email: credentials.email },
    });

    if (!user) {
      await auditLogService.log({
        action: 'LOGIN_FAILED',
        ip: meta?.ip,
        userAgent: meta?.userAgent,
        metadata: { email: credentials.email },
      });
      throw new Error('Credenciais inválidas');
    }

    if (!user.isActive) {
      throw new Error('Usuário inativo');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new Error('Conta temporariamente bloqueada por tentativas inválidas. Tente novamente mais tarde.');
    }

    const passwordMatch = await bcrypt.compare(credentials.password, user.password);

    if (!passwordMatch) {
      const { maxAttempts, lockoutMinutes } = this.getLockoutConfig();
      const attempts = (user.failedLoginAttempts || 0) + 1;
      const shouldLock = attempts >= maxAttempts;
      const lockedUntil = shouldLock
        ? new Date(Date.now() + lockoutMinutes * 60 * 1000)
        : null;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: shouldLock ? 0 : attempts,
          lockedUntil,
        },
      });

      await auditLogService.log({
        userId: user.id,
        action: shouldLock ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED',
        ip: meta?.ip,
        userAgent: meta?.userAgent,
        metadata: { attempts },
      });

      if (shouldLock) {
        throw new Error('Conta bloqueada temporariamente por excesso de tentativas inválidas.');
      }
      throw new Error('Credenciais inválidas');
    }

    const token = signAccessToken(user);
    const refreshToken = await createRefreshToken(user.id);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastActiveAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    try {
      const { ConversationDistributionService } = await import('./conversationDistributionService');
      const distributionService = new ConversationDistributionService();
      await distributionService.redistributeUnassignedConversations();
    } catch (error) {
      logger.warn('failed to redistribute conversations on login', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await auditLogService.log({
      userId: user.id,
      action: 'LOGIN',
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    const { password, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword as User,
      token,
      refreshToken,
    };
  }

  async refreshSession(refreshTokenRaw: string): Promise<{ token: string; refreshToken: string } | null> {
    const tokenHash = hashToken(refreshTokenRaw);
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      return null;
    }

    if (isRefreshTokenIssuedBeforeCutoff(stored.createdAt)) {
      await prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
      return null;
    }

    if (!stored.user.isActive) {
      return null;
    }

    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const token = signAccessToken(stored.user);
    const refreshToken = await createRefreshToken(stored.user.id);

    return { token, refreshToken };
  }

  async revokeRefreshToken(refreshTokenRaw: string | undefined): Promise<void> {
    if (!refreshTokenRaw) return;
    const tokenHash = hashToken(refreshTokenRaw);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async touchHeartbeat(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: new Date() },
    });
  }

  async clearPresenceOnLogout(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: null },
    });
  }

  async getCurrentUser(userId: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        sectors: {
          include: {
            sector: true,
          },
        },
      },
    });

    if (!user || !user.isActive) return null;

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
