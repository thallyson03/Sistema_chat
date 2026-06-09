import { Request } from 'express';
import { timingSafeEqualText } from './securityHelpers';

export function hasInternalMediaAccess(req: Request): boolean {
  const expected = process.env.INTERNAL_MEDIA_TOKEN;
  if (!expected) return false;
  const provided = String(req.headers['x-internal-media-token'] || '').trim();
  return !!provided && timingSafeEqualText(provided, expected);
}
