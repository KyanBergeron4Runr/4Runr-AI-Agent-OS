import { env } from './env'

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

const logLevelMap: Record<string, LogLevel> = {
  error: LogLevel.ERROR,
  warn: LogLevel.WARN,
  info: LogLevel.INFO,
  debug: LogLevel.DEBUG,
}

class Logger {
  private level: LogLevel
  private prefix: string

  constructor(prefix: string = '4Runr') {
    this.prefix = prefix
    this.level = logLevelMap[env.LOG_LEVEL] || LogLevel.INFO
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.level
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString()
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.prefix}]`
    
    if (data) {
      return `${prefix} ${message} ${JSON.stringify(data, null, 2)}`
    }
    
    return `${prefix} ${message}`
  }

  error(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage('ERROR', message, data))
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', message, data))
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage('INFO', message, data))
    }
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage('DEBUG', message, data))
    }
  }

  // Specialized logging for different components
  sentinel(message: string, data?: any): void {
    this.info(`[Sentinel] ${message}`, data)
  }

  shield(message: string, data?: any): void {
    this.info(`[Shield] ${message}`, data)
  }

  judge(message: string, data?: any): void {
    this.info(`[Judge] ${message}`, data)
  }

  coach(message: string, data?: any): void {
    this.info(`[Coach] ${message}`, data)
  }

  guard(message: string, data?: any): void {
    this.info(`[Guard] ${message}`, data)
  }

  audit(message: string, data?: any): void {
    this.info(`[Audit] ${message}`, data)
  }

  // Safe logging that doesn't expose secrets
  safe(message: string, data?: any): void {
    if (data && typeof data === 'object') {
      const safeData = { ...data }
      
      // Remove sensitive fields
      const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization']
      sensitiveFields.forEach(field => {
        if (safeData[field]) {
          safeData[field] = '***REDACTED***'
        }
      })
      
      this.info(message, safeData)
    } else {
      this.info(message, data)
    }
  }
}

// Create default logger instance
export const logger = new Logger()

// Factory function to create component-specific loggers
export function createLogger(component: string): Logger {
  return new Logger(`4Runr:${component}`)
}

// Export the Logger class for custom instances
export { Logger }
