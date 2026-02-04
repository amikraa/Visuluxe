/**
 * Production-safe logging utility
 * Only logs in development mode to prevent information leakage
 */

const isDevelopment = import.meta.env.DEV;

export const devLog = {
  /**
   * Log errors only in development mode
   * In production, errors are silently ignored to prevent information leakage
   */
  error: (...args: unknown[]): void => {
    if (isDevelopment) {
      console.error(...args);
    }
  },

  /**
   * Log warnings only in development mode
   */
  warn: (...args: unknown[]): void => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  /**
   * Log info only in development mode
   */
  info: (...args: unknown[]): void => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  /**
   * Log debug messages only in development mode
   */
  debug: (...args: unknown[]): void => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
};
