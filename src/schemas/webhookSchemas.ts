import { z } from 'zod';

const webhookBaseFields = {
  name: z.string().trim().min(1, 'Nome é obrigatório').max(255),
  url: z.string().url('URL inválida').max(2048),
  events: z.array(z.string().trim().min(1)).min(1, 'Informe ao menos um evento'),
  secret: z.string().max(512).optional(),
  channelId: z.string().min(1).optional(),
  autoCloseEnabled: z.boolean().optional(),
  autoCloseAfterMinutes: z.number().int().positive().nullable().optional(),
  autoCloseMessage: z.string().max(2000).nullable().optional(),
};

export const registerWebhookSchema = z.object(webhookBaseFields);

export const updateWebhookSchema = z
  .object({
    ...webhookBaseFields,
    name: webhookBaseFields.name.optional(),
    url: webhookBaseFields.url.optional(),
    events: webhookBaseFields.events.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualizar',
  });
