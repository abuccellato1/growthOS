import { NextResponse } from 'next/server'

export function apiError(
  message: string,
  status: number,
  code?: string
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code: code ?? 'ERROR',
      timestamp: new Date().toISOString(),
    },
    { status }
  )
}

export function apiSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    },
    { status }
  )
}
