import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { EmailService } from '../email/email.service';
import {
  ConfirmacaoPedido,
  StatusEnvioEmail,
} from '../email/confirmacao-pedido';

@Injectable()
export class CheckoutOutboxService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private executando: Promise<void> | null = null;
  private readonly logger = new Logger(CheckoutOutboxService.name);
  constructor(
    private readonly db: DataSource,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (this.config.get<boolean>('CHECKOUT_OUTBOX_ENABLED') !== true) return;
    if (
      !this.config.get<string>('RESEND_API_KEY') &&
      !this.config.get<boolean>('SMTP_ENABLED')
    )
      throw new Error('A outbox exige Resend ou SMTP configurado.');
    this.timer = setInterval(() => this.iniciar(), 5000);
    this.timer.unref();
    this.iniciar();
  }

  private iniciar() {
    if (this.executando) return;
    this.executando = this.processar()
      .catch(() => {
        this.logger.error('Falha ao processar outbox; evento preservado.');
      })
      .finally(() => {
        this.executando = null;
      });
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.executando;
  }

  async processar(): Promise<void> {
    const evento = await this.db.transaction(async (manager) => {
      const rows: {
        pedido_id: string;
        conteudo: ConfirmacaoPedido;
        primeira_tentativa: Date;
      }[] = await manager.query(`
        SELECT * FROM email_outbox WHERE estado = 'PENDENTE' AND proxima_tentativa <= now()
        ORDER BY criado_em LIMIT 1 FOR UPDATE SKIP LOCKED`);
      const row = rows[0];
      if (!row) return null;
      if (
        row.primeira_tentativa &&
        (!this.config.get<string>('RESEND_API_KEY') ||
          Date.now() - new Date(row.primeira_tentativa).getTime() >=
            23 * 60 * 60 * 1000)
      ) {
        await manager.query(
          "UPDATE email_outbox SET estado = 'REVISAO' WHERE pedido_id = $1",
          [row.pedido_id],
        );
        await manager.query(
          `UPDATE checkout_tentativas SET resultado = jsonb_set(resultado, '{emailStatus}', '"FALHOU"'::jsonb) WHERE pedido_id = $1`,
          [row.pedido_id],
        );
        return null;
      }
      await manager.query(
        `UPDATE email_outbox SET primeira_tentativa = COALESCE(primeira_tentativa, now()),
        proxima_tentativa = now() + interval '2 minutes', tentativas = tentativas + 1 WHERE pedido_id = $1`,
        [row.pedido_id],
      );
      return row;
    });
    if (!evento) return;
    const status = await this.email.enviarConfirmacao(
      evento.conteudo,
      `checkout/${evento.pedido_id}`,
    );
    if (
      status !== StatusEnvioEmail.ACEITO_PELA_API &&
      status !== StatusEnvioEmail.ACEITO_PELO_SMTP
    )
      return;
    await this.db.transaction(async (manager) => {
      await manager.query(
        "UPDATE email_outbox SET estado = 'ENVIADO' WHERE pedido_id = $1",
        [evento.pedido_id],
      );
      await manager.query(
        `UPDATE checkout_tentativas SET resultado = jsonb_set(resultado, '{emailStatus}', to_jsonb($2::text)) WHERE pedido_id = $1`,
        [evento.pedido_id, status],
      );
    });
  }
}
