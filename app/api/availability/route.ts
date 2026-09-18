import { NextRequest, NextResponse } from 'next/server';
import { getAvailableSlots } from '@/lib/availability';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');

    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json(
        { error: 'Parameter "date" is required in YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    const result = await getAvailableSlots({ dateStr });
    return NextResponse.json({ data: result });
  } catch (err: unknown) {
    console.error('[API /api/availability] Error:', err);
    return NextResponse.json(
      { error: 'Failed to calculate available slots' },
      { status: 500 }
    );
  }
}
