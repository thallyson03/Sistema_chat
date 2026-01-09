import prisma from '../config/database';
import { MessageType, MessageStatus } from '@prisma/client';
import evolutionApi from '../config/evolutionApi';

export interface SendMessageData {
  conversationId: string;
  userId: string;
  content: string;
  type?: string;
}

export class MessageService {
  async sendMessage(data: SendMessageData) {
    // Buscar conversa com canal e contato
    const conversation = await prisma.conversation.findUnique({
      where: { id: data.conversationId },
      include: {
        channel: true,
        contact: true,
      },
    });

    if (!conversation) {
      throw new Error('Conversa não encontrada');
    }

    // Se for WhatsApp e tiver instância configurada, enviar via Evolution API
    let externalId: string | null = null;
    let status: MessageStatus = MessageStatus.SENT;

    if (
      conversation.channel.type === 'WHATSAPP' &&
      conversation.channel.evolutionInstanceId &&
      conversation.channel.evolutionApiKey &&
      conversation.contact.phone
    ) {
      try {
        console.log('📤 Enviando mensagem via Evolution API...');
        console.log('Instância:', conversation.channel.evolutionInstanceId);
        console.log('API Key presente:', !!conversation.channel.evolutionApiKey);
        console.log('Instance Token presente:', !!conversation.channel.evolutionInstanceToken);
        console.log('Telefone original:', conversation.contact.phone);
        
        // Formatar telefone corretamente
        let phone = conversation.contact.phone.replace(/\D/g, ''); // Remove caracteres não numéricos
        
        // Se não começar com código do país, adicionar 55 (Brasil)
        if (!phone.startsWith('55') && phone.length <= 11) {
          phone = `55${phone}`;
        }
        
        // Formato para WhatsApp: número@s.whatsapp.net
        const whatsappNumber = `${phone}@s.whatsapp.net`;
        console.log('Número formatado:', whatsappNumber);
        console.log('Conteúdo:', data.content.substring(0, 50));
        
        const evolutionResponse = await evolutionApi.sendMessage(
          conversation.channel.evolutionInstanceId,
          whatsappNumber,
          data.content,
          conversation.channel.evolutionApiKey
        );

        console.log('✅ Mensagem enviada com sucesso:', evolutionResponse);
        externalId = evolutionResponse.key?.id || evolutionResponse.id || null;
        status = MessageStatus.SENT;
      } catch (error: any) {
        console.error('❌ Erro ao enviar mensagem via Evolution API:', error.message);
        console.error('Stack:', error.stack?.substring(0, 500));
        if (error.response) {
          console.error('Status:', error.response.status);
          console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
          console.error('Data:', JSON.stringify(error.response.data, null, 2));
        }
        // Continua salvando a mensagem mesmo se falhar o envio
        status = MessageStatus.FAILED;
        // Não re-throw aqui - vamos salvar a mensagem mesmo com falha no envio
        console.warn('⚠️ Mensagem será salva mesmo com falha no envio via Evolution API');
      }
    } else {
      const reasons = [];
      if (conversation.channel.type !== 'WHATSAPP') reasons.push('não é WhatsApp');
      if (!conversation.channel.evolutionInstanceId) reasons.push('sem instanceId');
      if (!conversation.channel.evolutionApiKey) reasons.push('sem API key');
      if (!conversation.contact.phone) reasons.push('sem telefone do contato');
      console.log('ℹ️ Mensagem não será enviada via Evolution API:', reasons.join(', '));
    }

    const message = await prisma.message.create({
      data: {
        conversationId: data.conversationId,
        userId: data.userId,
        content: data.content,
        type: (data.type as MessageType) || MessageType.TEXT,
        status: status,
        externalId: externalId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Atualizar última mensagem da conversa
    await prisma.conversation.update({
      where: { id: data.conversationId },
      data: {
        lastMessageAt: new Date(),
      },
    });

    return message;
  }

  async getMessagesByConversation(conversationId: string, limit: number, offset: number) {
    return await prisma.message.findMany({
      where: { conversationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });
  }

  async markConversationAsRead(conversationId: string, userId: string) {
    // Atualizar contador de não lidas
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        unreadCount: 0,
      },
    });
  }
}
