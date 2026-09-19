import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated } from '@/lib/admin-auth';

function validTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [businessRule, holidays, calendars] = await prisma.$transaction([
    prisma.businessRule.findUnique({ where: { id: 'singleton' } }),
    prisma.holiday.findMany({ orderBy: { date: 'asc' } }),
    prisma.calendarSource.findMany({ orderBy: { displayName: 'asc' } }),
  ]);
  return NextResponse.json({ data: { businessRule, holidays, calendars } });
}

export async function PATCH(request: NextRequest) {
  try {
    if (!(await isAdminAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json().catch(() => null);
    const rule = body?.businessRule;
    if (!rule || !validTime(rule.workStartTime) || !validTime(rule.workEndTime) || rule.workStartTime >= rule.workEndTime) {
      return NextResponse.json({ error: 'Jam kerja tidak valid' }, { status: 400 });
    }
    if (!Array.isArray(rule.workdays) || rule.workdays.some((day: unknown) => typeof day !== 'number' || !Number.isInteger(day) || day < 0 || day > 6)) {
      return NextResponse.json({ error: 'Hari kerja tidak valid' }, { status: 400 });
    }
    const workdays = rule.workdays as number[];
    if (![rule.minNoticeHours, rule.slotDurationMin].every((value: unknown) => Number.isInteger(value) && (value as number) > 0)) {
      return NextResponse.json({ error: 'Aturan slot tidak valid' }, { status: 400 });
    }

    const updated = await prisma.businessRule.upsert({
      where: { id: 'singleton' },
      update: { workStartTime: rule.workStartTime, workEndTime: rule.workEndTime, workdays: [...new Set(workdays)], minNoticeHours: rule.minNoticeHours, slotDurationMin: rule.slotDurationMin },
      create: { id: 'singleton', workStartTime: rule.workStartTime, workEndTime: rule.workEndTime, workdays: [...new Set(workdays)], minNoticeHours: rule.minNoticeHours, slotDurationMin: rule.slotDurationMin },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[Admin settings] PATCH error:', error);
    return NextResponse.json({ error: 'Gagal menyimpan pengaturan' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdminAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json().catch(() => null);
    const date = typeof body?.date === 'string' ? body.date : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Tanggal holiday tidak valid' }, { status: 400 });
    const holiday = await prisma.holiday.upsert({ where: { date: new Date(`${date}T00:00:00Z`) }, update: { reason: typeof body.reason === 'string' ? body.reason.trim().slice(0, 200) : null }, create: { date: new Date(`${date}T00:00:00Z`), reason: typeof body.reason === 'string' ? body.reason.trim().slice(0, 200) : null } });
    return NextResponse.json({ success: true, data: holiday });
  } catch (error) {
    console.error('[Admin settings] POST error:', error);
    return NextResponse.json({ error: 'Gagal menyimpan holiday' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!(await isAdminAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Holiday id diperlukan' }, { status: 400 });
    await prisma.holiday.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin settings] DELETE error:', error);
    return NextResponse.json({ error: 'Gagal menghapus holiday' }, { status: 500 });
  }
}
