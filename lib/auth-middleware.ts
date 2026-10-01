import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function getServerSession() {
  try {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Handle cookie setting errors
            }
          },
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    return user
  } catch (error) {
    console.error('Auth error:', error)
    return null
  }
}

export async function requireAuth() {
  const user = await getServerSession()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export class AuthError extends Error {
  constructor(message = 'Unauthorized', public statusCode = 401) {
    super(message)
    this.name = 'AuthError'
  }
}
