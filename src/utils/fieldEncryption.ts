import crypto from 'crypto';

const ENC_PREFIX = 'enc:v1:';

function getEncryptionKey(): Buffer | null {
  const raw = (process.env.CHANNEL_SECRETS_ENCRYPTION_KEY || '').trim();
  if (!raw) return null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  return crypto.createHash('sha256').update(raw).digest();
}

export function isFieldEncryptionEnabled(): boolean {
  return getEncryptionKey() !== null;
}

export function encryptField(plaintext: string | null | undefined): string | null {
  if (!plaintext) return plaintext ?? null;
  if (plaintext.startsWith(ENC_PREFIX)) return plaintext;

  const key = getEncryptionKey();
  if (!key) return plaintext;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptField(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  if (!value.startsWith(ENC_PREFIX)) return value;

  const key = getEncryptionKey();
  if (!key) return value;

  const payload = value.slice(ENC_PREFIX.length);
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) return value;

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64url')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return value;
  }
}

export function encryptConfigSecrets(config: unknown): unknown {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return config;
  const secretKeys = new Set([
    'token',
    'appSecret',
    'apiKey',
    'secret',
    'webhookSecret',
    'metaAppSecret',
    'whatsappAppSecret',
    'accessToken',
  ]);
  const cloned = { ...(config as Record<string, unknown>) };
  for (const key of Object.keys(cloned)) {
    if (secretKeys.has(key) && typeof cloned[key] === 'string' && cloned[key]) {
      cloned[key] = encryptField(cloned[key] as string);
    }
  }
  return cloned;
}

export function decryptConfigSecrets(config: unknown): unknown {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return config;
  const secretKeys = new Set([
    'token',
    'appSecret',
    'apiKey',
    'secret',
    'webhookSecret',
    'metaAppSecret',
    'whatsappAppSecret',
    'accessToken',
  ]);
  const cloned = { ...(config as Record<string, unknown>) };
  for (const key of Object.keys(cloned)) {
    if (secretKeys.has(key) && typeof cloned[key] === 'string' && cloned[key]) {
      cloned[key] = decryptField(cloned[key] as string);
    }
  }
  return cloned;
}
