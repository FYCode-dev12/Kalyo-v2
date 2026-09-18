import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

interface MonthlyTrendRow {
  month: string | Date;
  total: number | string;
  approved: number | string;
  pending: number | string;
  rejected: number | string;
}

interface TopUserRow {
  requesterEmail: string;
  total_requests: number | string;
  approved_requests: number | string;
}

interface PeakHourRow {
  hour: number | string;
  count: number | string;
}

interface PeakDayRow {
  day_name: string;
  day_of_week: number | string;
  count: number | string;
}

interface RevenueRow {
  total_revenue: number | string | null;
}

/**
 * Analytics API
 * Returns aggregated statistics for admin dashboard
 */

export async function GET(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = new Map();
  cookieHeader.split(';').forEach((pair) => {
    const [key, value] = pair.split('=');
    if (key && value) cookies.set(key.trim(), value);
  });

  const authCookie = cookies.get('admin_session');
  if (!authCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const last6Months = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    const totalAppointments = await prisma.appointmentRequest.count();

    const statusCounts = await prisma.appointmentRequest.groupBy({
      by: ['status'],
      _count: true,
    });

    const monthlyTrendsRaw = await prisma.$queryRaw<MonthlyTrendRow[]>`
      SELECT 
        DATE_TRUNC('month', "startDatetime")::date as month,
        COUNT(*)::int as total,
        SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END)::int as approved,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END)::int as pending,
        SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END)::int as rejected
      FROM "AppointmentRequest"
      WHERE "startDatetime" >= ${last6Months}
      GROUP BY DATE_TRUNC('month', "startDatetime")::date
      ORDER BY month DESC
    `;

    const monthlyTrends = monthlyTrendsRaw.map((t) => ({
      month: t.month,
      total: Number(t.total),
      approved: Number(t.approved),
      pending: Number(t.pending),
      rejected: Number(t.rejected),
    }));

    const topUsersRaw = await prisma.$queryRaw<TopUserRow[]>`
      SELECT 
        "requesterEmail",
        COUNT(*)::int as total_requests,
        SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END)::int as approved_requests
      FROM "AppointmentRequest"
      WHERE "createdAt" >= ${new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)}
        AND "requesterEmail" IS NOT NULL
      GROUP BY "requesterEmail"
      ORDER BY total_requests DESC
      LIMIT 10
    `;

    const topUsers = topUsersRaw.map((u) => ({
      email: u.requesterEmail,
      totalRequests: Number(u.total_requests),
      approvedRequests: Number(u.approved_requests),
    }));

    const peakHoursRaw = await prisma.$queryRaw<PeakHourRow[]>`
      SELECT 
        EXTRACT(HOUR FROM "startDatetime")::int as hour,
        COUNT(*)::int as count
      FROM "AppointmentRequest"
      WHERE "startDatetime" >= ${new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)}
      GROUP BY EXTRACT(HOUR FROM "startDatetime")::int
      ORDER BY count DESC
    `;

    const peakHours = peakHoursRaw.map((h) => ({
      hour: Number(h.hour),
      count: Number(h.count),
    }));

    const peakDaysRaw = await prisma.$queryRaw<PeakDayRow[]>`
      SELECT 
        TO_CHAR("startDatetime", 'Day') as day_name,
        EXTRACT(DOW FROM "startDatetime")::int as day_of_week,
        COUNT(*)::int as count
      FROM "AppointmentRequest"
      WHERE "startDatetime" >= ${new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)}
      GROUP BY TO_CHAR("startDatetime", 'Day'), EXTRACT(DOW FROM "startDatetime")
      ORDER BY count DESC
      LIMIT 7
    `;

    const peakDays = peakDaysRaw.map((d) => ({
      dayName: d.day_name.trim(),
      dayOfWeek: Number(d.day_of_week),
      count: Number(d.count),
    }));

    const revenueRaw = await prisma.$queryRaw<RevenueRow[]>`
      SELECT 
        SUM(CASE WHEN status = 'APPROVED' THEN 150000 ELSE 0 END)::int as total_revenue
      FROM "AppointmentRequest"
      WHERE "startDatetime" >= ${thisMonth}
    `;

    const estimatedRevenue = Number(revenueRaw[0]?.total_revenue || 0);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalAppointments,
          pending: statusCounts.find((s) => s.status === 'PENDING')?._count || 0,
          approved: statusCounts.find((s) => s.status === 'APPROVED')?._count || 0,
          rejected: statusCounts.find((s) => s.status === 'REJECTED')?._count || 0,
        },
        monthlyTrends,
        topUsers,
        peakHours,
        peakDays,
        estimatedRevenue,
      },
    });
  } catch (err) {
    console.error('[Analytics] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
