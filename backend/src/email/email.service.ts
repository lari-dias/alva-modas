import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfirmacaoPedido, StatusEnvioEmail } from './confirmacao-pedido';
import { confirmacaoHtml, confirmacaoTexto } from './confirmacao.template';
import { SMTP_TRANSPORT } from './smtp.provider';
import type { SmtpTransport } from './smtp.provider';
import { ResendService } from './resend.service';

@Injectable()
export class EmailService implements OnModuleDestroy {
  constructor(
    @Inject(SMTP_TRANSPORT) private readonly transport: SmtpTransport | null,
    private readonly config: ConfigService,
    private readonly resendService: ResendService,
  ) {}

  async enviarConfirmacao(
    pedido: ConfirmacaoPedido,
    idempotencyKey?: string,
  ): Promise<StatusEnvioEmail> {
    if (this.config.get<string>('RESEND_API_KEY')) {
      return this.resendService.enviarConfirmacao(pedido, idempotencyKey);
    }

    if (!this.transport) return StatusEnvioEmail.DESABILITADO;

    try {
      const resultado = await this.transport.sendMail({
        from: {
          name: 'Alva Modas',
          address: this.config.get<string>(
            'SMTP_FROM',
            'pedidos@alvamodas.test',
          ),
        },
        to: { address: pedido.emailCliente, name: pedido.nomeCliente },
        subject: `Alva Modas - Pedido ${pedido.idPedido} confirmado`,
        html: confirmacaoHtml(pedido),
        text: confirmacaoTexto(pedido),
      });

      return resultado.accepted.length === 1 && resultado.rejected.length === 0
        ? StatusEnvioEmail.ACEITO_PELO_SMTP
        : StatusEnvioEmail.FALHOU;
    } catch {
      return StatusEnvioEmail.FALHOU;
    }
  }

  onModuleDestroy() {
    this.transport?.close();
  }
}
