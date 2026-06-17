-- Status PENDING (pendente) para tickets

ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'PENDING';
