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

      await tx.contactChannelIdentity.updateMany({
        where: { contactId },
        data: { externalId: `anon-${contactId.slice(0, 12)}` },
      });

      await tx.deal.updateMany({
        where: { contactId },
        data: { customFields: { anonymized: true } },
      });

      await tx.message.updateMany({
        where: { conversation: { contactId } },
        data: {
          content: '[conteúdo removido]',
          metadata: { anonymized: true },
        },
      });

      await tx.contactConsent.updateMany({
        where: { contactId, granted: true },
        data: { granted: false, revokedAt: new Date() },
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

  async exportContactData(contactId: string, actorUserId?: string) {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        channelIdentities: true,
        consents: { orderBy: { createdAt: 'desc' } },
        conversations: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                content: true,
                type: true,
                createdAt: true,
                metadata: true,
              },
            },
            channel: { select: { id: true, name: true, type: true } },
          },
        },
        deals: {
          select: {
            id: true,
            name: true,
            status: true,
            value: true,
            customFields: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!contact) {
      throw new Error('Contato não encontrado');
    }

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      contact: {
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        metadata: contact.metadata,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt,
      },
      channelIdentities: contact.channelIdentities,
      consents: contact.consents,
      conversations: contact.conversations.map((conv) => ({
        id: conv.id,
        status: conv.status,
        channel: conv.channel,
        messages: conv.messages,
      })),
      deals: contact.deals,
    };

    await auditLogService.log({
      userId: actorUserId,
      action: 'EXPORT_CONTACT_DATA',
      resource: 'contact',
      resourceId: contactId,
    });

    return exportPayload;
  }
}

export const contactPrivacyService = new ContactPrivacyService();
