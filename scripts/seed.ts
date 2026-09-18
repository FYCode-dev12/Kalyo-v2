import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('Seeding database...');

  // 1. Calendar Sources (7 calendars)
  const calendars = [
    { googleCalendarId: 'primary', displayName: 'Primary', color: '#1769aa', showTitle: false, showDescription: false, isBookingTarget: true },
    { googleCalendarId: 'family', displayName: 'Family', color: '#d93025', showTitle: false, showDescription: false, isBookingTarget: false },
    { googleCalendarId: 'kuliah', displayName: 'Kuliah', color: '#f9ab00', showTitle: false, showDescription: false, isBookingTarget: false },
    { googleCalendarId: 'pmk', displayName: 'PMK', color: '#34a853', showTitle: false, showDescription: false, isBookingTarget: false },
    { googleCalendarId: 'tasks', displayName: 'Tasks', color: '#9b4de5', showTitle: false, showDescription: false, isBookingTarget: false },
    { googleCalendarId: 'ulang-tahun', displayName: 'Ulang Tahun', color: '#ff6d00', showTitle: false, showDescription: false, isBookingTarget: false },
    { googleCalendarId: 'ys-activity', displayName: 'YS Activity', color: '#009688', showTitle: false, showDescription: false, isBookingTarget: false },
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
