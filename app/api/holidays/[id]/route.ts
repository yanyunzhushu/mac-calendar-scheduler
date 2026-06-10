import { NextResponse } from 'next/server'
import { deleteHoliday } from '@/lib/db'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    deleteHoliday(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/holidays/:id failed:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
