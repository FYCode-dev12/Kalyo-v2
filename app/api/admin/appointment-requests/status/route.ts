import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createCalendarEvent, deleteCalendarEvent, fetchMergedEvents } from '@/lib/google-calendar';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { sendAppointmentStatusEmail } from '@/lib/email';
import { writeAuditLog } from '@/lib/audit';
import type { CalendarSourceConfig } from '@/types/calendar';

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
        const targetCalendar = updatedRequest.calendarSourceId
          ? await prisma.calendarSource.findFirst({ where: { id: updatedRequest.calendarSourceId, isBookingTarget: true } })
          : await prisma.calendarSource.findFirst({ where: { isBookingTarget: true } });

        if (targetCalendar) {
          const startIso = new Date(updatedRequest.startDatetime).toISOString();
          const endIso = new Date(updatedRequest.endDatetime).toISOString();

          // Re-check the target calendar for conflicts before inserting. A
          // PENDING request can coexist with a newer Google event (added
          // directly or approved after this request was created); approving
          // without this check would push a double-booking into Google.
          const calConfigs: CalendarSourceConfig[] = [{
            id: targetCalendar.id,
            googleCalendarId: targetCalendar.googleCalendarId,
            displayName: targetCalendar.displayName,
            color: targetCalendar.color,
            showTitle: true,
            showDescription: true,
            isBookingTarget: true,
          }];
          const overlapping = await fetchMergedEvents(calConfigs, new Date(startIso), new Date(endIso), 'Asia/Jakarta');
          const conflict = overlapping.some((evt) => {
            const gStart = new Date(evt.start).getTime();
            const gEnd = new Date(evt.end).getTime();
            return new Date(startIso).getTime() < gEnd && new Date(endIso).getTime() > gStart;
          });
          if (conflict) {
            // Roll back the claim: the slot is no longer free, so the request
            // must stay pending rather than become APPROVED with no event.
            await prisma.appointmentRequest.update({
              where: { id: updatedRequest.id },
              data: { status: 'PENDING', rejectReason: null },
            });
            await writeAuditLog({ action: 'APPOINTMENT_APPROVE_CONFLICT', entityType: 'AppointmentRequest', entityId: id, metadata: { status: 'PENDING' } });
            return NextResponse.json(
              { error: 'Slot waktu sudah terisi di kalender. Permintaan tetap pending.' },
              { status: 409 }
            );
          }

          const eventId = await createCalendarEvent({
            calendarId: targetCalendar.googleCalendarId,
            summary: `${updatedRequest.requesterName} - ${updatedRequest.purpose || 'Janji Temu'}`,
            description: `Email: ${updatedRequest.requesterEmail}\nPhone: ${updatedRequest.requesterPhone}\nApproved by admin`,
            startIso,
            endIso,
          });

          // Persisting googleEventId must not fail silently: if the DB write
          // throws after the event exists, the next approval attempt would not
          // find an eventId and would create a duplicate Google event. On
          // failure, delete the just-created orphan event so the state stays
          // consistent and the rollback below still applies.
          try {
            await prisma.appointmentRequest.update({
              where: { id: updatedRequest.id },
              data: { googleEventId: eventId },
            });
          } catch (persistErr) {
            console.error('[Admin] Failed to persist googleEventId, deleting orphan event:', persistErr);
            await deleteCalendarEvent(targetCalendar.googleCalendarId, eventId).catch((delErr) =>
              console.error('[Admin] Failed to delete orphan Google event:', delErr)
            );
            throw persistErr;
          }
          updatedRequest.googleEventId = eventId;
          console.log(`[Admin] Created event ${eventId} on Google Calendar for ${updatedRequest.id}`);
          calendarSynced = true;
        }
      } catch (calErr) {
        console.error('[Admin] Failed to sync with Google Calendar:', calErr);
        // Compensation: without this the record would stay APPROVED with no
        // calendar event, and no way for the admin to retry. Return it to
        // PENDING so approving again re-runs the whole sync.
        await prisma.appointmentRequest.update({
          where: { id: updatedRequest.id },
          data: { status: 'PENDING', rejectReason: null },
        }).catch((rollbackErr) => console.error('[Admin] Failed to roll back approval:', rollbackErr));
        await writeAuditLog({ action: 'APPOINTMENT_SYNC_FAILED', entityType: 'AppointmentRequest', entityId: id, metadata: { status: 'PENDING' } }).catch(() => undefined);
        return NextResponse.json(
          { error: 'Gagal sinkronisasi dengan Google Calendar. Permintaan tetap pending, silakan coba lagi.' },
          { status: 502 }
        );
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
