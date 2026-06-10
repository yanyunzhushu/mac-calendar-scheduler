import { NextResponse } from 'next/server'
import { getAllHolidays, createHoliday } from '@/lib/db'

export async function GET() {
  try {
    const holidays = getAllHolidays()
    return NextResponse.json(holidays)
  } catch (e) {
    console.error('GET /api/holidays failed:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const holiday = await request.json()
    createHoliday(holiday)
    return NextResponse.json({ id: holiday.id })
  } catch (e) {
    console.error('POST /api/holidays failed:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
