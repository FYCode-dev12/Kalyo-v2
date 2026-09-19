import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { sendAppointmentStatusEmail } from '@/lib/email';
import { writeAuditLog } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const id = typeof body?.id === 'string' ? body.id : '';
    if (!id) {
      return NextResponse.json({ error: 'Appointment request id is required' }, { status: 400 });
    }

    const appointment = await prisma.appointmentRequest.findUnique({ where: { id } });
    if (!appointment) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    if (appointment.status === 'PENDING') {
      return NextResponse.json({ error: 'Email hanya dapat dikirim setelah request diproses' }, { status: 400 });
    }

    const result = await sendAppointmentStatusEmail({
      to: appointment.requesterEmail,
      requesterName: appointment.requesterName,
      status: appointment.status,
      startDatetime: appointment.startDatetime,
      endDatetime: appointment.endDatetime,
      purpose: appointment.purpose,
      rejectReason: appointment.rejectReason,
      referenceId: appointment.statusToken,
    });

    await prisma.notificationLog.create({
      data: {
        appointmentRequestId: appointment.id,
        type: 'EMAIL_RETRY',
        status: result.success ? 'SENT' : 'FAILED',
        sentAt: new Date(),
      },
    });
    await writeAuditLog({ action: 'EMAIL_RETRY', entityType: 'AppointmentRequest', entityId: appointment.id, metadata: { success: result.success } });

    return NextResponse.json({
      success: result.success,
      emailSent: result.success,
      mocked: result.mocked === true,
      error: result.success ? undefined : 'Email belum terkirim. Periksa konfigurasi SMTP.',
    }, { status: result.success ? 200 : 502 });
  } catch (error) {
    console.error('[Admin] Error retrying notification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
