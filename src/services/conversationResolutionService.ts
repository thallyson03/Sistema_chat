import prisma from '../config/database';
import { Channel, Conversation, ConversationStatus, Prisma } from '@prisma/client';
import { buildChannelSnapshot, snapshotToPrismaJson } from '../utils/channelSnapshot';
import { dispatchJourneyEvent } from './journeyEventDispatcher';

const ACTIVE_STATUSES: ConversationStatus[] = [
  ConversationStatus.OPEN,
  ConversationStatus.WAITING,
];

const REOPENABLE_STATUSES: ConversationStatus[] = [
  ConversationStatus.CLOSED,
  ConversationStatus.ARCHIVED,
];

export interface ResolveConversationOptions {
  sectorId?: string | null;
  reopenIfClosed?: boolean;
  initialUnread?: number;
  lastMessageAt?: Date;
  lastCustomerMessageAt?: Date;
}

export class ConversationResolutionService {
  async resolveOpenConversation(
    contactId: string,
    channel: Channel,
    options: ResolveConversationOptions = {},
  ): Promise<{ conversation: Conversation; created: boolean; reopened: boolean }> {
    const reopenIfClosed = options.reopenIfClosed !== false;

    const active = await prisma.conversation.findFirst({
      where: {
        contactId,
        channelId: channel.id,
        status: { in: ACTIVE_STATUSES },
      },
    });

    if (active) {
      return { conversation: active, created: false, reopened: false };
    }

    if (reopenIfClosed) {
      const closed = await prisma.conversation.findFirst({
        where: {
          contactId,
          channelId: channel.id,
          status: { in: REOPENABLE_STATUSES },
        },
        orderBy: { lastMessageAt: 'desc' },
      });

      if (closed) {
        const conversation = await prisma.conversation.update({
          where: { id: closed.id },
          data: {
            status: ConversationStatus.OPEN,
            ...(options.lastMessageAt ? { lastMessageAt: options.lastMessageAt } : {}),
            ...(options.lastCustomerMessageAt
              ? { lastCustomerMessageAt: options.lastCustomerMessageAt }
              : {}),
            ...(options.initialUnread
              ? { unreadCount: { increment: options.initialUnread } }
              : {}),
          },
        });
        return { conversation, created: false, reopened: true };
      }
    }

    const snapshot = buildChannelSnapshot(channel);
    const conversation = await prisma.conversation.create({
      data: {
        contactId,
        channelId: channel.id,
        channelSnapshot: snapshotToPrismaJson(snapshot),
        status: ConversationStatus.OPEN,
        sectorId: options.sectorId ?? channel.sectorId ?? null,
        unreadCount: options.initialUnread ?? 0,
        lastMessageAt: options.lastMessageAt ?? null,
        lastCustomerMessageAt: options.lastCustomerMessageAt ?? null,
      },
    });

    await dispatchJourneyEvent('conversation_created', {
      contactId,
      channelId: channel.id,
      conversationId: conversation.id,
    });

    return { conversation, created: true, reopened: false };
  }

  async ensureChannelSnapshot(conversationId: string, channel: Channel) {
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { channelSnapshot: true },
    });
    if (conv?.channelSnapshot) return;
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        channelSnapshot: snapshotToPrismaJson(buildChannelSnapshot(channel)),
      },
    });
  }

  async getContactConversations(contactId: string) {
    return prisma.conversation.findMany({
      where: { contactId },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
          },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { content: true, createdAt: true },
        },
      },
    });
  }
}

export const conversationResolutionService = new ConversationResolutionService();
