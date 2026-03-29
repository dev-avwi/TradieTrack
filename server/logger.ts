import { db } from "./storage";
import { errorLogs } from "@shared/schema";

export type LogLevel = 'info' | 'warn' | 'error' | 'fatal';
export type LogCategory = 'sms' | 'email' | 'billing' | 'webhook' | 'auth' | 'api' | 'background' | 'system' | 'frontend';

interface LogEntry {
  level: LogLevel;
  category: LogCategory;
  message: string;
  userId?: string;
  metadata?: Record<string, any>;
  error?: Error | unknown;
}

const ALERT_COOLDOWN_MS = 5 * 60 * 1000;
let lastAlertSent = 0;

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

  private async sendAlertEmail(entry: LogEntry) {
    const now = Date.now();
    if (now - lastAlertSent < ALERT_COOLDOWN_MS) return;
    lastAlertSent = now;

    try {
      const { sendEmailViaIntegration } = await import('./emailService');
      const adminEmail = process.env.ADMIN_ALERT_EMAIL || 'admin@avwebinnovation.com';
      const errorMsg = entry.error instanceof Error ? entry.error.message : String(entry.error || '');
      const stack = entry.error instanceof Error ? entry.error.stack : '';

      await sendEmailViaIntegration({
        to: adminEmail,
        subject: `[JobRunner ${entry.level.toUpperCase()}] ${entry.category}: ${entry.message.substring(0, 80)}`,
        html: `
          <h2 style="color: #dc2626;">JobRunner ${entry.level.toUpperCase()} Alert</h2>
          <p><strong>Category:</strong> ${entry.category}</p>
          <p><strong>Message:</strong> ${entry.message}</p>
          ${entry.userId ? `<p><strong>User:</strong> ${entry.userId}</p>` : ''}
          ${errorMsg ? `<p><strong>Error:</strong> ${errorMsg}</p>` : ''}
          ${stack ? `<pre style="background:#f3f4f6;padding:12px;border-radius:6px;font-size:12px;overflow:auto;">${stack}</pre>` : ''}
          <p style="color:#6b7280;font-size:12px;">Time: ${new Date().toISOString()}</p>
          <p style="color:#6b7280;font-size:12px;">Alerts are throttled to one every 5 minutes.</p>
        `,
      });
    } catch (emailError) {
      console.error('[Logger] Failed to send alert email:', emailError);
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
    this.sendAlertEmail(entry);
  }

  fatal(category: LogCategory, message: string, opts?: { userId?: string; metadata?: Record<string, any>; error?: Error | unknown }) {
    const entry: LogEntry = { level: 'fatal', category, message, ...opts };
    console.error(this.formatConsole(entry));
    if (entry.error) console.error(entry.error);
    this.persist(entry);
    this.sendAlertEmail(entry);
  }
}

export const logger = new Logger();
