import { z } from 'zod';

const roleSchema = z.enum(['ADMIN', 'SUPERVISOR', 'AGENT']);

export const createUserSchema = z.object({
  email: z.string().trim().email('E-mail inválido').max(255),
  password: z.string().min(1, 'Senha é obrigatória').max(128),
  name: z.string().trim().min(1, 'Nome é obrigatório').max(255),
  role: roleSchema.optional(),
  sectorIds: z.array(z.string().min(1)).optional(),
  pipelineIds: z.array(z.string().min(1)).optional(),
  channelIds: z.array(z.string().min(1)).optional(),
  isActive: z.boolean().optional(),
});

export const updateUserSchema = z.object({
  email: z.string().trim().email('E-mail inválido').max(255).optional(),
  password: z.string().min(1).max(128).optional(),
  name: z.string().trim().min(1).max(255).optional(),
  role: roleSchema.optional(),
  sectorIds: z.array(z.string().min(1)).optional(),
  pipelineIds: z.array(z.string().min(1)).optional(),
  channelIds: z.array(z.string().min(1)).optional(),
  isActive: z.boolean().optional(),
});
