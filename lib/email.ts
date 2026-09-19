import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || '"KALYO Scheduling" <noreply@kalyo.app>';

export const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // true for 465, false for other ports
  auth: SMTP_USER && SMTP_PASS ? {
    user: SMTP_USER,
    pass: SMTP_PASS,
  } : undefined,
});

export async function sendAppointmentStatusEmail(params: {
  to: string;
  requesterName: string;
  status: 'APPROVED' | 'REJECTED';
  startDatetime: Date;
  endDatetime: Date;
  purpose?: string | null;
  rejectReason?: string | null;
  referenceId: string;
}) {
  const { to, requesterName, status, startDatetime, endDatetime, purpose, rejectReason, referenceId } = params;

  // Format dates in Asia/Jakarta timezone
  const startDateStr = new Date(startDatetime).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const endDateStr = new Date(endDatetime).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    timeStyle: 'short',
  });

  const isApproved = status === 'APPROVED';

  const subject = isApproved
    ? `[KALYO] Permintaan Janji Temu Disetujui (${referenceId})`
    : `[KALYO] Permintaan Janji Temu Ditolak (${referenceId})`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: ${isApproved ? '#1769aa' : '#d32f2f'}; margin-top: 0;">
        ${isApproved ? 'Janji Temu Disetujui' : 'Janji Temu Ditolak'}
      </h2>
      <p>Halo <strong>${requesterName}</strong>,</p>
      <p>
        Status permintaan janji temu Anda dengan kode referensi <code>${referenceId}</code> telah diperbarui.
      </p>

      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Waktu:</strong> ${startDateStr} - ${endDateStr} WIB</p>
        ${purpose ? `<p style="margin: 5px 0;"><strong>Keperluan:</strong> ${purpose}</p>` : ''}
        <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: ${isApproved ? '#2e7d32' : '#c62828'}; font-weight: bold;">${status}</span></p>
        ${!isApproved && rejectReason ? `<p style="margin: 5px 0; color: #d32f2f;"><strong>Alasan Penolakan:</strong> ${rejectReason}</p>` : ''}
      </div>

      ${isApproved ? `
        <p style="color: #2e7d32; font-weight: 500;">
          ✓ Acara telah ditambahkan secara otomatis ke Google Calendar penyelenggara.
        </p>
      ` : `
        <p>Silakan ajukan permintaan di jadwal waktu lain jika memungkinkan.</p>
      `}

      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #757575; margin-bottom: 0;">
        Email ini dikirim secara otomatis oleh KALYO Personal Scheduling System.
      </p>
    </div>
  `;

  if (!SMTP_USER || !SMTP_PASS) {
    console.warn(`[EmailService] SMTP credentials missing. Mocking email send to ${to}:`);
    console.log(`[EmailService] Subject: ${subject}`);
    console.log(`[EmailService] Body Preview:\n${html.replace(/<[^>]*>/g, '').slice(0, 300)}...`);
    return {
      success: false,
      mocked: true,
      error: new Error('SMTP credentials are not configured'),
    };
  }

  try {
    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html,
    });
    console.log(`[EmailService] Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[EmailService] Failed to send email to ${to}:`, err);
    return { success: false, error: err };
  }
}
