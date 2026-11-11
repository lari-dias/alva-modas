import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { ConfirmacaoPedido, StatusEnvioEmail } from './confirmacao-pedido';
import { confirmacaoHtml, confirmacaoTexto } from './confirmacao.template';

@Injectable()
export class ResendService {
  private readonly resend: Resend | null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  async enviarConfirmacao(
    pedido: ConfirmacaoPedido,
    idempotencyKey?: string,
  ): Promise<StatusEnvioEmail> {
    if (!this.resend) return StatusEnvioEmail.DESABILITADO;

    try {
      const { data, error } = await this.resend.emails.send(
        {
          from: this.config.get<string>(
            'RESEND_FROM',
            'Alva Modas <onboarding@resend.dev>',
          ),
          to: pedido.emailCliente,
          subject: `Alva Modas - Pedido ${pedido.idPedido} confirmado`,
          html: confirmacaoHtml(pedido),
          text: confirmacaoTexto(pedido),
        },
        idempotencyKey
          ? { idempotencyKey, signal: AbortSignal.timeout(15000) }
          : undefined,
      );

      return error || !data?.id
        ? StatusEnvioEmail.FALHOU
        : StatusEnvioEmail.ACEITO_PELA_API;
    } catch {
      return StatusEnvioEmail.FALHOU;
    }
  }
}
