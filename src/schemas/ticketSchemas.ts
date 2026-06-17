import { z } from 'zod';

const ticketStatusSchema = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);
const prioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

export const createTicketSchema = z.object({
  conversationId: z.string().trim().min(1, 'Conversa é obrigatória'),
  title: z.string().trim().min(1, 'Título é obrigatório').max(255),
  description: z.string().max(10000).optional().nullable(),
  priority: prioritySchema.optional(),
  assignedToId: z.string().trim().min(1).optional().nullable(),
});

export const updateTicketSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().max(10000).optional().nullable(),
  priority: prioritySchema.optional(),
  status: ticketStatusSchema.optional(),
  assignedToId: z.string().trim().min(1).optional().nullable(),
});

export const assignTicketSchema = z.object({
  assignedToId: z.string().trim().min(1).optional().nullable(),
});

export const closeTicketSchema = z.object({
  resolutionNote: z.string().max(5000).optional().nullable(),
});
