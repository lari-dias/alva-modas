import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service';
import {
  CheckoutTentativasService,
  AcessoCheckout,
} from './checkout-tentativas.service';
import { FinalizarCompraDto } from './dto/finalizar-compra.dto';
import { CarrinhoId } from '../carrinho/carrinho-id.decorator';

@Controller('auth/checkout/tentativas')
export class CheckoutTentativasController {
  constructor(
    private readonly tentativas: CheckoutTentativasService,
    private readonly auth: AuthService,
  ) {}

  private async acesso(req: Request, res: Response): Promise<AcessoCheckout> {
    res.setHeader('Cache-Control', 'no-store');
    const token = req.get('X-Checkout-Token') ?? '';
    if (!/^[a-f0-9]{64}$/.test(token))
      throw new BadRequestException('Credencial de recuperação inválida.');
    const cookie = req.headers.cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('alva_session='));
    const cliente = cookie
      ? await this.auth.autenticar(cookie.slice('alva_session='.length))
      : req.get('X-Checkout-Authenticated') === 'true'
        ? await this.auth.autenticar(undefined)
        : null;
    return { clienteId: cliente?.id ?? null, token };
  }

  @Post(':id')
  async preparar(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CarrinhoId(new ParseUUIDPipe({ version: '4' })) cartId: string,
    @Body() cliente: FinalizarCompraDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.tentativas.preparar(
      id,
      cartId,
      cliente,
      await this.acesso(req, res),
    );
  }

  @Post(':id/confirmar')
  async confirmar(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.tentativas.confirmar(id, await this.acesso(req, res));
  }

  @Post(':id/verificar')
  async consultar(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CarrinhoId(new ParseUUIDPipe({ version: '4' })) cartId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.tentativas.consultar(id, await this.acesso(req, res), cartId);
  }
}
