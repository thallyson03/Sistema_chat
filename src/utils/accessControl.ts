import prisma from '../config/database';

export interface AccessViewer {
  id: string;
  role: string;
}

export async function getUserPipelineIds(viewer: AccessViewer): Promise<string[] | null> {
  if (viewer.role === 'ADMIN' || viewer.role === 'SUPERVISOR') {
    return null;
  }

  const accesses = await prisma.userPipelineAccess.findMany({
    where: { userId: viewer.id },
    select: { pipelineId: true },
  });

  return accesses.map((a) => a.pipelineId);
}

export async function canAccessPipeline(
  viewer: AccessViewer,
  pipelineId: string,
): Promise<boolean> {
  if (viewer.role === 'ADMIN' || viewer.role === 'SUPERVISOR') return true;

  const access = await prisma.userPipelineAccess.findFirst({
    where: { userId: viewer.id, pipelineId },
  });
  return !!access;
}

export async function getUserSectorIds(viewer: AccessViewer): Promise<string[] | null> {
  if (viewer.role === 'ADMIN') return null;

  const sectors = await prisma.userSector.findMany({
    where: { userId: viewer.id },
    select: { sectorId: true },
  });

  return sectors.map((s) => s.sectorId);
}

function buildSectorContactVisibilityWhere(sectorIds: string[]) {
  return {
    OR: [
      {
        conversations: {
          some: {
            OR: [
              { sectorId: { in: sectorIds } },
              { channel: { sectorId: { in: sectorIds } } },
              {
                channel: {
                  secondarySectors: {
                    some: { sectorId: { in: sectorIds } },
                  },
                },
              },
            ],
          },
        },
      },
      {
        channelIdentities: {
          some: {
            channel: {
              OR: [
                { sectorId: { in: sectorIds } },
                {
                  secondarySectors: {
                    some: { sectorId: { in: sectorIds } },
                  },
                },
              ],
            },
          },
        },
      },
    ],
  };
}

export async function buildContactVisibilityWhere(viewer: AccessViewer) {
  if (viewer.role === 'ADMIN') {
    return {};
  }

  const sectorIds = await getUserSectorIds(viewer);
  if (!sectorIds || sectorIds.length === 0) {
    return { id: '__no_access__' };
  }

  return buildSectorContactVisibilityWhere(sectorIds);
}

export async function isContactVisibleToViewer(
  viewer: AccessViewer,
  contactId: string,
): Promise<boolean> {
  const visibilityWhere = await buildContactVisibilityWhere(viewer);
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, ...visibilityWhere },
    select: { id: true },
  });
  return !!contact;
}

export function canSupervisorAssignRole(role: string | undefined): boolean {
  if (!role) return true;
  return role === 'AGENT' || role === 'SUPERVISOR';
}
