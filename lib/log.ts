/**
 * Logger Configuration
 * Uses simple console logging with Bunyan-style output
 * File logging via Winston for production
 */

import { format, transports, createLogger } from 'winston';
import type { Logger } from 'winston';

// Simple Bunyan-like format for console
const consoleFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.splat(),
  format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const log: Record<string, unknown> = {
      time: timestamp,
      level,
      msg: String(message),
      ...('object' === typeof meta ? meta : {}),
    };
    if (stack) log.stack = stack;
    return JSON.stringify(log);
  })
);

// File format (JSON)
const fileFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.splat(),
  format.json()
);

export const logger: Logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: fileFormat,
  transports: [
    // Console transport for dev (JSON format)
    new transports.Console({ format: consoleFormat }),
    // Error log (rotate daily)
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true,
    }),
    // Combined log (rotate daily)
    new transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5,
      tailable: true,
    }),
  ],
});

// Request logging middleware for Next.js
export function requestLogger(req: any, res: any, next: any) {
  const start = Date.now();
  
  res.on('finish', () => {
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration_ms: Date.now() - start,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    });
  });

  next();
}
