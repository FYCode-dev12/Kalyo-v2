import { getGoogleCalendarClient } from '@/lib/google-calendar';

async function testGoogleCalendar() {
  console.log('Testing Google Calendar API connection with Service Account...');
  try {
    const calendar = getGoogleCalendarClient();
    const res = await calendar.calendarList.list();
    console.log('✓ Successfully connected to Google Calendar API!');
    console.log(`✓ Accessible calendars count: ${res.data.items?.length || 0}`);
    if (res.data.items && res.data.items.length > 0) {
      res.data.items.forEach((item) => {
        console.log(`  - [${item.id}] ${item.summary} (accessRole: ${item.accessRole})`);
      });
    } else {
      console.log('  (No calendars shared with this service account yet. Make sure to share target calendars with the Service Account email)');
    }
  } catch (err: unknown) {
    console.error('✗ Google Calendar API error:', err);
  }
}

testGoogleCalendar();
