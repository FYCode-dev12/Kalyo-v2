import { getAvailableSlots } from '@/lib/availability';

async function testAvailability() {
  console.log('=== Testing Availability & Slot Engine ===\n');

  // Test 1: Future Workday (e.g. Monday 2026-09-28)
  console.log('1. Testing Workday (2026-09-28)...');
  const resWorkday = await getAvailableSlots({ dateStr: '2026-09-28' });
  console.log(`   isWorkday: ${resWorkday.isWorkday}, isHoliday: ${resWorkday.isHoliday}`);
  console.log(`   Total slots generated: ${resWorkday.slots.length}`);
  const availableSlots = resWorkday.slots.filter((s) => s.available);
  console.log(`   Available slots count: ${availableSlots.length}`);
  if (availableSlots.length > 0) {
    console.log(`   Sample available slot: ${availableSlots[0].formattedStart} - ${availableSlots[0].formattedEnd}`);
  }

  // Test 2: Holiday (2026-09-22 - Hari Raya Idul Fitri)
  console.log('\n2. Testing Holiday (2026-09-22)...');
  const resHoliday = await getAvailableSlots({ dateStr: '2026-09-22' });
  console.log(`   isWorkday: ${resHoliday.isWorkday}, isHoliday: ${resHoliday.isHoliday}, reason: ${resHoliday.holidayReason}`);
  console.log(`   Total slots: ${resHoliday.slots.length}`);

  // Test 3: Non-workday (Sunday 2026-09-27)
  console.log('\n3. Testing Sunday (2026-09-27)...');
  const resSunday = await getAvailableSlots({ dateStr: '2026-09-27' });
  console.log(`   isWorkday: ${resSunday.isWorkday}, slots: ${resSunday.slots.length}`);

  console.log('\n✅ Availability engine tests completed successfully!');
}

testAvailability().catch((err) => {
  console.error('✗ Availability test failed:', err);
  process.exit(1);
});
