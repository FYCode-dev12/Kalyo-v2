import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { appointmentRequestSchema } from '@/lib/validations/appointment';

const validInput = {
  requesterName: 'Budi Santoso',
  requesterEmail: 'budi@example.com',
  requesterPhone: '081234567890',
  purpose: 'Diskusi tugas akhir',
  calendarSourceId: '3f2b8c1e-4d5a-4b6c-9d7e-8f9a0b1c2d3e',
  startDatetime: '2026-11-09T02:00:00.000Z',
  endDatetime: '2026-11-09T02:30:00.000Z',
  termsAccepted: true,
};

/** Returns a copy of the valid input without the given fields. */
function without(...keys: (keyof typeof validInput)[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(validInput).filter(([key]) => !keys.includes(key as keyof typeof validInput)));
}

/** Parses `input` and returns the field-error map (empty when valid). */
function fieldErrors(input: Record<string, unknown>): Record<string, string[] | undefined> {
  const result = appointmentRequestSchema.safeParse(input);
  return result.success ? {} : result.error.flatten().fieldErrors;
}

describe('appointmentRequestSchema', () => {
  it('accepts a complete, valid request', () => {
    const result = appointmentRequestSchema.safeParse(validInput);
    assert.equal(result.success, true);
  });

  it('trims the name and email', () => {
    const result = appointmentRequestSchema.parse({
      ...validInput,
      requesterName: '  Budi  ',
      requesterEmail: '  budi@example.com ',
    });
    assert.equal(result.requesterName, 'Budi');
    assert.equal(result.requesterEmail, 'budi@example.com');
  });

  it('treats phone and purpose as optional (missing or empty)', () => {
    assert.equal(appointmentRequestSchema.safeParse(without('requesterPhone', 'purpose')).success, true);
    assert.equal(appointmentRequestSchema.safeParse({ ...validInput, requesterPhone: '', purpose: '' }).success, true);
  });

  it('enforces name length after trimming', () => {
    assert.deepEqual(fieldErrors({ ...validInput, requesterName: ' A ' }).requesterName, ['Nama minimal 2 karakter']);
    assert.deepEqual(fieldErrors({ ...validInput, requesterName: 'x'.repeat(101) }).requesterName, [
      'Nama maksimal 100 karakter',
    ]);
    assert.equal(appointmentRequestSchema.safeParse({ ...validInput, requesterName: 'x'.repeat(100) }).success, true);
  });

  it('rejects an invalid email', () => {
    assert.deepEqual(fieldErrors({ ...validInput, requesterEmail: 'budi@' }).requesterEmail, ['Format email tidak valid']);
  });

  it('limits purpose to 500 characters', () => {
    assert.equal(appointmentRequestSchema.safeParse({ ...validInput, purpose: 'x'.repeat(500) }).success, true);
    assert.deepEqual(fieldErrors({ ...validInput, purpose: 'x'.repeat(501) }).purpose, [
      'Keperluan maksimal 500 karakter',
    ]);
  });

  it('requires calendarSourceId to be a UUID', () => {
    assert.deepEqual(fieldErrors({ ...validInput, calendarSourceId: 'primary' }).calendarSourceId, [
      'Jenis kalender tidak valid',
    ]);
  });

  it('rejects unparseable start and end times', () => {
    assert.deepEqual(fieldErrors({ ...validInput, startDatetime: 'besok pagi' }).startDatetime, [
      'Waktu mulai tidak valid',
    ]);
    // The cross-field "end after start" check also fires for an unparseable
    // end, so only assert that the field-level message is present.
    assert.ok(fieldErrors({ ...validInput, endDatetime: '' }).endDatetime?.includes('Waktu selesai tidak valid'));
  });

  it('requires the end to be after the start', () => {
    assert.deepEqual(fieldErrors({ ...validInput, endDatetime: validInput.startDatetime }).endDatetime, [
      'Waktu selesai harus lebih akhir dari waktu mulai',
    ]);
    assert.deepEqual(fieldErrors({ ...validInput, endDatetime: '2026-11-09T01:00:00.000Z' }).endDatetime, [
      'Waktu selesai harus lebih akhir dari waktu mulai',
    ]);
  });

  it('requires the terms to be accepted', () => {
    assert.deepEqual(fieldErrors({ ...validInput, termsAccepted: false }).termsAccepted, [
      'Anda harus menyetujui Syarat & Ketentuan untuk mengajukan janji temu',
    ]);
    assert.ok(fieldErrors({ ...validInput, termsAccepted: 'true' }).termsAccepted);
    assert.ok(fieldErrors(without('termsAccepted')).termsAccepted);
  });
});
