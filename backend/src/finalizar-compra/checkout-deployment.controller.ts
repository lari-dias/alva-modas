import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { CheckoutDeploymentService } from './checkout-deployment.service';
import { secretMatches } from '../security/proxy-security';

@Controller()
export class CheckoutDeploymentController {
  constructor(
    private readonly deployment: CheckoutDeploymentService,
    private readonly config: ConfigService,
  ) {}

  @Get('checkout/status')
  async publico(@Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return { aberto: (await this.deployment.status()).aberto };
  }

  private autorizar(req: Request, res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    const token = req.get('Authorization')?.replace(/^Bearer /, '');
    if (
      !secretMatches(token, this.config.get<string>('CHECKOUT_ADMIN_TOKEN', ''))
    )
      throw new UnauthorizedException();
  }

  @Get('internal/checkout/status')
  async status(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.autorizar(req, res);
    return this.deployment.status();
  }

  @Get('internal/checkout/readiness')
  async readiness(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.autorizar(req, res);
    return {
      ...(await this.deployment.estrutura()),
      outboxHabilitada:
        this.config.get<boolean>('CHECKOUT_OUTBOX_ENABLED') === true,
      resendConfigurada: Boolean(this.config.get<string>('RESEND_API_KEY')),
    };
  }

  @Post('internal/checkout/:acao')
  async controlar(
    @Param('acao') acao: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.autorizar(req, res);
    if (acao === 'pause') return this.deployment.pausar();
    if (acao === 'open') return this.deployment.abrir();
    if (acao === 'retire-legacy') return this.deployment.retirarLegado();
    throw new NotFoundException();
  }
}
