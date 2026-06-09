import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { getCookie } from '../utils/securityHelpers';

export const CSRF_COOKIE_NAME = 'csrfToken';
const CSRF_HEADER = 'x-csrf-token';
const ACCESS_TOKEN_COOKIE = 'accessToken';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const SESSION_EXEMPT_PATH_PREFIXES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/clear-session',
  '/api/webhooks',
  '/webhooks',
  '/api/whatsapp',
  '/api/public/pipelines',
  '/health',
  '/metrics',
];

export function isSessionExemptPath(path: string): boolean {
  return SESSION_EXEMPT_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function respondSessionReloginRequired(res: Response): void {
  res.status(401).json({
    error: 'Sessão desatualizada após atualização do sistema. Faça login novamente.',
    code: 'SESSION_RELOGIN_REQUIRED',
  });
}

/**
 * Sessões emitidas antes do CSRF (deploy antigo) não podem usar a API autenticada.
 */
export function enforceModernAuthSession(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.path.startsWith('/api/')) {
    return next();
  }
  if (isSessionExemptPath(req.path)) {
    return next();
  }

  const accessToken = getCookie(req, ACCESS_TOKEN_COOKIE);
  const csrfToken = getCookie(req, CSRF_COOKIE_NAME);

  if (accessToken && !csrfToken) {
    respondSessionReloginRequired(res);
    return;
  }

  next();
}

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function setCsrfCookie(res: Response, token?: string): string {
  const value = token || generateCsrfToken();
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(CSRF_COOKIE_NAME, value, {
    httpOnly: false,
    secure: isProd,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
  return value;
}

export function clearCsrfCookie(res: Response): void {
  res.clearCookie(CSRF_COOKIE_NAME, { path: '/' });
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (!MUTATING_METHODS.has(req.method)) {
    return next();
  }

  if (isSessionExemptPath(req.path)) {
    return next();
  }

  const cookieToken = getCookie(req, CSRF_COOKIE_NAME);
  const headerToken = String(req.headers[CSRF_HEADER] || '').trim();

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    const hasAccess = getCookie(req, ACCESS_TOKEN_COOKIE);
    if (hasAccess && !cookieToken) {
      respondSessionReloginRequired(res);
      return;
    }
    res.status(403).json({
      error: 'Token CSRF inválido ou ausente',
      code: 'CSRF_INVALID',
    });
    return;
  }

  next();
}
