/**
 * Migra dados legados para Contact global + identities + channelSnapshot.
 * Executar após 20260515120000 e antes de 20260515130000:
 *   npx ts-node scripts/migrateContactArchitecture.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.length <= 11 && !digits.startsWith('55')) return `55${digits}`;
  return digits;
}

function buildSnapshot(channel: {
  id: string;
  name: string;
  type: string;
  status: string;
  config: unknown;
  evolutionInstanceId: string | null;
}) {
  const config =
    channel.config && typeof channel.config === 'object' && !Array.isArray(channel.config)
      ? (channel.config as Record<string, unknown>)
      : {};
  let provider: string | null = typeof config.provider === 'string' ? config.provider : null;
  if (!provider && channel.evolutionInstanceId) provider = 'evolution';
  return {
    channelId: channel.id,
    name: channel.name,
    type: channel.type,
    status: channel.status,
    provider,
    evolutionInstanceId: channel.evolutionInstanceId,
    phoneNumberId: typeof config.phoneNumberId === 'string' ? config.phoneNumberId : null,
    capturedAt: new Date().toISOString(),
  };
}

async function reassignContactFk(fromId: string, toId: string) {
  await prisma.conversation.updateMany({ where: { contactId: fromId }, data: { contactId: toId } });
  await prisma.deal.updateMany({ where: { contactId: fromId }, data: { contactId: toId } });
  await prisma.campaignRecipient.updateMany({ where: { contactId: fromId }, data: { contactId: toId } });
  await prisma.journeyExecution.updateMany({ where: { contactId: fromId }, data: { contactId: toId } });

  const listMembers = await prisma.contactListMember.findMany({ where: { contactId: fromId } });
  for (const m of listMembers) {
    try {
      await prisma.contactListMember.upsert({
        where: { listId_contactId: { listId: m.listId, contactId: toId } },
        create: { listId: m.listId, contactId: toId },
        update: {},
      });
    } catch {
      /* já existe */
    }
  }
  await prisma.contactListMember.deleteMany({ where: { contactId: fromId } });

  const identities = await prisma.contactChannelIdentity.findMany({ where: { contactId: fromId } });
  for (const id of identities) {
    try {
      await prisma.contactChannelIdentity.upsert({
        where: {
          channelId_externalId: { channelId: id.channelId, externalId: id.externalId },
        },
        create: {
          contactId: toId,
          channelId: id.channelId,
          externalId: id.externalId,
          provider: id.provider,
          lastSeenAt: id.lastSeenAt,
        },
        update: { contactId: toId, lastSeenAt: id.lastSeenAt ?? new Date() },
      });
    } catch {
      /* conflito */
    }
  }
  await prisma.contactChannelIdentity.deleteMany({ where: { contactId: fromId } });
}

async function main() {
  const contacts = await prisma.contact.findMany({
    orderBy: { createdAt: 'asc' },
  });

  console.log(`[migrate] ${contacts.length} contatos legados`);

  const phoneToMaster = new Map<string, string>();

  for (const c of contacts) {
    const phone =
      normalizePhone(c.phone) ||
      normalizePhone((c as { channelIdentifier?: string }).channelIdentifier);
    if (!phone) {
      console.warn(`[migrate] contato ${c.id} sem telefone válido — será removido na finalize`);
      continue;
    }

    if (!phoneToMaster.has(phone)) {
      await prisma.contact.update({ where: { id: c.id }, data: { phone } });
      phoneToMaster.set(phone, c.id);
    } else {
      const masterId = phoneToMaster.get(phone)!;
      console.log(`[migrate] merge ${c.id} → ${masterId} (${phone})`);
      await reassignContactFk(c.id, masterId);
      await prisma.contact.delete({ where: { id: c.id } });
    }

    const legacy = c as { channelId?: string | null; channelIdentifier?: string };
    if (legacy.channelId) {
      const ext =
        normalizePhone(legacy.channelIdentifier) ||
        normalizePhone(c.phone) ||
        phone;
      if (ext) {
        const masterId = phoneToMaster.get(phone)!;
        try {
          await prisma.contactChannelIdentity.upsert({
            where: {
              channelId_externalId: { channelId: legacy.channelId, externalId: ext },
            },
            create: {
              contactId: masterId,
              channelId: legacy.channelId,
              externalId: ext,
            },
            update: { contactId: masterId, lastSeenAt: new Date() },
          });
        } catch (e) {
          console.warn('[migrate] identity skip', e);
        }
      }
    }
  }

  const channels = await prisma.channel.findMany();
  const channelMap = new Map(channels.map((ch) => [ch.id, ch]));

  const conversations = await prisma.conversation.findMany({
    where: { channelSnapshot: { equals: null } as never },
  });

  let snapCount = 0;
  for (const conv of conversations) {
    if (!conv.channelId) continue;
    const ch = channelMap.get(conv.channelId);
    if (!ch) continue;
    await prisma.conversation.update({
      where: { id: conv.id },
      data: { channelSnapshot: buildSnapshot(ch) },
    });
    snapCount++;
  }

  console.log(`[migrate] ${snapCount} snapshots de canal preenchidos`);
  console.log('[migrate] concluído');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
