import { BaseDirectory, writeTextFile, readTextFile, exists } from '@tauri-apps/plugin-fs';

const LOG_FILE = 'app-debug.log';

export async function logToFile(message: string, level: 'INFO' | 'ERROR' | 'DEBUG' = 'INFO') {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}\n`;
    
    // Check if file exists
    const fileExists = await exists(LOG_FILE, { baseDir: BaseDirectory.AppLocalData }).catch(() => false);
    
    if (fileExists) {
      // Append to existing file
      const currentContent = await readTextFile(LOG_FILE, { baseDir: BaseDirectory.AppLocalData });
      await writeTextFile(LOG_FILE, currentContent + logEntry, { baseDir: BaseDirectory.AppLocalData });
    } else {
      // Create new file
      await writeTextFile(LOG_FILE, logEntry, { baseDir: BaseDirectory.AppLocalData });
    }
    
    // Also log to console
    console.log(`[${level}]`, message);
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
}

export async function clearLogFile() {
  try {
    await writeTextFile(LOG_FILE, '', { baseDir: BaseDirectory.AppLocalData });
  } catch (error) {
    console.error('Failed to clear log file:', error);
  }
}

// Log to both console and file
export const logger = {
  info: (message: string, data?: any) => {
    const fullMessage = data ? `${message} ${JSON.stringify(data)}` : message;
    logToFile(fullMessage, 'INFO');
  },
  error: (message: string, error?: any) => {
    const fullMessage = error ? `${message} ${error.toString()}` : message;
    logToFile(fullMessage, 'ERROR');
  },
  debug: (message: string, data?: any) => {
    const fullMessage = data ? `${message} ${JSON.stringify(data)}` : message;
    logToFile(fullMessage, 'DEBUG');
  }
};