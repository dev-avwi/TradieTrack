import { db } from "./storage";
import { errorLogs } from "@shared/schema";

export type LogLevel = 'info' | 'warn' | 'error' | 'fatal';
export type LogCategory = 'sms' | 'email' | 'billing' | 'webhook' | 'auth' | 'api' | 'background' | 'system';

interface LogEntry {
  level: LogLevel;
  category: LogCategory;
  message: string;
  userId?: string;
  metadata?: Record<string, any>;
  error?: Error | unknown;
}

class Logger {
  private async persist(entry: LogEntry) {
    try {
      const errorDetails = entry.error instanceof Error
        ? { name: entry.error.name, message: entry.error.message, stack: entry.error.stack }
        : entry.error ? { raw: String(entry.error) } : undefined;

      await db.insert(errorLogs).values({
        level: entry.level,
        category: entry.category,
        message: entry.message,
        userId: entry.userId || null,
        metadata: entry.metadata || null,
        errorDetails: errorDetails || null,
      });
    } catch (dbError) {
      console.error('[Logger] Failed to persist log entry:', dbError);
    }
  }

  private formatConsole(entry: LogEntry): string {
    const ts = new Date().toISOString();
    const prefix = `[${ts}] [${entry.level.toUpperCase()}] [${entry.category}]`;
    const userStr = entry.userId ? ` user=${entry.userId}` : '';
    return `${prefix}${userStr} ${entry.message}`;
  }

  info(category: LogCategory, message: string, opts?: { userId?: string; metadata?: Record<string, any> }) {
    const entry: LogEntry = { level: 'info', category, message, ...opts };
    console.log(this.formatConsole(entry));
    this.persist(entry);
  }

  warn(category: LogCategory, message: string, opts?: { userId?: string; metadata?: Record<string, any>; error?: Error | unknown }) {
    const entry: LogEntry = { level: 'warn', category, message, ...opts };
    console.warn(this.formatConsole(entry));
    if (entry.error) console.warn(entry.error);
    this.persist(entry);
  }

  error(category: LogCategory, message: string, opts?: { userId?: string; metadata?: Record<string, any>; error?: Error | unknown }) {
    const entry: LogEntry = { level: 'error', category, message, ...opts };
    console.error(this.formatConsole(entry));
    if (entry.error) console.error(entry.error);
    this.persist(entry);
  }

  fatal(category: LogCategory, message: string, opts?: { userId?: string; metadata?: Record<string, any>; error?: Error | unknown }) {
    const entry: LogEntry = { level: 'fatal', category, message, ...opts };
    console.error(this.formatConsole(entry));
    if (entry.error) console.error(entry.error);
    this.persist(entry);
  }
}

export const logger = new Logger();
