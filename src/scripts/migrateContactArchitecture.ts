/**
 * Backfill pós-migração: telefones normalizados, identities e channelSnapshot.
 *
 * Desenvolvimento: npm run migrate:contacts
 * Produção (Docker):   node dist/scripts/migrateContactArchitecture.js
 */
import { Prisma, PrismaClient } from '@prisma/client';

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

async function mergeDuplicateContacts() {
  const contacts = await prisma.contact.findMany({ orderBy: { createdAt: 'asc' } });
  const phoneToMaster = new Map<string, string>();
  let merged = 0;

  for (const c of contacts) {
    const phone = normalizePhone(c.phone);
    if (!phone) {
      console.warn(`[migrate] contato ${c.id} sem telefone válido, ignorando merge`);
      continue;
    }

    if (!phoneToMaster.has(phone)) {
      if (c.phone !== phone) {
        await prisma.contact.update({ where: { id: c.id }, data: { phone } });
      }
      phoneToMaster.set(phone, c.id);
      continue;
    }

    const masterId = phoneToMaster.get(phone)!;
    if (c.id === masterId) continue;

    console.log(`[migrate] merge ${c.id} → ${masterId} (${phone})`);
    await reassignContactFk(c.id, masterId);
    await prisma.contact.delete({ where: { id: c.id } });
    merged++;
  }

  return merged;
}

async function backfillIdentitiesFromConversations() {
  const rows = await prisma.conversation.groupBy({
    by: ['contactId', 'channelId'],
    where: { channelId: { not: null } },
  });

  let count = 0;
  for (const row of rows) {
    if (!row.channelId) continue;
    const contact = await prisma.contact.findUnique({
      where: { id: row.contactId },
      select: { id: true, phone: true },
    });
    if (!contact) continue;

    const externalId = normalizePhone(contact.phone);
    if (!externalId) continue;

    try {
      await prisma.contactChannelIdentity.upsert({
        where: {
          channelId_externalId: { channelId: row.channelId, externalId },
        },
        create: {
          contactId: contact.id,
          channelId: row.channelId,
          externalId,
          lastSeenAt: new Date(),
        },
        update: {
          contactId: contact.id,
          lastSeenAt: new Date(),
        },
      });
      count++;
    } catch (e) {
      console.warn('[migrate] identity skip', e);
    }
  }
  return count;
}

async function backfillChannelSnapshots() {
  const channels = await prisma.channel.findMany();
  const channelMap = new Map(channels.map((ch) => [ch.id, ch]));

  const conversations = await prisma.conversation.findMany({
    where: { channelSnapshot: { equals: Prisma.JsonNull } },
    select: { id: true, channelId: true },
  });

  let count = 0;
  for (const conv of conversations) {
    if (!conv.channelId) continue;
    const ch = channelMap.get(conv.channelId);
    if (!ch) continue;
    await prisma.conversation.update({
      where: { id: conv.id },
      data: { channelSnapshot: buildSnapshot(ch) as unknown as Prisma.InputJsonValue },
    });
    count++;
  }
  return count;
}

async function main() {
  console.log('[migrate] iniciando backfill pós-migração...');

  const merged = await mergeDuplicateContacts();
  console.log(`[migrate] contatos duplicados unificados: ${merged}`);

  const identities = await backfillIdentitiesFromConversations();
  console.log(`[migrate] identities garantidas: ${identities}`);

  const snapshots = await backfillChannelSnapshots();
  console.log(`[migrate] channelSnapshot preenchidos: ${snapshots}`);

  console.log('[migrate] concluído');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
