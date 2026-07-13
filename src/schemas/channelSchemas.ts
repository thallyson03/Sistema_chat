import { z } from 'zod';

const channelTypeSchema = z.enum(['WHATSAPP', 'TELEGRAM', 'EMAIL', 'WEBCHAT', 'VOICE']);

const channelBaseFields = {
  name: z.string().trim().min(1, 'Nome é obrigatório').max(255),
  config: z.record(z.string(), z.unknown()).optional(),
  evolutionApiKey: z.string().max(512).optional(),
  evolutionInstanceId: z.string().max(255).optional(),
  evolutionInstanceToken: z.string().max(512).optional(),
  primarySectorId: z.string().min(1).optional(),
  secondarySectorIds: z.array(z.string().min(1)).optional(),
  sectorId: z.string().min(1).optional(),
};

export const createChannelSchema = z.object({
  ...channelBaseFields,
  type: channelTypeSchema,
});

export const updateChannelSchema = z.object({
  ...channelBaseFields,
  name: channelBaseFields.name.optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Informe ao menos um campo para atualizar',
});
