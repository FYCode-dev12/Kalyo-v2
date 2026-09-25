import { z } from 'zod';

export const appointmentRequestSchema = z
  .object({
    requesterName: z
      .string()
      .trim()
      .min(2, { message: 'Nama minimal 2 karakter' })
      .max(100, { message: 'Nama maksimal 100 karakter' }),
    requesterEmail: z
      .string()
      .trim()
      .email({ message: 'Format email tidak valid' }),
    requesterPhone: z
      .string()
      .trim()
      .optional()
      .or(z.literal('')),
    purpose: z
      .string()
      .trim()
      .max(500, { message: 'Keperluan maksimal 500 karakter' })
      .optional()
      .or(z.literal('')),
    calendarSourceId: z.string().uuid({ message: 'Jenis kalender tidak valid' }),
    startDatetime: z
      .string()
      .refine((value) => !Number.isNaN(new Date(value).getTime()), { message: 'Waktu mulai tidak valid' }),
    endDatetime: z
      .string()
      .refine((value) => !Number.isNaN(new Date(value).getTime()), { message: 'Waktu selesai tidak valid' }),
    termsAccepted: z
      .boolean()
      .refine((val) => val === true, {
        message: 'Anda harus menyetujui Syarat & Ketentuan untuk mengajukan janji temu',
      }),
  })
  .refine(
    (data) => {
      const start = new Date(data.startDatetime);
      const end = new Date(data.endDatetime);
      return end > start;
    },
    {
      message: 'Waktu selesai harus lebih akhir dari waktu mulai',
      path: ['endDatetime'],
    }
  );

export type AppointmentRequestInput = z.infer<typeof appointmentRequestSchema>;
