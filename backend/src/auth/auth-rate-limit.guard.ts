import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly tentativas = new Map<
    string,
    { total: number; ate: number }
  >();

  canActivate(context: ExecutionContext): boolean {
    const agora = Date.now();
    for (const [ip, limite] of this.tentativas) {
      if (limite.ate <= agora) this.tentativas.delete(ip);
    }
    const req = context.switchToHttp().getRequest<Request>();
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    let limite = this.tentativas.get(ip);
    if (!limite) {
      if (this.tentativas.size >= 10000)
        throw new ServiceUnavailableException('Tente novamente mais tarde.');
      limite = { total: 0, ate: agora + 60000 };
      this.tentativas.set(ip, limite);
    }
    if (++limite.total > 20)
      throw new HttpException('Muitas tentativas. Aguarde um minuto.', 429);
    return true;
  }
}
