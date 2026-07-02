import { TestInfo } from '@playwright/test';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export class TestLogger {
  constructor(private readonly testInfo: TestInfo) {}

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }

  step(message: string): void {
    const timestamp = new Date().toISOString();
    this.testInfo.annotations.push({ type: 'step', description: `[${timestamp}] ${message}` });
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    const line = data !== undefined
      ? `${prefix} ${message} ${JSON.stringify(data)}`
      : `${prefix} ${message}`;
    console.log(line);
  }
}
