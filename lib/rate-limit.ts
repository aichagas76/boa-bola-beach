interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

const store: RateLimitStore = {}

export interface RateLimitOptions {
  windowMs?: number
  maxRequests?: number
}

export function rateLimit(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? 60000
  const maxRequests = options.maxRequests ?? 100

  return function middleware(identifier: string): boolean {
    const now = Date.now()
    const key = identifier

    if (!store[key]) {
      store[key] = {
        count: 1,
        resetTime: now + windowMs,
      }
      return true
    }

    const record = store[key]

    if (now > record.resetTime) {
      record.count = 1
      record.resetTime = now + windowMs
      return true
    }

    record.count++
    return record.count <= maxRequests
  }
}

export class RateLimitError extends Error {
  constructor(message = 'Too many requests', public retryAfter = 60) {
    super(message)
    this.name = 'RateLimitError'
  }
}

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const key in store) {
    if (store[key].resetTime < now) {
      delete store[key]
    }
  }
}, 5 * 60 * 1000)
