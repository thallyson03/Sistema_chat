import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import * as ceapdesk from '../services/ceapdeskDashboardService';

const router = Router();

function queryFromReq(req: AuthRequest): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(req.query)) {
    if (Array.isArray(v)) {
      out[k] = v[0] !== undefined ? String(v[0]) : undefined;
    } else if (v !== undefined) {
      out[k] = String(v);
    }
  }
  return out;
}

function requireUser(req: AuthRequest, res: Response): req is AuthRequest & { user: { id: string; role: string } } {
  if (!req.user?.id) {
    res.status(401).json({ error: 'Não autenticado' });
    return false;
  }
  return true;
}

router.get('/enabled', authenticateToken, (req: AuthRequest, res: Response) => {
  res.json({ enabled: ceapdesk.isCeapdeskDashboardEnabled() });
});

router.get('/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireUser(req, res)) return;
    if (!ceapdesk.isCeapdeskDashboardEnabled()) {
      return res.status(503).json({ error: 'Dashboard CEAPDesk desabilitado' });
    }
    const data = await ceapdesk.fetchAnalyticsStats(req.user, queryFromReq(req));
    res.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro ao consultar CEAPDesk';
    console.error('[externalDashboard/stats]', msg);
    res.status(500).json({ error: msg });
  }
});

router.get('/dashboard-completo', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireUser(req, res)) return;
    if (!ceapdesk.isCeapdeskDashboardEnabled()) {
      return res.status(503).json({ error: 'Dashboard CEAPDesk desabilitado' });
    }
    const data = await ceapdesk.fetchDashboardCompleto(req.user, queryFromReq(req));
    res.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro ao consultar CEAPDesk';
    console.error('[externalDashboard/dashboard-completo]', msg);
    res.status(500).json({ error: msg });
  }
});

router.get('/productivity', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireUser(req, res)) return;
    if (!ceapdesk.isCeapdeskDashboardEnabled()) {
      return res.status(503).json({ error: 'Dashboard CEAPDesk desabilitado' });
    }
    const data = await ceapdesk.fetchProductivity(req.user, queryFromReq(req));
    res.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro ao consultar CEAPDesk';
    console.error('[externalDashboard/productivity]', msg);
    res.status(500).json({ error: msg });
  }
});

router.get('/usuarios-performance', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireUser(req, res)) return;
    if (!ceapdesk.isCeapdeskDashboardEnabled()) {
      return res.status(503).json({ error: 'Dashboard CEAPDesk desabilitado' });
    }
    const data = await ceapdesk.fetchUsuariosPerformance(req.user, queryFromReq(req));
    res.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro ao consultar CEAPDesk';
    console.error('[externalDashboard/usuarios-performance]', msg);
    res.status(500).json({ error: msg });
  }
});

router.get('/performance-setores', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireUser(req, res)) return;
    if (!ceapdesk.isCeapdeskDashboardEnabled()) {
      return res.status(503).json({ error: 'Dashboard CEAPDesk desabilitado' });
    }
    const data = await ceapdesk.fetchPerformanceSetores(req.user, queryFromReq(req));
    res.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro ao consultar CEAPDesk';
    console.error('[externalDashboard/performance-setores]', msg);
    res.status(500).json({ error: msg });
  }
});

router.get('/reports/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireUser(req, res)) return;
    if (!ceapdesk.isCeapdeskDashboardEnabled()) {
      return res.status(503).json({ error: 'Dashboard CEAPDesk desabilitado' });
    }
    const data = await ceapdesk.fetchReportsStats(req.user, queryFromReq(req));
    res.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro ao consultar CEAPDesk';
    console.error('[externalDashboard/reports/stats]', msg);
    res.status(500).json({ error: msg });
  }
});

router.get('/reports/data', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireUser(req, res)) return;
    if (!ceapdesk.isCeapdeskDashboardEnabled()) {
      return res.status(503).json({ error: 'Dashboard CEAPDesk desabilitado' });
    }
    const data = await ceapdesk.fetchReportsData(req.user, queryFromReq(req));
    res.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro ao consultar CEAPDesk';
    console.error('[externalDashboard/reports/data]', msg);
    res.status(500).json({ error: msg });
  }
});

export default router;
