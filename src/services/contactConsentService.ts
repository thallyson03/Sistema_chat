import prisma from '../config/database';
import { auditLogService } from './auditLogService';

export interface RecordConsentInput {
  contactId: string;
  purpose: string;
  legalBasis: string;
  granted?: boolean;
  source?: string;
  recordedById?: string;
}

export class ContactConsentService {
  async recordConsent(input: RecordConsentInput) {
    const contact = await prisma.contact.findUnique({ where: { id: input.contactId } });
    if (!contact) {
      throw new Error('Contato não encontrado');
    }

    const granted = input.granted !== false;
    const consent = await prisma.contactConsent.create({
      data: {
        contactId: input.contactId,
        purpose: input.purpose,
        legalBasis: input.legalBasis,
        granted,
        source: input.source || 'manual',
        recordedById: input.recordedById || null,
        revokedAt: granted ? null : new Date(),
      },
    });

    await auditLogService.log({
      userId: input.recordedById,
      action: 'RECORD_CONSENT',
      resource: 'contact',
      resourceId: input.contactId,
      metadata: { purpose: input.purpose, granted },
    });

    return consent;
  }

  async revokeConsent(consentId: string, actorUserId?: string) {
    const consent = await prisma.contactConsent.findUnique({ where: { id: consentId } });
    if (!consent) {
      throw new Error('Registro de consentimento não encontrado');
    }

    const updated = await prisma.contactConsent.update({
      where: { id: consentId },
      data: {
        granted: false,
        revokedAt: new Date(),
      },
    });

    await auditLogService.log({
      userId: actorUserId,
      action: 'REVOKE_CONSENT',
      resource: 'contact',
      resourceId: consent.contactId,
      metadata: { consentId, purpose: consent.purpose },
    });

    return updated;
  }

  async listConsents(contactId: string) {
    return prisma.contactConsent.findMany({
      where: { contactId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const contactConsentService = new ContactConsentService();
