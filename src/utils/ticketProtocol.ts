import { Prisma } from '@prisma/client';
import prisma from '../config/database';

type Tx = Prisma.TransactionClient;

const PROTOCOL_MAX = 9999;

/**
 * Gera o próximo protocolo de atendimento (4 dígitos, ex.: 0001, 1111).
 */
export async function generateTicketProtocol(tx: Tx = prisma): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ max: number | null }>>`
    SELECT MAX(CAST("protocol" AS INTEGER)) AS max
    FROM "Ticket"
    WHERE "protocol" ~ '^[0-9]{4}$'
  `;

  const currentMax = rows[0]?.max ?? 0;
  if (currentMax >= PROTOCOL_MAX) {
    throw new Error('Limite de protocolos atingido (9999). Encerre tickets antigos ou contate o administrador.');
  }

  return String(currentMax + 1).padStart(4, '0');
}
