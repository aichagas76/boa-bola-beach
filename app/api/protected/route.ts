import { NextRequest, NextResponse } from 'next/server'
import { getServerSession, AuthError } from '@/lib/auth-middleware'
import { rateLimit } from '@/lib/rate-limit'

const apiRateLimit = rateLimit({
  windowMs: 60000, // 1 minute
  maxRequests: 100, // Max 100 requests per minute
})

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown'

    if (!apiRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    // Authentication
    const user = await getServerSession()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Protected route logic
    return NextResponse.json({
      success: true,
      message: 'This is a protected route',
      user: {
        id: user.id,
        email: user.email,
      },
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
