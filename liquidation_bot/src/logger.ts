import winston from "winston";
import type { BotConfig } from "./types.js";

/**
 * Create a structured logger instance.
 *
 * - Console: colorized, human-readable (for development)
 * - File: JSON format (for production debugging)
 *
 * Log files are capped at 10MB with 5 rotated files.
 */
export function createLogger(config: BotConfig): winston.Logger {
  const logger = winston.createLogger({
    level: config.logLevel,
    defaultMeta: { service: "liquidation-bot" },
    format: winston.format.combine(
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      winston.format.errors({ stack: true }),
    ),
    transports: [
      // Console output — colorized and readable
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr =
              Object.keys(meta).length > 1 // 1 because of defaultMeta
                ? ` ${JSON.stringify(meta, bigintReplacer)}`
                : "";
            return `${timestamp} [${level}]: ${message}${metaStr}`;
          }),
        ),
      }),

      // File output — structured JSON
      new winston.transports.File({
        filename: "logs/bot.log",
        maxsize: 10_000_000, // 10MB
        maxFiles: 5,
        format: winston.format.combine(
          winston.format.json({ replacer: bigintReplacer }),
        ),
      }),

      // Error-only file for quick diagnosis
      new winston.transports.File({
        filename: "logs/error.log",
        level: "error",
        maxsize: 10_000_000,
        maxFiles: 3,
        format: winston.format.combine(
          winston.format.json({ replacer: bigintReplacer }),
        ),
      }),
    ],
  });

  return logger;
}

/**
 * JSON replacer that handles BigInt serialization.
 * BigInt values are converted to strings with an "n" suffix.
 */
function bigintReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
}
