import prisma from '../config/database';
import { logger } from '../utils/logger';
import { contactPrivacyService } from './contactPrivacyService';
import { auditLogService } from './auditLogService';

type JobCounters = {
  scannedContacts: number;
  eligibleContacts: number;
  anonymizedContacts: number;
  scannedConversations: number;
  eligibleConversations: number;
  anonymizedMessages: number;
  purgedAuditLogs: number;
  skipped: number;
  failed: number;
};

function isEnabled(): boolean {
  return String(process.env.DATA_RETENTION_ENABLED || 'false').trim().toLowerCase() === 'true';
}

function isDryRun(): boolean {
  const raw = String(process.env.DATA_RETENTION_DRY_RUN || 'true').trim().toLowerCase();
  return raw !== 'false';
}

function contactRetentionDays(): number {
  return Math.max(30, Number(process.env.DATA_RETENTION_CONTACT_DAYS) || 365);
}

function conversationRetentionDays(): number {
  return Math.max(30, Number(process.env.DATA_RETENTION_CONVERSATION_DAYS) || 730);
}

function auditLogRetentionDays(): number {
  return Math.max(90, Number(process.env.DATA_RETENTION_AUDIT_LOG_DAYS) || 365);
}

function batchSize(): number {
  return Math.min(100, Math.max(1, Number(process.env.DATA_RETENTION_BATCH_SIZE) || 25));
}

function isAlreadyAnonymized(phone: string): boolean {
  return phone.startsWith('anon-');
}

export async function runDataRetentionJobTick(): Promise<void> {
  if (!isEnabled()) return;

  const counters: JobCounters = {
    scannedContacts: 0,
    eligibleContacts: 0,
    anonymizedContacts: 0,
    scannedConversations: 0,
    eligibleConversations: 0,
    anonymizedMessages: 0,
    purgedAuditLogs: 0,
    skipped: 0,
    failed: 0,
  };

  const dryRun = isDryRun();
  const contactCutoff = new Date(Date.now() - contactRetentionDays() * 24 * 60 * 60 * 1000);
  const conversationCutoff = new Date(Date.now() - conversationRetentionDays() * 24 * 60 * 60 * 1000);
  const auditCutoff = new Date(Date.now() - auditLogRetentionDays() * 24 * 60 * 60 * 1000);
  const limit = batchSize();

  // 1) Anonimizar contatos inativos (sem conversas/deals ativos recentes)
  const contactCandidates = await prisma.contact.findMany({
    where: {
      updatedAt: { lt: contactCutoff },
      NOT: { phone: { startsWith: 'anon-' } },
    },
    include: {
      conversations: {
        select: { id: true, status: true, lastMessageAt: true },
      },
      _count: { select: { deals: true } },
    },
    take: limit,
    orderBy: { updatedAt: 'asc' },
  });

  counters.scannedContacts = contactCandidates.length;

  for (const contact of contactCandidates) {
    try {
      if (isAlreadyAnonymized(contact.phone)) {
        counters.skipped += 1;
        continue;
      }

      const hasOpenConversation = contact.conversations.some(
        (c) => c.status === 'OPEN' || c.status === 'WAITING',
      );
      if (hasOpenConversation) {
        counters.skipped += 1;
        continue;
      }

      const lastActivity = contact.conversations.reduce<Date | null>((max, c) => {
        const at = c.lastMessageAt;
        if (!at) return max;
        return !max || at > max ? at : max;
      }, null);

      if (lastActivity && lastActivity >= contactCutoff) {
        counters.skipped += 1;
        continue;
      }

      if (contact._count.deals > 0) {
        counters.skipped += 1;
        continue;
      }

      counters.eligibleContacts += 1;

      if (dryRun) {
        logger.info('data retention dry-run contact candidate', {
          contactId: contact.id,
          updatedAt: contact.updatedAt.toISOString(),
          retentionDays: contactRetentionDays(),
        });
        continue;
      }

      await contactPrivacyService.anonymizeContact(contact.id);
      counters.anonymizedContacts += 1;
    } catch (error: unknown) {
      counters.failed += 1;
      logger.errorWithCause('data retention failed for contact', error, {
        contactId: contact.id,
      });
    }
  }

  // 2) Anonimizar conteúdo de mensagens em conversas encerradas antigas
  const conversationCandidates = await prisma.conversation.findMany({
    where: {
      status: { in: ['CLOSED', 'ARCHIVED'] },
      lastMessageAt: { lt: conversationCutoff },
    },
    select: { id: true, lastMessageAt: true },
    take: limit,
    orderBy: { lastMessageAt: 'asc' },
  });

  counters.scannedConversations = conversationCandidates.length;

  for (const conversation of conversationCandidates) {
    try {
      const pendingMessages = await prisma.message.count({
        where: {
          conversationId: conversation.id,
          NOT: { content: '[conteúdo removido]' },
        },
      });

      if (pendingMessages === 0) {
        counters.skipped += 1;
        continue;
      }

      counters.eligibleConversations += 1;

      if (dryRun) {
        logger.info('data retention dry-run conversation candidate', {
          conversationId: conversation.id,
          pendingMessages,
          retentionDays: conversationRetentionDays(),
        });
        continue;
      }

      const updated = await prisma.message.updateMany({
        where: {
          conversationId: conversation.id,
          NOT: { content: '[conteúdo removido]' },
        },
        data: {
          content: '[conteúdo removido]',
          metadata: { anonymized: true, retentionPolicy: 'conversation_closed' },
        },
      });

      counters.anonymizedMessages += updated.count;

      await auditLogService.log({
        action: 'DATA_RETENTION_CONVERSATION',
        resource: 'conversation',
        resourceId: conversation.id,
        metadata: { messagesAnonymized: updated.count },
      });
    } catch (error: unknown) {
      counters.failed += 1;
      logger.errorWithCause('data retention failed for conversation', error, {
        conversationId: conversation.id,
      });
    }
  }

  // 3) Purga de audit logs antigos
  if (dryRun) {
    const auditCount = await prisma.auditLog.count({
      where: { createdAt: { lt: auditCutoff } },
    });
    if (auditCount > 0) {
      logger.info('data retention dry-run audit log purge candidate', {
        count: auditCount,
        retentionDays: auditLogRetentionDays(),
      });
    }
  } else {
    const purgeResult = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: auditCutoff } },
    });
    counters.purgedAuditLogs = purgeResult.count;
  }

  logger.info('data retention job tick completed', {
    ...counters,
    dryRun,
    contactRetentionDays: contactRetentionDays(),
    conversationRetentionDays: conversationRetentionDays(),
    auditLogRetentionDays: auditLogRetentionDays(),
    contactCutoff: contactCutoff.toISOString(),
    conversationCutoff: conversationCutoff.toISOString(),
    auditCutoff: auditCutoff.toISOString(),
  });
}
