import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const supportedProviders = new Set(['minio', 's3', 'r2']);

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function encodeObjectKey(key: string): string {
  return key
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

class ObjectStorageService {
  private readonly provider = String(process.env.STORAGE_PROVIDER || '').trim().toLowerCase();
  private readonly bucket = String(process.env.S3_BUCKET || process.env.MINIO_BUCKET || '').trim();
  private readonly endpoint = String(process.env.S3_ENDPOINT || process.env.MINIO_ENDPOINT || '').trim();
  private readonly region = String(process.env.S3_REGION || process.env.MINIO_REGION || 'us-east-1').trim();
  private readonly accessKeyId = String(
    process.env.S3_ACCESS_KEY_ID || process.env.MINIO_ACCESS_KEY || '',
  ).trim();
  private readonly secretAccessKey = String(
    process.env.S3_SECRET_ACCESS_KEY || process.env.MINIO_SECRET_KEY || '',
  ).trim();
  private readonly forcePathStyle = isTruthy(
    process.env.S3_FORCE_PATH_STYLE || process.env.MINIO_FORCE_PATH_STYLE || 'true',
  );
  private readonly publicBaseUrl = String(process.env.MEDIA_PUBLIC_BASE_URL || '').trim();

  private client: S3Client | null = null;

  isEnabled(): boolean {
    if (!supportedProviders.has(this.provider)) return false;
    if (!this.bucket || !this.accessKeyId || !this.secretAccessKey) return false;
    if ((this.provider === 'minio' || this.provider === 'r2') && !this.endpoint) return false;
    return true;
  }

  getBucket(): string {
    return this.bucket;
  }

  buildPublicUrl(objectKey: string): string {
    const encodedKey = encodeObjectKey(objectKey);

    if (this.publicBaseUrl) {
      return `${normalizeUrl(this.publicBaseUrl)}/${encodedKey}`;
    }

    if (!this.endpoint) {
      throw new Error('[ObjectStorage] MEDIA_PUBLIC_BASE_URL ou S3_ENDPOINT é obrigatório.');
    }

    const normalizedEndpoint = normalizeUrl(this.endpoint);
    if (this.forcePathStyle) {
      return `${normalizedEndpoint}/${this.bucket}/${encodedKey}`;
    }

    // Virtual host style (útil para alguns provedores S3).
    const endpointUrl = new URL(normalizedEndpoint);
    return `${endpointUrl.protocol}//${this.bucket}.${endpointUrl.host}/${encodedKey}`;
  }

  async uploadBuffer(params: {
    objectKey: string;
    buffer: Buffer;
    contentType?: string;
    cacheControl?: string;
  }): Promise<string> {
    if (!this.isEnabled()) {
      throw new Error('[ObjectStorage] Storage não está habilitado/configurado.');
    }

    const client = this.getClient();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.objectKey,
        Body: params.buffer,
        ContentType: params.contentType || 'application/octet-stream',
        CacheControl: params.cacheControl || 'public, max-age=31536000',
      }),
    );

    return this.buildPublicUrl(params.objectKey);
  }

  private getClient(): S3Client {
    if (this.client) return this.client;

    this.client = new S3Client({
      region: this.region,
      endpoint: this.endpoint || undefined,
      forcePathStyle: this.forcePathStyle,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });

    return this.client;
  }
}

export const objectStorageService = new ObjectStorageService();
