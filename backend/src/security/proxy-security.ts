import { timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { isIP } from 'node:net';

export function secretMatches(
  value: string | undefined,
  expected: string,
): boolean {
  if (!value || expected.length < 32) return false;
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function proxySecurity(config: ConfigService) {
  const production = config.get<string>('NODE_ENV') === 'production';
  const origins = config
    .getOrThrow<string>('FRONTEND_URL')
    .split(',')
    .map((origin) => origin.trim());
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.get('Origin');
    if (
      (origin && !origins.includes(origin)) ||
      req.get('Sec-Fetch-Site') === 'cross-site'
    )
      return res.status(403).json({ message: 'Origem não permitida.' });
    if (
      !production ||
      (req.path === '/produtos' && req.method === 'GET') ||
      req.path.startsWith('/internal/checkout/')
    )
      return next();
    if (req.method === 'OPTIONS')
      return origin && origins.includes(origin)
        ? next()
        : res.status(403).end();
    if (
      !secretMatches(
        req.get('X-Alva-Proxy-Secret'),
        config.get<string>('API_PROXY_SECRET', ''),
      )
    )
      return res
        .status(403)
        .json({ message: 'Acesso permitido somente pela loja.' });
    const clientIp = req.get('X-Alva-Client-Ip');
    if (clientIp && isIP(clientIp))
      (res.locals as { alvaClientIp?: string }).alvaClientIp = clientIp;
    if (
      !['GET', 'HEAD'].includes(req.method) &&
      (!origin || !origins.includes(origin) || !req.is('application/json'))
    )
      return res.status(403).json({ message: 'Requisição não permitida.' });
    res.setHeader('Cache-Control', 'no-store');
    return next();
  };
}
