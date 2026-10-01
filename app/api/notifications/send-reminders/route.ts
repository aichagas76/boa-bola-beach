import { NextRequest, NextResponse } from 'next/server'
import { sendPaymentReminders, sendOverdueAlerts } from '@/lib/notifications/service'
import { rateLimit } from '@/lib/rate-limit'

const apiRateLimit = rateLimit({
  windowMs: 3600000, // 1 hour
  maxRequests: 10, // Prevent abuse
})

/**
 * Endpoint to trigger notification reminders
 * Should be called daily via cron job
 *
 * Usage: POST /api/notifications/send-reminders
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !apiRateLimit(authHeader)) {
      return NextResponse.json(
        { error: 'Unauthorized or rate limited' },
        { status: 401 }
      )
    }

    const results = await Promise.all([
      sendPaymentReminders(),
      sendOverdueAlerts(),
    ])

    return NextResponse.json({
      success: true,
      reminders_sent: results[0].sent,
      overdue_alerts_sent: results[1].sent,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error in send-reminders:', error)
    return NextResponse.json(
      { error: 'Failed to send reminders', details: String(error) },
      { status: 500 }
    )
  }
}
