import { Router, Response } from 'express';
import { authenticateToken, AuthRequest, authorizeRoles } from '../middleware/auth';
import * as ceapdesk from '../services/ceapdeskDashboardService';
import { TtlCache } from '../utils/ttlCache';

const router = Router();
const dashboardCache = new TtlCache();

function getDashboardCacheTtlMs(): number {
  return Math.max(1000, Number(process.env.EXTERNAL_DASHBOARD_CACHE_TTL_MS) || 15_000);
}

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

function cacheKey(req: AuthRequest, routeKey: string): string {
  const qp = queryFromReq(req);
  const query = new URLSearchParams(qp as Record<string, string>).toString();
  return [routeKey, req.user?.id || 'anon', req.user?.role || 'none', query].join(':');
}

function requireUser(req: AuthRequest, res: Response): req is AuthRequest & { user: { id: string; role: string } } {
  if (!req.user?.id) {
    res.status(401).json({ error: 'Não autenticado' });
    return false;
  }
  return true;
}

router.get('/enabled', authenticateToken, authorizeRoles('ADMIN', 'SUPERVISOR'), (req: AuthRequest, res: Response) => {
  res.json({ enabled: ceapdesk.isCeapdeskDashboardEnabled() });
});

router.get('/stats', authenticateToken, authorizeRoles('ADMIN', 'SUPERVISOR'), async (req: AuthRequest, res: Response) => {
  try {
    if (!requireUser(req, res)) return;
    if (!ceapdesk.isCeapdeskDashboardEnabled()) {
      return res.status(503).json({ error: 'Dashboard CEAPDesk desabilitado' });
    }
    const data = await dashboardCache.getOrSet(
      cacheKey(req, 'external-dashboard:stats'),
      getDashboardCacheTtlMs(),
      () => ceapdesk.fetchAnalyticsStats(req.user, queryFromReq(req)),
    );
    res.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro ao consultar CEAPDesk';
    console.error('[externalDashboard/stats]', msg);
    res.status(500).json({ error: msg });
  }
});

router.get('/dashboard-completo', authenticateToken, authorizeRoles('ADMIN', 'SUPERVISOR'), async (req: AuthRequest, res: Response) => {
  try {
    if (!requireUser(req, res)) return;
    if (!ceapdesk.isCeapdeskDashboardEnabled()) {
      return res.status(503).json({ error: 'Dashboard CEAPDesk desabilitado' });
    }
    const data = await dashboardCache.getOrSet(
      cacheKey(req, 'external-dashboard:dashboard-completo'),
      getDashboardCacheTtlMs(),
      () => ceapdesk.fetchDashboardCompleto(req.user, queryFromReq(req)),
    );
    res.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro ao consultar CEAPDesk';
    console.error('[externalDashboard/dashboard-completo]', msg);
    res.status(500).json({ error: msg });
  }
});

router.get('/productivity', authenticateToken, authorizeRoles('ADMIN', 'SUPERVISOR'), async (req: AuthRequest, res: Response) => {
  try {
    if (!requireUser(req, res)) return;
    if (!ceapdesk.isCeapdeskDashboardEnabled()) {
      return res.status(503).json({ error: 'Dashboard CEAPDesk desabilitado' });
    }
    const data = await dashboardCache.getOrSet(
      cacheKey(req, 'external-dashboard:productivity'),
      getDashboardCacheTtlMs(),
      () => ceapdesk.fetchProductivity(req.user, queryFromReq(req)),
    );
    res.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro ao consultar CEAPDesk';
    console.error('[externalDashboard/productivity]', msg);
    res.status(500).json({ error: msg });
  }
});

router.get('/usuarios-performance', authenticateToken, authorizeRoles('ADMIN', 'SUPERVISOR'), async (req: AuthRequest, res: Response) => {
  try {
    if (!requireUser(req, res)) return;
    if (!ceapdesk.isCeapdeskDashboardEnabled()) {
      return res.status(503).json({ error: 'Dashboard CEAPDesk desabilitado' });
    }
    const data = await dashboardCache.getOrSet(
      cacheKey(req, 'external-dashboard:usuarios-performance'),
      getDashboardCacheTtlMs(),
      () => ceapdesk.fetchUsuariosPerformance(req.user, queryFromReq(req)),
    );
    res.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro ao consultar CEAPDesk';
    console.error('[externalDashboard/usuarios-performance]', msg);
    res.status(500).json({ error: msg });
  }
});

router.get('/performance-setores', authenticateToken, authorizeRoles('ADMIN', 'SUPERVISOR'), async (req: AuthRequest, res: Response) => {
  try {
    if (!requireUser(req, res)) return;
    if (!ceapdesk.isCeapdeskDashboardEnabled()) {
      return res.status(503).json({ error: 'Dashboard CEAPDesk desabilitado' });
    }
    const data = await dashboardCache.getOrSet(
      cacheKey(req, 'external-dashboard:performance-setores'),
      getDashboardCacheTtlMs(),
      () => ceapdesk.fetchPerformanceSetores(req.user, queryFromReq(req)),
    );
    res.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro ao consultar CEAPDesk';
    console.error('[externalDashboard/performance-setores]', msg);
    res.status(500).json({ error: msg });
  }
});

router.get('/reports/stats', authenticateToken, authorizeRoles('ADMIN', 'SUPERVISOR'), async (req: AuthRequest, res: Response) => {
  try {
    if (!requireUser(req, res)) return;
    if (!ceapdesk.isCeapdeskDashboardEnabled()) {
      return res.status(503).json({ error: 'Dashboard CEAPDesk desabilitado' });
    }
    const data = await dashboardCache.getOrSet(
      cacheKey(req, 'external-dashboard:reports-stats'),
      getDashboardCacheTtlMs(),
      () => ceapdesk.fetchReportsStats(req.user, queryFromReq(req)),
    );
    res.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro ao consultar CEAPDesk';
    console.error('[externalDashboard/reports/stats]', msg);
    res.status(500).json({ error: msg });
  }
});

router.get('/reports/data', authenticateToken, authorizeRoles('ADMIN', 'SUPERVISOR'), async (req: AuthRequest, res: Response) => {
  try {
    if (!requireUser(req, res)) return;
    if (!ceapdesk.isCeapdeskDashboardEnabled()) {
      return res.status(503).json({ error: 'Dashboard CEAPDesk desabilitado' });
    }
    const data = await dashboardCache.getOrSet(
      cacheKey(req, 'external-dashboard:reports-data'),
      getDashboardCacheTtlMs(),
      () => ceapdesk.fetchReportsData(req.user, queryFromReq(req)),
    );
    res.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro ao consultar CEAPDesk';
    console.error('[externalDashboard/reports/data]', msg);
    res.status(500).json({ error: msg });
  }
});

export default router;
