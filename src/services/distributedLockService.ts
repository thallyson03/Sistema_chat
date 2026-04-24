import prisma from '../config/database';
import { logger } from '../utils/logger';

export class DistributedLockService {
  async runWithPgAdvisoryLock(
    lockKey: number,
    taskName: string,
    task: () => Promise<void>,
  ): Promise<boolean> {
    try {
      const rows = await prisma.$queryRaw<Array<{ locked: boolean }>>`
        SELECT pg_try_advisory_lock(${lockKey}) AS locked
      `;
      const locked = rows?.[0]?.locked === true;
      if (!locked) {
        logger.debug('distributed lock already held; skipping task', {
          taskName,
          lockKey,
        });
        return false;
      }

      try {
        await task();
      } finally {
        await prisma.$queryRaw`SELECT pg_advisory_unlock(${lockKey})`;
      }

      return true;
    } catch (error) {
      logger.errorWithCause('distributed lock execution failed', error, {
        taskName,
        lockKey,
      });
      return false;
    }
  }
}

export const distributedLockService = new DistributedLockService();

