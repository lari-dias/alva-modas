import type { Request, Response } from 'express';
import { commerceRateLimit } from './commerce-rate-limit';

describe('Commerce rate limit', () => {
  afterEach(() => jest.useRealTimers());

  const requisicao = (ip: string, path = '/carrinho') =>
    ({ method: 'POST', path, ip }) as Request;
  const resposta = (ip?: string) => {
    const res = {
      locals: { alvaClientIp: ip },
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };
    return { res, http: res as unknown as Response };
  };

  it('limita operações por cliente e recupera a janela sem afetar outro IP', () => {
    jest.useFakeTimers();
    const middleware = commerceRateLimit();
    const { res, http } = resposta();
    const next = jest.fn();
    for (let i = 0; i < 120; i++)
      middleware(requisicao('192.0.2.1'), http, next);
    middleware(requisicao('192.0.2.1'), http, next);
    expect(next).toHaveBeenCalledTimes(120);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', 60);
    middleware(requisicao('192.0.2.2'), http, next);
    jest.advanceTimersByTime(60000);
    middleware(requisicao('192.0.2.1'), http, next);
    expect(next).toHaveBeenCalledTimes(122);
  });

  it('separa clientes do proxy autenticado e não limita catálogo ou autenticação', () => {
    const middleware = commerceRateLimit();
    const first = resposta('192.0.2.1');
    const second = resposta('192.0.2.2');
    const next = jest.fn();
    for (let i = 0; i < 121; i++)
      middleware(requisicao('proxy'), first.http, next);
    middleware(requisicao('proxy'), second.http, next);
    expect(second.res.status).not.toHaveBeenCalled();
    for (const path of [
      '/produtos',
      '/auth/login',
      '/internal/checkout/status',
    ])
      middleware(requisicao('proxy', path), first.http, next);
    expect(next).toHaveBeenCalledTimes(124);
  });
});
