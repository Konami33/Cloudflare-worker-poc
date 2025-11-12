/**
 * Systematic Logger for Cloudflare Worker
 * 
 * Provides structured logging with log levels, timestamps, and context.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

export interface LogContext {
  user_id?: string;
  lab_request_id?: string;
  session_id?: string;
  endpoint?: string;
  method?: string;
  duration?: number;
  [key: string]: any;
}

export class Logger {
  private static minLevel: LogLevel = LogLevel.INFO;
  private context: LogContext;
  private component: string;

  constructor(component: string, context: LogContext = {}) {
    this.component = component;
    this.context = context;
  }

  /**
   * Set minimum log level
   */
  static setMinLevel(level: LogLevel): void {
    Logger.minLevel = level;
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    return new Logger(this.component, { ...this.context, ...additionalContext });
  }

  /**
   * Format log message with timestamp, level, component, and context
   */
  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    
    const contextStr = Object.keys(this.context).length > 0 
      ? ` | ${JSON.stringify(this.context)}` 
      : '';
    
    const dataStr = data !== undefined 
      ? ` | ${typeof data === 'object' ? JSON.stringify(data) : data}` 
      : '';

    return `[${timestamp}] [${levelName}] [${this.component}]${contextStr} ${message}${dataStr}`;
  }

  /**
   * Log a message at the specified level
   */
  private log(level: LogLevel, message: string, data?: any): void {
    if (level < Logger.minLevel) return;

    const formattedMessage = this.formatMessage(level, message, data);

    switch (level) {
      case LogLevel.DEBUG:
      case LogLevel.INFO:
        console.log(`${formattedMessage}`);
        break;
      case LogLevel.WARN:
        console.warn(`${formattedMessage}`);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(`${formattedMessage}`);
        break;
    }
  }

  /**
   * Debug level logging (detailed information for debugging)
   */
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Info level logging (general informational messages)
   */
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Warning level logging (warning messages)
   */
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Error level logging (error messages)
   */
  error(message: string, error?: any): void {
    const errorData = error instanceof Error 
      ? { message: error.message, stack: error.stack }
      : error;
    this.log(LogLevel.ERROR, message, errorData);
  }

  /**
   * Critical level logging (critical errors requiring immediate attention)
   */
  critical(message: string, error?: any): void {
    const errorData = error instanceof Error 
      ? { message: error.message, stack: error.stack }
      : error;
    this.log(LogLevel.CRITICAL, message, errorData);
  }

  /**
   * Log HTTP request
   */
  logRequest(method: string, path: string, statusCode?: number): void {
    const message = statusCode 
      ? `${method} ${path} - ${statusCode}`
      : `${method} ${path}`;
    this.info(message);
  }

  /**
   * Log operation start
   */
  logOperationStart(operation: string, context?: LogContext): void {
    const logger = context ? this.child(context) : this;
    logger.info(`Starting ${operation}`);
  }

  /**
   * Log operation success
   */
  logOperationSuccess(operation: string, duration?: number, data?: any): void {
    const message = duration 
      ? `${operation} completed in ${duration}ms`
      : `${operation} completed`;
    this.info(message, data);
  }

  /**
   * Log operation failure
   */
  logOperationFailure(operation: string, error: any, duration?: number): void {
    const message = duration 
      ? `${operation} failed after ${duration}ms`
      : `${operation} failed`;
    this.error(message, error);
  }

  /**
   * Log database operation
   */
  logDatabaseOperation(operation: string, table: string, success: boolean, rowsAffected?: number): void {
    const message = `Database ${operation} on ${table}`;
    if (success) {
      this.info(`${message} - Success`, { rowsAffected });
    } else {
      this.error(`${message} - Failed`);
    }
  }

  /**
   * Log API call to external service
   */
  logApiCall(method: string, url: string, statusCode?: number, duration?: number): void {
    const message = `External API: ${method} ${url}`;
    if (statusCode) {
      if (statusCode >= 200 && statusCode < 300) {
        this.info(`${message} - ${statusCode}`, { duration });
      } else if (statusCode >= 400) {
        this.error(`${message} - ${statusCode}`, { duration });
      } else {
        this.warn(`${message} - ${statusCode}`, { duration });
      }
    } else {
      this.info(message);
    }
  }

  /**
   * Log cron job execution
   */
  logCronExecution(jobName: string, sessionsProcessed: number, errors: number): void {
    this.info(`Cron job "${jobName}" completed`, {
      sessionsProcessed,
      errors,
      success: errors === 0
    });
  }

  /**
   * Log session lifecycle events
   */
  logSessionCreated(user_id: string, lab_request_id: string, duration: number): void {
    this.child({ user_id, lab_request_id }).info(`Session created with duration ${duration} minutes`);
  }

  logSessionUpdated(user_id: string, fields: string[]): void {
    this.child({ user_id }).info(`Session updated`, { fields });
  }

  logSessionDeleted(user_id: string, reason: 'manual' | 'automatic'): void {
    this.child({ user_id }).info(`Session deleted (${reason})`);
  }

  logSessionExpired(user_id: string, lab_request_id: string): void {
    this.child({ user_id, lab_request_id }).warn('Session expired - triggering cleanup');
  }
}

/**
 * Create a logger instance for a specific component
 */
export function createLogger(component: string, context?: LogContext): Logger {
  return new Logger(component, context);
}

/**
 * Set global log level based on environment
 */
export function initializeLogger(environment: string = 'production'): void {
  if (environment === 'development' || environment === 'dev') {
    Logger.setMinLevel(LogLevel.DEBUG);
  } else if (environment === 'staging') {
    Logger.setMinLevel(LogLevel.INFO);
  } else {
    Logger.setMinLevel(LogLevel.INFO);
  }
}
