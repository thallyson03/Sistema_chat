import { z } from 'zod';

const messageTypeSchema = z.enum([
  'TEXT',
  'IMAGE',
  'VIDEO',
  'AUDIO',
  'DOCUMENT',
  'LOCATION',
  'CONTACT',
]);

const messageButtonSchema = z.object({
  id: z.string().max(128).optional(),
  text: z.string().trim().min(1).max(256),
});

export const sendMessageSchema = z
  .object({
    conversationId: z.string().trim().min(1, 'Conversa é obrigatória'),
    content: z.string().max(10000).optional(),
    type: messageTypeSchema.optional(),
    mediaUrl: z.string().url('URL de mídia inválida').max(2048).optional(),
    fileName: z.string().max(255).optional(),
    caption: z.string().max(2000).optional(),
    mimetype: z.string().max(128).optional(),
    buttons: z.array(messageButtonSchema).max(3).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (data) =>
      !!(data.content?.trim() || data.mediaUrl || (data.buttons && data.buttons.length > 0)),
    { message: 'Conteúdo, mídia ou botões são obrigatórios', path: ['content'] },
  );
