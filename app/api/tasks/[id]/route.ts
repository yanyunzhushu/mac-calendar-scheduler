import { NextResponse } from 'next/server'
import { updateTask, deleteTask } from '@/lib/db'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const task = await request.json()
    updateTask(id, task)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('PUT /api/tasks/:id failed:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    deleteTask(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/tasks/:id failed:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
