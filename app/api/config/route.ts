import { NextResponse } from 'next/server'
import { getConfig, setConfig } from '@/lib/db'

export async function GET() {
  try {
    const holidayModeEnabled = getConfig('holidayModeEnabled') === 'true'
    return NextResponse.json({ holidayModeEnabled })
  } catch (e) {
    console.error('GET /api/config failed:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    if (typeof body.holidayModeEnabled === 'boolean') {
      setConfig('holidayModeEnabled', String(body.holidayModeEnabled))
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('PUT /api/config failed:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
