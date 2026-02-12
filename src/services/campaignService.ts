import prisma from '../config/database';
import { MessageService } from './messageService';
import { CampaignStatus, MessageType } from '@prisma/client';

const messageService = new MessageService();

export class CampaignService {
  async createCampaign(data: {
    name: string;
    description?: string;
    channelId: string;
    userId: string;
    content: string;
    messageType?: string;
    mediaUrl?: string;
    fileName?: string;
    caption?: string;
    scheduledFor?: Date | null;
  }) {
    const campaign = await prisma.campaign.create({
      data: {
        name: data.name,
        description: data.description || null,
        channelId: data.channelId,
        userId: data.userId,
        content: data.content,
        messageType: (data.messageType as any) || 'TEXT',
        mediaUrl: data.mediaUrl || null,
        fileName: data.fileName || null,
        caption: data.caption || null,
        scheduledFor: data.scheduledFor || null,
      },
    });

    return campaign;
  }

  async getCampaigns() {
    return prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async getCampaignById(id: string) {
    return prisma.campaign.findUnique({
      where: { id },
      include: {
        recipients: {
          take: 50,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async updateCampaign(id: string, data: Partial<{
    name: string;
    description?: string;
    status?: CampaignStatus;
    content?: string;
    messageType?: MessageType;
    mediaUrl?: string;
    fileName?: string;
    caption?: string;
    scheduledFor?: Date | null;
  }>) {
    return prisma.campaign.update({
      where: { id },
      data,
    });
  }

  async deleteCampaign(id: string) {
    await prisma.campaign.delete({
      where: { id },
    });
  }

  /**
   * Adiciona destinatários à campanha a partir de uma lista de contatos
   */
  async addRecipients(campaignId: string, contactIds: string[]) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new Error('Campanha não encontrada');
    }

    if (contactIds.length === 0) {
      return campaign;
    }

    // Buscar contatos válidos
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: contactIds },
      },
    });

    let createdCount = 0;

    for (const contact of contacts) {
      try {
        await prisma.campaignRecipient.create({
          data: {
            campaignId,
            contactId: contact.id,
          },
        });
        createdCount++;
      } catch (e: any) {
        // Ignorar duplicatas (unique constraint campaignId+contactId)
        if (!e.message?.includes('Unique constraint')) {
          console.error('Erro ao adicionar destinatário à campanha:', e);
        }
      }
    }

    // Atualizar contagem total de destinatários
    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        totalRecipients: {
          increment: createdCount,
        },
      },
    });

    return updated;
  }

  /**
   * Executa uma campanha simples (BROADCAST) enviando mensagens para destinatários PENDING
   * MVP: processa de forma síncrona; depois podemos mover para um worker/fila.
   */
  async executeCampaign(campaignId: string, userId: string) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        channel: true,
        recipients: {
          where: { status: 'PENDING' },
          include: {
            contact: true,
          },
        },
      },
    });

    if (!campaign) {
      throw new Error('Campanha não encontrada');
    }

    if (campaign.recipients.length === 0) {
      throw new Error('Campanha não possui destinatários pendentes');
    }

    // Marcar campanha como SENDING
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'SENDING',
        startedAt: new Date(),
      },
    });

    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of campaign.recipients) {
      try {
        // Garantir que exista uma conversa para este contato/canal
        let conversation = await prisma.conversation.findFirst({
          where: {
            contactId: recipient.contactId,
            channelId: campaign.channelId,
          },
        });

        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: {
              channelId: campaign.channelId,
              contactId: recipient.contactId,
            },
          });
        }

        // Enviar mensagem usando MessageService
        await messageService.sendMessage({
          conversationId: conversation.id,
          userId,
          content: campaign.content,
          type: campaign.messageType,
          mediaUrl: campaign.mediaUrl || undefined,
          fileName: campaign.fileName || undefined,
          caption: campaign.caption || undefined,
        });

        // Atualizar recipient como SENT
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            conversationId: conversation.id,
          },
        });

        sentCount++;
      } catch (error: any) {
        console.error('Erro ao enviar mensagem da campanha para contato:', {
          recipientId: recipient.id,
          contactId: recipient.contactId,
          error: error.message,
        });

        failedCount++;

        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            errorMessage: error.message || 'Erro ao enviar mensagem',
          },
        });
      }
    }

    // Atualizar estatísticas da campanha
    const finalStatus = failedCount === 0 ? 'COMPLETED' : 'COMPLETED';

    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: finalStatus,
        sentCount: {
          increment: sentCount,
        },
        failedCount: {
          increment: failedCount,
        },
        completedAt: new Date(),
      },
    });

    return updatedCampaign;
  }
}


