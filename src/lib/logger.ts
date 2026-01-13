export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogEntry {
    level: LogLevel
    message: string
    timestamp: string
    context?: Record<string, any>
    error?: any
}

class Logger {
    private isDev = process.env.NODE_ENV === 'development'

    private formatError(error: any): any {
        if (error instanceof Error) {
            return {
                message: error.message,
                stack: this.isDev ? error.stack : undefined, // Hide stack in prod unless needed
                name: error.name,
            }
        }
        return error
    }

    private log(level: LogLevel, message: string, context?: Record<string, any>, error?: any) {
        const entry: LogEntry = {
            level,
            message,
            timestamp: new Date().toISOString(),
            context,
            error: error ? this.formatError(error) : undefined,
        }

        // In production, we want single-line JSON for log aggregators (CloudWatch, Datadog, etc)
        // In dev, we might want pretty print, but JSON is safer for structure
        console.log(JSON.stringify(entry))
    }

    info(message: string, context?: Record<string, any>) {
        this.log('info', message, context)
    }

    warn(message: string, context?: Record<string, any>, error?: any) {
        this.log('warn', message, context, error)
    }

    error(message: string, error?: any, context?: Record<string, any>) {
        this.log('error', message, context, error)
    }

    debug(message: string, context?: Record<string, any>) {
        if (this.isDev || process.env.LOG_LEVEL === 'debug') {
            this.log('debug', message, context)
        }
    }
}

export const logger = new Logger()
