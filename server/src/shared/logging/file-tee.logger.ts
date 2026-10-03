import { ConsoleLogger } from '@nestjs/common';
import type { WriteStream } from 'node:fs';

export function timestamp(): string {
  return new Date().toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

export class FileTeeLogger extends ConsoleLogger {
  constructor(private readonly stream: WriteStream) {
    super();
  }

  log(message: unknown, ...params: unknown[]): void {
    this.write('LOG', message, params);
    super.log(message, ...params);
  }

  error(message: unknown, ...params: unknown[]): void {
    this.write('ERROR', message, params);
    super.error(message, ...params);
  }

  warn(message: unknown, ...params: unknown[]): void {
    this.write('WARN', message, params);
    super.warn(message, ...params);
  }

  private write(level: string, message: unknown, params: unknown[]): void {
    const last = params[params.length - 1];
    const context = typeof last === 'string' ? last : (this.context ?? level);
    const text = typeof message === 'string' ? message : JSON.stringify(message);
    this.stream.write(`${timestamp()} [${context}] ${stripAnsi(text)}\n`);
  }
}
