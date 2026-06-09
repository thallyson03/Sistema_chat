import { Router } from 'express';
import { PipelineController } from '../controllers/pipelineController';
import { DealController } from '../controllers/dealController';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';

const router = Router();
const pipelineController = new PipelineController();
const dealController = new DealController();

const publicPipelineLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.PUBLIC_PIPELINE_RATE_LIMIT_MAX || 120),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Muitas requisições para API pública de pipeline. Tente novamente em alguns minutos.',
  },
});

const publicPipelineReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.PUBLIC_PIPELINE_READ_RATE_LIMIT_PER_MIN || 240),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Muitas consultas públicas de pipeline. Tente novamente em instantes.',
  },
});

function timingSafeEqualText(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function optionalPublicAuth(
  req: any,
  res: any,
  next: any,
) {
  const apiKey = process.env.PUBLIC_PIPELINE_API_KEY;
  const signatureSecret = process.env.PUBLIC_PIPELINE_SIGNATURE_SECRET;

  if (!apiKey && !signatureSecret) {
    const allowInsecure = ['1', 'true', 'yes'].includes(
      String(process.env.ALLOW_INSECURE_PUBLIC_API || '').toLowerCase(),
    );
    if (allowInsecure) {
      return next();
    }
    return res.status(503).json({ error: 'API pública de pipeline não configurada' });
  }

  const headerApiKey = String(req.headers['x-api-key'] || '').trim();
  if (apiKey && headerApiKey && timingSafeEqualText(headerApiKey, apiKey)) {
    return next();
  }

  if (signatureSecret) {
    const timestamp = String(req.headers['x-signature-timestamp'] || '').trim();
    const signature = String(req.headers['x-signature'] || '').trim();
    const now = Date.now();
    const ts = Number(timestamp);
    const maxSkewMs = Number(process.env.PUBLIC_PIPELINE_SIGNATURE_MAX_SKEW_MS || 5 * 60 * 1000);

    if (!Number.isFinite(ts) || Math.abs(now - ts) > maxSkewMs) {
      return res.status(401).json({ error: 'Assinatura expirada ou timestamp inválido' });
    }

    const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body || {}));
    const payload = `${timestamp}.${rawBody.toString('utf8')}`;
    const expected = crypto.createHmac('sha256', signatureSecret).update(payload).digest('hex');

    if (signature && timingSafeEqualText(signature, expected)) {
      return next();
    }
  }

  return res.status(401).json({ error: 'Não autorizado para API pública de pipeline' });
}

// Rotas públicas para API externa
// ============================================
// GET Pipeline por ID (público)
router.get(
  '/:pipelineId',
  publicPipelineReadLimiter,
  optionalPublicAuth,
  pipelineController.getPipelineById.bind(pipelineController),
);

// POST Criar Deal via API (público)
router.post(
  '/:pipelineId/deals',
  publicPipelineLimiter,
  optionalPublicAuth,
  dealController.createDealPublic.bind(dealController),
);

export default router;





