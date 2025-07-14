// Simple logger that logs to console and keeps a small buffer in memory
// Avoids file I/O to prevent permission issues

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'ERROR' | 'DEBUG' | 'WARN';
  message: string;
}

class SimpleLogger {
  private logs: LogEntry[] = [];
  
  private log(level: 'INFO' | 'ERROR' | 'DEBUG' | 'WARN', message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const fullMessage = data ? `${message} ${JSON.stringify(data, null, 2)}` : message;
    
    this.logs.push({ timestamp, level, message: fullMessage });
    
    // Keep only last 50 entries to prevent memory overflow
    if (this.logs.length > 50) {
      this.logs = this.logs.slice(-50);
    }
    
    // Log to console
    const consoleMessage = `[${timestamp}] [${level}] ${fullMessage}`;
    if (level === 'ERROR') {
      console.error(consoleMessage);
    } else if (level === 'WARN') {
      console.warn(consoleMessage);
    } else {
      console.log(consoleMessage);
    }
  }
  
  info(message: string, data?: any) {
    this.log('INFO', message, data);
  }
  
  error(message: string, error?: any) {
    const errorData = error instanceof Error ? 
      { message: error.message, stack: error.stack } : 
      error;
    this.log('ERROR', message, errorData);
  }
  
  debug(message: string, data?: any) {
    this.log('DEBUG', message, data);
  }
  
  warn(message: string, data?: any) {
    this.log('WARN', message, data);
  }
  
  getLogs(): string {
    return this.logs.map(log => 
      `[${log.timestamp}] [${log.level}] ${log.message}`
    ).join('\n');
  }
  
  getLogsAsJSON(): string {
    return JSON.stringify(this.logs, null, 2);
  }
  
  clearLogs() {
    this.logs = [];
  }
}

export const logger = new SimpleLogger();