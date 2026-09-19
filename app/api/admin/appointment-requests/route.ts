import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated } from '@/lib/admin-auth';

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 100;
const VALID_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

export async function GET(request: NextRequest) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = new URL(request.url).searchParams;
    const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);
    const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number.parseInt(params.get('pageSize') || String(PAGE_SIZE_DEFAULT), 10) || PAGE_SIZE_DEFAULT));
    const query = params.get('q')?.trim() || '';
    const statusParam = params.get('status');
    const status = VALID_STATUSES.includes(statusParam as typeof VALID_STATUSES[number])
      ? statusParam as typeof VALID_STATUSES[number]
      : undefined;

    const where = {
      ...(status ? { status } : {}),
      ...(query ? {
        OR: [
          { requesterName: { contains: query, mode: 'insensitive' as const } },
          { requesterEmail: { contains: query, mode: 'insensitive' as const } },
          { purpose: { contains: query, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    const [requests, total, pending, approved, rejected] = await prisma.$transaction([
      prisma.appointmentRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.appointmentRequest.count({ where }),
      prisma.appointmentRequest.count({ where: { status: 'PENDING' } }),
      prisma.appointmentRequest.count({ where: { status: 'APPROVED' } }),
      prisma.appointmentRequest.count({ where: { status: 'REJECTED' } }),
    ]);
    const counts = { ALL: pending + approved + rejected, PENDING: pending, APPROVED: approved, REJECTED: rejected };

    return NextResponse.json({
      data: requests,
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), counts },
    });
  } catch (err: unknown) {
    console.error('[API /api/admin/appointment-requests] Error:', err);
    return NextResponse.json({ error: 'Gagal mengambil data permintaan janji temu.' }, { status: 500 });
  }
}
