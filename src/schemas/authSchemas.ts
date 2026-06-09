import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email('E-mail inválido').max(255),
  password: z.string().min(1, 'Senha é obrigatória').max(128),
});

export const registerSchema = z.object({
  email: z.string().trim().email('E-mail inválido').max(255),
  password: z.string().min(1, 'Senha é obrigatória').max(128),
  name: z.string().trim().min(1, 'Nome é obrigatório').max(255),
  role: z.enum(['ADMIN', 'SUPERVISOR', 'AGENT']).optional(),
  sectorIds: z.array(z.string().min(1)).optional(),
});
