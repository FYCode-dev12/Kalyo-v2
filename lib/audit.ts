import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export async function writeAuditLog(params: {
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Prisma.InputJsonObject;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata,
      },
    });
  } catch (error) {
    console.error('[AuditLog] Failed to write audit log:', error);
  }
}
