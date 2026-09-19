import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('Seeding database...');

  // 1. Calendar Sources (5 calendars with IDs from calendar id.md)
  const calendars = [
    { googleCalendarId: 'febrianyoel100@gmail.com', displayName: 'Primary', color: '#1769aa', showTitle: false, showDescription: false, isBookingTarget: true },
    { googleCalendarId: 'family17640158143981463920@group.calendar.google.com', displayName: 'Family', color: '#d93025', showTitle: false, showDescription: false, isBookingTarget: false },
    { googleCalendarId: '6d67eeda71aeb8f82b447bc212dcff30bac36c2bc35711516ffa73f053433b10@group.calendar.google.com', displayName: 'Kuliah', color: '#f9ab00', showTitle: false, showDescription: false, isBookingTarget: false },
    { googleCalendarId: 'bbfdf038ac699338ea27f3e8b47a6514a61580753e20255c50bc58aa9c44aa4f@group.calendar.google.com', displayName: 'PMK', color: '#34a853', showTitle: false, showDescription: false, isBookingTarget: false },
    { googleCalendarId: 'c3b52625db9981b4cd12438b89e3001080be56199cc076cee111f080e69a80f7@group.calendar.google.com', displayName: 'YS Activity', color: '#009688', showTitle: false, showDescription: false, isBookingTarget: false },
  ];

  for (const cal of calendars) {
    const created = await prisma.calendarSource.upsert({
      where: { googleCalendarId: cal.googleCalendarId },
      update: {
        displayName: cal.displayName,
        color: cal.color,
        showTitle: cal.showTitle,
        showDescription: cal.showDescription,
        isBookingTarget: cal.isBookingTarget,
      },
      create: cal,
    });
    console.log(`✓ Calendar source: ${cal.displayName} (${created.id})`);
  }

  // 2. Business Rule (singleton)
  const businessRule = await prisma.businessRule.upsert({
    where: { id: 'singleton' },
    update: {
      workStartTime: '09:00',
      workEndTime: '17:00',
      workdays: [1, 2, 3, 4, 5], // Monday-Friday
      minNoticeHours: 24,
      slotDurationMin: 30,
    },
    create: {
      id: 'singleton',
      workStartTime: '09:00',
      workEndTime: '17:00',
      workdays: [1, 2, 3, 4, 5],
      minNoticeHours: 24,
      slotDurationMin: 30,
    },
  });
  console.log(`✓ Business Rule: ${businessRule.id} (${businessRule.workStartTime}-${businessRule.workEndTime})`);

  // 3. Holidays (sample)
  const sampleHolidays = [
    { date: new Date('2026-09-22'), reason: 'Hari Raya Idul Fitri' },
    { date: new Date('2026-10-15'), reason: 'Hari Raya Idul Adha' },
    { date: new Date('2026-11-13'), reason: 'Tahun Baru Islam' },
    { date: new Date('2026-12-25'), reason: 'Hari Raya Natal' },
  ];

  for (const h of sampleHolidays) {
    await prisma.holiday.upsert({
      where: { date: h.date },
      update: { reason: h.reason },
      create: h,
    });
  }
  console.log(`✓ Sample holidays: ${sampleHolidays.length} entries`);

  console.log('\n✅ Database seed completed successfully!');
}

seed()
  .catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
