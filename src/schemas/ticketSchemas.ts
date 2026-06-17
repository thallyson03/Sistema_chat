import { z } from 'zod';

const ticketStatusSchema = z.enum(['OPEN', 'PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);
const prioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

const optionalString = z.string().trim().optional().nullable();

export const createTicketSchema = z
  .object({
    conversationId: z.string().trim().min(1).optional().nullable(),
    contactId: z.string().trim().min(1).optional().nullable(),
    requesterName: z.string().trim().min(1).max(255).optional().nullable(),
    requesterPhone: z.string().trim().max(30).optional().nullable(),
    requesterEmail: z
      .string()
      .trim()
      .email('E-mail inválido')
      .max(255)
      .optional()
      .nullable()
      .or(z.literal('')),
    sectorId: z.string().trim().min(1).optional().nullable(),
    title: z.string().trim().min(1, 'Título é obrigatório').max(255),
    description: z.string().max(10000).optional().nullable(),
    priority: prioritySchema.optional(),
    assignedToId: z.string().trim().min(1).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.conversationId) return;

    const hasRequester =
      !!data.contactId ||
      !!data.requesterName?.trim() ||
      !!data.requesterPhone?.trim();

    if (!hasRequester) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe conversa ou dados do solicitante (nome ou telefone)',
        path: ['requesterName'],
      });
    }
  });

export const updateTicketSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().max(10000).optional().nullable(),
  priority: prioritySchema.optional(),
  status: ticketStatusSchema.optional(),
  assignedToId: z.string().trim().min(1).optional().nullable(),
  requesterName: optionalString,
  requesterPhone: optionalString,
  requesterEmail: z
    .string()
    .trim()
    .email()
    .max(255)
    .optional()
    .nullable()
    .or(z.literal('')),
  sectorId: z.string().trim().min(1).optional().nullable(),
});

export const assignTicketSchema = z.object({
  assignedToId: z.string().trim().min(1).optional().nullable(),
});

export const closeTicketSchema = z.object({
  resolutionNote: z.string().max(5000).optional().nullable(),
});

export const addTicketNoteSchema = z.object({
  note: z.string().trim().min(1, 'Anotação é obrigatória').max(5000),
});
