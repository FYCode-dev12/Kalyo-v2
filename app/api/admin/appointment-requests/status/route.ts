import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createCalendarEvent } from '@/lib/google-calendar';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { sendAppointmentStatusEmail } from '@/lib/email';
import { writeAuditLog } from '@/lib/audit';

export async function PATCH(request: NextRequest) {
  try {
    const authenticated = await isAdminAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const id = typeof body?.id === 'string' ? body.id : '';
    const status = body?.status;
    const rejectReason = typeof body?.rejectReason === 'string' ? body.rejectReason.trim() : '';

    if (!id || !status || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    if (status === 'REJECTED' && !rejectReason) {
      return NextResponse.json({ error: 'Reject reason is required' }, { status: 400 });
    }
    if (rejectReason.length > 1000) {
      return NextResponse.json({ error: 'Reject reason is too long' }, { status: 400 });
    }

    // Get existing request
    const existingRequest = await prisma.appointmentRequest.findUnique({
      where: { id },
    });

    if (!existingRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (existingRequest.status !== 'PENDING') {
      return NextResponse.json({ error: 'Request already processed' }, { status: 400 });
    }

    // Claim the pending request atomically so two admins cannot process it twice.
    const claimed = await prisma.appointmentRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status,
        rejectReason: status === 'REJECTED' ? rejectReason : null,
      },
    });
    if (claimed.count !== 1) {
      return NextResponse.json({ error: 'Request sudah diproses oleh admin lain' }, { status: 409 });
    }

    const updatedRequest = await prisma.appointmentRequest.findUnique({ where: { id } });
    if (!updatedRequest) {
      return NextResponse.json({ error: 'Request not found after update' }, { status: 404 });
    }
    await writeAuditLog({ action: `APPOINTMENT_${status}`, entityType: 'AppointmentRequest', entityId: id, metadata: { status } });

    // Sync with Google Calendar if approved
    let calendarSynced = false;
    if (status === 'APPROVED') {
      try {
        const primaryCalendar = updatedRequest.calendarSourceId
          ? await prisma.calendarSource.findFirst({ where: { id: updatedRequest.calendarSourceId, isBookingTarget: true } })
          : await prisma.calendarSource.findFirst({ where: { isBookingTarget: true } });

        if (primaryCalendar) {
          const startIso = new Date(updatedRequest.startDatetime).toISOString();
          const endIso = new Date(updatedRequest.endDatetime).toISOString();

          const eventId = await createCalendarEvent({
            calendarId: primaryCalendar.googleCalendarId,
            summary: `${updatedRequest.requesterName} - ${updatedRequest.purpose || 'Janji Temu'}`,
            description: `Email: ${updatedRequest.requesterEmail}\nPhone: ${updatedRequest.requesterPhone}\nApproved by admin`,
            startIso,
            endIso,
          });

          await prisma.appointmentRequest.update({
            where: { id: updatedRequest.id },
            data: { googleEventId: eventId },
          });
          updatedRequest.googleEventId = eventId;
          console.log(`[Admin] Created event ${eventId} on Google Calendar for ${updatedRequest.id}`);
          calendarSynced = true;
        }
      } catch (calErr) {
        console.error('[Admin] Failed to sync with Google Calendar:', calErr);
      }
    }

    // Send Notification Email to Requester
    let emailSent = false;
    try {
      const emailResult = await sendAppointmentStatusEmail({
        to: updatedRequest.requesterEmail,
        requesterName: updatedRequest.requesterName,
        status: updatedRequest.status as 'APPROVED' | 'REJECTED',
        startDatetime: updatedRequest.startDatetime,
        endDatetime: updatedRequest.endDatetime,
        purpose: updatedRequest.purpose,
        rejectReason: updatedRequest.rejectReason,
        referenceId: updatedRequest.statusToken,
      });

      emailSent = emailResult.success;

      // Log notification in DB
      await prisma.notificationLog.create({
        data: {
          appointmentRequestId: updatedRequest.id,
          type: 'EMAIL',
          status: emailResult.success ? 'SENT' : 'FAILED',
          sentAt: new Date(),
        },
      });
    } catch (emailErr) {
      console.error('[Admin] Error sending status email:', emailErr);
    }

    return NextResponse.json({
      success: true,
      request: updatedRequest,
      calendarSynced,
      emailSent,
    });
  } catch (err) {
    console.error('[Admin] Error processing request:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
