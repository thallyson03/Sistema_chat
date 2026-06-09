import { z } from 'zod';

export const createCampaignSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(255),
  description: z.string().max(2000).optional(),
  channelId: z.string().trim().min(1, 'Canal é obrigatório'),
  content: z.string().trim().min(1, 'Conteúdo é obrigatório').max(10000),
  messageType: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT']).optional(),
  mediaUrl: z.string().url().max(2048).optional().or(z.literal('')),
  fileName: z.string().max(255).optional(),
  caption: z.string().max(2000).optional(),
  scheduledFor: z.union([z.string(), z.null()]).optional(),
});
