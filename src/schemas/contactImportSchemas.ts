import { z } from 'zod';

export const contactImportBodySchema = z.object({
  channelId: z.string().trim().min(1, 'channelId é obrigatório'),
  listId: z.string().trim().min(1).optional(),
});
