import pino, { Logger, LoggerOptions } from 'pino';

export interface LogContext {
  requestId?: string;
  orgId?: string;
  userId?: string;
  [key: string]: unknown;
}

export type AppLogger = Logger;

export function createLogger(serviceName: string, options?: LoggerOptions): AppLogger {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  const baseOptions: LoggerOptions = {
    name: serviceName,
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    transport: isDevelopment
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
    ...options,
  };

  return pino(baseOptions);
}

export function createRequestLogger(parentLogger: AppLogger, context: LogContext): AppLogger {
  return parentLogger.child(context);
}
