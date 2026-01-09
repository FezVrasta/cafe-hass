/**
 * Global logging utility for C.A.F.E.
 * Can be easily enabled/disabled for debugging
 */

// Enable debugging by setting this to true or via localStorage
const DEBUG_ENABLED = 
  typeof window !== 'undefined' && 
  (localStorage.getItem('cafe_debug') === 'true' || 
   window.location.search.includes('debug=true'));

// Console styling for better visibility
const styles = {
  info: 'color: #2196F3; font-weight: bold',
  warn: 'color: #FF9800; font-weight: bold',
  error: 'color: #F44336; font-weight: bold',
  success: 'color: #4CAF50; font-weight: bold',
  debug: 'color: #9C27B0; font-weight: bold',
};

class Logger {
  private enabled: boolean;
  private prefix: string;

  constructor(enabled = DEBUG_ENABLED) {
    this.enabled = enabled;
    this.prefix = '[C.A.F.E.]';
  }

  /**
   * Enable or disable logging
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('cafe_debug', enabled.toString());
    }
  }

  /**
   * Check if debugging is enabled
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Log info message
   */
  info(message: string, ...args: any[]) {
    if (!this.enabled) return;
    console.log(`%c${this.prefix} ${message}`, styles.info, ...args);
  }

  /**
   * Log warning message
   */
  warn(message: string, ...args: any[]) {
    if (!this.enabled) return;
    console.warn(`%c${this.prefix} ${message}`, styles.warn, ...args);
  }

  /**
   * Log error message
   */
  error(message: string, ...args: any[]) {
    if (!this.enabled) return;
    console.error(`%c${this.prefix} ${message}`, styles.error, ...args);
  }

  /**
   * Log success message
   */
  success(message: string, ...args: any[]) {
    if (!this.enabled) return;
    console.log(`%c${this.prefix} ${message}`, styles.success, ...args);
  }

  /**
   * Log debug message
   */
  debug(message: string, ...args: any[]) {
    if (!this.enabled) return;
    console.log(`%c${this.prefix} DEBUG: ${message}`, styles.debug, ...args);
  }

  /**
   * Log object with structured formatting
   */
  object(label: string, obj: any) {
    if (!this.enabled) return;
    console.group(`%c${this.prefix} ${label}`, styles.info);
    console.log(obj);
    console.groupEnd();
  }

  /**
   * Start a timer
   */
  time(label: string) {
    if (!this.enabled) return;
    console.time(`${this.prefix} ${label}`);
  }

  /**
   * End a timer
   */
  timeEnd(label: string) {
    if (!this.enabled) return;
    console.timeEnd(`${this.prefix} ${label}`);
  }
}

// Create global logger instance
export const logger = new Logger();

// Helper to enable debugging from browser console
if (typeof window !== 'undefined') {
  (window as any).cafeLogger = logger;
}

export default logger;