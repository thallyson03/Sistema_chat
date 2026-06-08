import prisma from '../config/database';
import { auditLogService } from './auditLogService';

export class ContactPrivacyService {
  async anonymizeContact(contactId: string, actorUserId?: string) {
    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact) {
      throw new Error('Contato não encontrado');
    }

    const anonymizedPhone = `anon-${contactId.slice(0, 12)}`;
    const anonymizedEmail = `anon-${contactId.slice(0, 8)}@removed.local`;

    await prisma.$transaction(async (tx) => {
      await tx.contact.update({
        where: { id: contactId },
        data: {
          name: 'Contato removido',
          phone: anonymizedPhone,
          email: anonymizedEmail,
          profilePicture: null,
          metadata: { anonymizedAt: new Date().toISOString(), reason: 'lgpd_erasure' },
        },
      });

      await tx.message.updateMany({
        where: { conversation: { contactId } },
        data: {
          content: '[conteúdo removido]',
          metadata: { anonymized: true },
        },
      });
    });

    await auditLogService.log({
      userId: actorUserId,
      action: 'ANONYMIZE_CONTACT',
      resource: 'contact',
      resourceId: contactId,
    });

    return { ok: true, contactId };
  }

  async deleteContact(contactId: string, actorUserId?: string) {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: { _count: { select: { conversations: true, deals: true } } },
    });
    if (!contact) {
      throw new Error('Contato não encontrado');
    }

    if (contact._count.conversations > 0 || contact._count.deals > 0) {
      throw new Error(
        'Contato possui conversas ou negócios vinculados. Use anonimização em vez de exclusão direta.',
      );
    }

    await prisma.contact.delete({ where: { id: contactId } });

    await auditLogService.log({
      userId: actorUserId,
      action: 'DELETE_CONTACT',
      resource: 'contact',
      resourceId: contactId,
    });

    return { ok: true, contactId };
  }
}

export const contactPrivacyService = new ContactPrivacyService();
