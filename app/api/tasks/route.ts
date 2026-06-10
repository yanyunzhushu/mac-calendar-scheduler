import { NextResponse } from 'next/server'
import { getAllTasks, createTask } from '@/lib/db'

export async function GET() {
  try {
    const tasks = getAllTasks()
    return NextResponse.json(tasks)
  } catch (e) {
    console.error('GET /api/tasks failed:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const task = await request.json()
    createTask(task)
    return NextResponse.json({ id: task.id })
  } catch (e) {
    console.error('POST /api/tasks failed:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
