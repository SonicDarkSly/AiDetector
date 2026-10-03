import type { IncomingMessage } from 'node:http';

type RequestLike = IncomingMessage & { ip?: string };

export function clientIp(req: RequestLike): string {
  const forwarded = req.headers['x-forwarded-for'];
  const raw =
    typeof forwarded === 'string' && forwarded.length > 0
      ? forwarded.split(',')[0].trim()
      : String(req.ip ?? req.socket?.remoteAddress ?? '');
  const ip = raw.replace(/^::ffff:/, '');
  if (ip === '::1' || ip === '127.0.0.1' || ip === '') return 'localhost';
  return ip;
}

export function platform(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipod/.test(ua)) return 'iOS';
  if (/ipad/.test(ua)) return 'iPadOS';
  if (/android/.test(ua)) return /mobile/.test(ua) ? 'Android' : 'Android (tablette)';
  if (/windows/.test(ua)) return 'Windows';
  if (/macintosh|mac os x/.test(ua)) return 'macOS';
  if (/\blinux\b|\bx11\b/.test(ua)) return 'Linux';
  return '';
}

export function deviceTagOf(req: RequestLike): string {
  const ip = clientIp(req);
  const os = platform(req.headers['user-agent'] ?? '');
  return os ? `${ip} · ${os}` : ip;
}
