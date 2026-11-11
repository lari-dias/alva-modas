import type { NextFunction, Request, Response } from 'express';

export function commerceRateLimit() {
  const clientes = new Map<string, { total: number; ate: number }>();
  const janelaMs = 60000;
  let proximaLimpeza = 0;
  return (req: Request, res: Response, next: NextFunction) => {
    if (
      req.method === 'OPTIONS' ||
      !(
        req.path === '/carrinho' ||
        req.path === '/finalizar-compra' ||
        req.path === '/checkout/status' ||
        req.path.startsWith('/auth/checkout/tentativas/')
      )
    )
      return next();
    const agora = Date.now();
    if (agora >= proximaLimpeza) {
      for (const [ip, limite] of clientes) {
        if (limite.ate <= agora) clientes.delete(ip);
      }
      proximaLimpeza = agora + janelaMs;
    }
    const ip =
      (res.locals as { alvaClientIp?: string }).alvaClientIp ??
      req.ip ??
      req.socket.remoteAddress ??
      'unknown';
    let limite = clientes.get(ip);
    if (!limite || limite.ate <= agora) {
      if (!limite && clientes.size >= 10000)
        return res.status(503).json({ message: 'Tente novamente mais tarde.' });
      limite = { total: 0, ate: agora + janelaMs };
      clientes.set(ip, limite);
    }
    if (++limite.total > 120) {
      res.setHeader('Retry-After', Math.ceil((limite.ate - agora) / 1000));
      return res.status(429).json({
        message: 'Muitas operações. Aguarde um minuto e tente novamente.',
      });
    }
    return next();
  };
}
