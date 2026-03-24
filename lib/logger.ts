type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogContext {
  route?: string
  customerId?: string
  businessId?: string
  sessionId?: string
  action?: string
  durationMs?: number
  status?: number
  [key: string]: string | number | boolean | undefined
}

function sanitizeId(id: string | undefined): string | undefined {
  if (!id) return undefined
  return id.slice(0, 8) + '...'
}

function sanitizeContext(context?: LogContext): LogContext {
  if (!context) return {}
  const safe = { ...context }
  if (safe.customerId && safe.customerId.length > 12) {
    safe.customerId = safe.customerId.slice(0, 8) + '...'
  }
  if (safe.businessId && safe.businessId.length > 12) {
    safe.businessId = safe.businessId.slice(0, 8) + '...'
  }
  if (safe.sessionId && safe.sessionId.length > 12) {
    safe.sessionId = safe.sessionId.slice(0, 8) + '...'
  }
  return safe
}

function formatEntry(level: LogLevel, message: string, extra?: Record<string, unknown>) {
  return JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...extra,
  })
}

export const logger = {
  info(message: string, context?: LogContext) {
    console.log(formatEntry('info', message, sanitizeContext(context)))
  },

  warn(message: string, context?: LogContext) {
    console.warn(formatEntry('warn', message, sanitizeContext(context)))
  },

  error(message: string, error?: unknown, context?: LogContext) {
    const errorDetails = error instanceof Error
      ? { errorMessage: error.message, errorName: error.name }
      : error !== undefined
        ? { errorRaw: String(error) }
        : {}
    console.error(formatEntry('error', message, {
      ...errorDetails,
      ...sanitizeContext(context),
    }))
  },

  apiStart(route: string, customerId?: string): number {
    const start = Date.now()
    logger.info(`${route} called`, {
      route,
      customerId: sanitizeId(customerId),
      action: 'request_start',
    })
    return start
  },

  apiEnd(route: string, start: number, status: number, customerId?: string) {
    logger.info(`${route} completed`, {
      route,
      customerId: sanitizeId(customerId),
      action: 'request_end',
      status,
      durationMs: Date.now() - start,
    })
  },
}
