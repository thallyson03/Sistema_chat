import prisma from '../config/database';
import { Channel, Contact } from '@prisma/client';
import { assertValidPhone, normalizePhone } from '../utils/phone';
import { dispatchJourneyEvent } from './journeyEventDispatcher';

export interface ResolveContactInput {
  phone: string;
  name?: string;
  channelId: string;
  externalId?: string;
  profilePicture?: string | null;
  provider?: string | null;
}

export class ContactResolutionService {
  async upsertChannelIdentity(params: {
    contactId: string;
    channelId: string;
    externalId: string;
    provider?: string | null;
  }) {
    const externalId =
      normalizePhone(params.externalId) || params.externalId.replace(/\D/g, '');
    if (externalId.length < 10) {
      throw new Error('Identificador externo inválido para o canal');
    }
    return prisma.contactChannelIdentity.upsert({
      where: {
        channelId_externalId: {
          channelId: params.channelId,
          externalId,
        },
      },
      create: {
        contactId: params.contactId,
        channelId: params.channelId,
        externalId,
        provider: params.provider ?? null,
        lastSeenAt: new Date(),
      },
      update: {
        contactId: params.contactId,
        lastSeenAt: new Date(),
        ...(params.provider ? { provider: params.provider } : {}),
      },
    });
  }

  async resolveContactByPhone(input: ResolveContactInput): Promise<Contact> {
    const phone = assertValidPhone(input.phone);
    const externalId = normalizePhone(input.externalId || input.phone) || phone;
    const displayName = (input.name?.trim() || phone).slice(0, 200);

    let contact = await prisma.contact.findUnique({ where: { phone } });
    let created = false;

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          phone,
          name: displayName,
          profilePicture: input.profilePicture ?? null,
          metadata: {},
        },
      });
      created = true;
    } else {
      const updateData: {
        name?: string;
        profilePicture?: string | null;
      } = {};

      if (input.profilePicture && input.profilePicture !== contact.profilePicture) {
        updateData.profilePicture = input.profilePicture;
      }
      if (input.name && input.name.trim() && input.name !== contact.name && input.name !== phone) {
        updateData.name = input.name.trim();
      }

      if (Object.keys(updateData).length > 0) {
        contact = await prisma.contact.update({
          where: { id: contact.id },
          data: updateData,
        });
      }
    }

    await this.upsertChannelIdentity({
      contactId: contact.id,
      channelId: input.channelId,
      externalId,
      provider: input.provider,
    });

    if (created) {
      await dispatchJourneyEvent('contact_created', {
        contactId: contact.id,
        channelId: input.channelId,
      });
    }

    return contact;
  }

  async findContactOnChannel(channelId: string, phoneOrExternal: string) {
    const normalized = normalizePhone(phoneOrExternal);
    if (!normalized) return null;

    const byPhone = await prisma.contact.findUnique({ where: { phone: normalized } });
    if (byPhone) return byPhone;

    const identity = await prisma.contactChannelIdentity.findFirst({
      where: {
        channelId,
        OR: [{ externalId: normalized }, { externalId: phoneOrExternal.replace(/\D/g, '') }],
      },
      include: { contact: true },
    });

    return identity?.contact ?? null;
  }

  resolveProviderFromChannel(channel: Channel): string | null {
    const config =
      channel.config && typeof channel.config === 'object' && !Array.isArray(channel.config)
        ? (channel.config as Record<string, unknown>)
        : {};
    if (typeof config.provider === 'string') return config.provider;
    if (channel.evolutionInstanceId) return 'evolution';
    return null;
  }
}

export const contactResolutionService = new ContactResolutionService();
