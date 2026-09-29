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
    // Console transport — always available, and the only transport that works
    // on serverless (Vercel) where the filesystem is read-only.
    new transports.Console({ format: consoleFormat }),
    // File logging is opt-in: it writes into the repo working directory by
    // default, which is a leak surface on a deployed host, and silently fails
    // on read-only serverless filesystems. Point LOG_DIR at a writable path
    // outside the web root when you need it.
    ...(process.env.LOG_DIR
      ? [
          new transports.File({
            filename: `${process.env.LOG_DIR}/error.log`,
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true,
          }),
          new transports.File({
            filename: `${process.env.LOG_DIR}/combined.log`,
            maxsize: 5242880,
            maxFiles: 5,
            tailable: true,
          }),
        ]
      : []),
  ],
});

interface RequestLike {
  method?: string;
  url?: string;
  ip?: string;
  connection?: { remoteAddress?: string };
  headers: Record<string, string | string[] | undefined>;
}

interface ResponseLike {
  statusCode: number;
  on(event: 'finish', listener: () => void): void;
}

// Auth headers and session cookies must never reach a persistent log: they
// carry bearer-style material that would let anyone reading the logs hijack a
// session or inspect PII.
const SENSITIVE_HEADERS = ['cookie', 'authorization', 'set-cookie', 'x-api-key'];

function sanitizeHeaders(headers: Record<string, string | string[] | undefined>) {
  const out: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key] = SENSITIVE_HEADERS.includes(key.toLowerCase()) ? '[REDACTED]' : value;
  }
  return out;
}

// Request logging middleware for Node-compatible request/response objects
export function requestLogger(req: RequestLike, res: ResponseLike, next: () => void) {
  const start = Date.now();

  res.on('finish', () => {
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration_ms: Date.now() - start,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
      headers: sanitizeHeaders(req.headers),
    });
  });

  next();
}
