import { Request, Response, NextFunction } from 'express';
import { AppLogger } from '@a11y-guard/logger';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function createErrorMiddleware(logger: AppLogger) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (err: AppError, _req: Request, res: Response, _next: NextFunction) => {
    const statusCode = err.statusCode || 500;
    const errorCode = err.code || 'INTERNAL_SERVER_ERROR';

    logger.error(
      {
        err,
        statusCode,
        code: errorCode,
      },
      `Unhandled error: ${err.message}`,
    );

    const isProduction = process.env.NODE_ENV === 'production';

    res.status(statusCode).json({
      error: {
        code: errorCode,
        message:
          isProduction && statusCode === 500 ? 'An internal server error occurred.' : err.message,
      },
    });
  };
}
