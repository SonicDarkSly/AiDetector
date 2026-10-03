import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { timestamp } from '../logging/file-tee.logger.js';
import { clientIp, deviceTagOf } from './client-info.js';

const RESET = '\x1b[0m';
const COLORS = ['36', '33', '35', '34', '91', '95', '96', '93', '38;5;208', '38;5;99'].map(
  (c) => `\x1b[${c}m`,
);

function colorFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

export function accessLog() {
  const http = new Logger('HTTP');
  const devices = new Logger('Appareil');
  const seen = new Set<string>();

  return (req: Request, res: Response, next: NextFunction) => {
    const startedAt = Date.now();
    const tag = deviceTagOf(req);
    const color = colorFor(clientIp(req));
    if (!seen.has(tag)) {
      seen.add(tag);
      devices.log(`${color}${tag} · connecté le ${timestamp()}${RESET}`);
    }
    res.on('finish', () => {
      const line = `${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - startedAt} ms) · ${tag}`;
      http.log(`${color}${line}${RESET}`);
    });
    next();
  };
}
