import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { config } from '../config/config';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Logger utility for the application
 */
export const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'assistive-llm' },
  transports: [
    // Write to all logs with level 'info' and below to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          ({ level, message, timestamp, ...meta }) => 
            `${timestamp} ${level}: ${message} ${
              Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
            }`
        )
      )
    }),
    // Write to all logs with level 'info' and below to `combined.log`
    new winston.transports.File({ 
      filename: path.join(logsDir, config.logging.file || 'combined.log')
    })
  ]
});

// Export a stream object for Morgan middleware
export const logStream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};