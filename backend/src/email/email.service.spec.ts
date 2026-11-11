import { ConfigService } from '@nestjs/config';
import { SMTPServer } from 'smtp-server';
import type { AddressInfo } from 'node:net';
import { EmailService } from './email.service';
import { ConfirmacaoPedido, StatusEnvioEmail } from './confirmacao-pedido';
import { confirmacaoHtml } from './confirmacao.template';
import { smtpProvider } from './smtp.provider';
import { ResendService } from './resend.service';

describe('EmailService with local SMTP sink', () => {
  const resend = new ResendService(new ConfigService());
  const pedido: ConfirmacaoPedido = {
    idPedido: 'a17a0000-0000-4000-8000-000000000099',
    nomeCliente: 'Maria',
    emailCliente: 'cliente@example.test',
    itens: [
      {
        produtoId: 'a17a0000-0000-4000-8000-000000000001',
        nomeProduto: 'Blusa',
        quantidade: 2,
        precoUnitarioCentavos: 2999,
        subtotalCentavos: 5998,
      },
    ],
    totalCentavos: 5998,
  };
  let server: SMTPServer;
  let service: EmailService;
  let rejeitar: boolean;
  let mensagens: string[];
  let destinatarios: string[];

  beforeEach(async () => {
    rejeitar = false;
    mensagens = [];
    destinatarios = [];
    server = new SMTPServer({
      disableReverseLookup: true,
      authOptional: true,
      disabledCommands: ['AUTH', 'STARTTLS'],
      logger: false,
      onData(stream, session, callback) {
        let mensagem = '';
        stream.on('data', (chunk: Buffer) => {
          mensagem += chunk.toString();
        });
        stream.on('end', () => {
          if (rejeitar) {
            callback(new Error('Test SMTP rejection'));
            return;
          }
          mensagens.push(mensagem);
          destinatarios.push(
            ...session.envelope.rcptTo.map((address) => address.address),
          );
          callback();
        });
      },
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const port = (server.server.address() as AddressInfo).port;
    const config = new ConfigService({
      SMTP_ENABLED: true,
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: port,
      SMTP_SECURE: false,
      SMTP_FROM: 'pedidos@alvamodas.test',
    });
    service = new EmailService(smtpProvider.useFactory(config), config, resend);
  });

  afterEach(async () => {
    service.onModuleDestroy();
    await new Promise<void>((resolve) => server.close(resolve));
  });

  it('refuses plaintext fallback when the SMTP server does not support STARTTLS', async () => {
    const config = new ConfigService({
      SMTP_ENABLED: true,
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: (server.server.address() as AddressInfo).port,
      SMTP_REQUIRE_TLS: true,
    });
    const protectedService = new EmailService(
      smtpProvider.useFactory(config),
      config,
      resend,
    );
    try {
      expect(await protectedService.enviarConfirmacao(pedido)).toBe(
        StatusEnvioEmail.FALHOU,
      );
      expect(mensagens).toHaveLength(0);
    } finally {
      protectedService.onModuleDestroy();
    }
  });

  it('sends an HTML confirmation to an isolated SMTP sink without external delivery', async () => {
    expect(await service.enviarConfirmacao(pedido)).toBe(
      StatusEnvioEmail.ACEITO_PELO_SMTP,
    );
    expect(destinatarios).toEqual(['cliente@example.test']);
    expect(mensagens).toHaveLength(1);
    expect(mensagens[0]).toContain('text/html');
    expect(mensagens[0]).toContain('Alva Modas');
    expect(mensagens[0]).toContain(pedido.idPedido);
    const html = confirmacaoHtml(pedido);
    expect(html).toContain('Blusa');
    expect(html).toContain('R$ 59,98');
    expect(html).toContain('<td>2</td>');
  });

  it('reports a rejected SMTP send as failed', async () => {
    rejeitar = true;
    expect(await service.enviarConfirmacao(pedido)).toBe(
      StatusEnvioEmail.FALHOU,
    );
    expect(mensagens).toHaveLength(0);
  });

  it('does not send when SMTP is disabled', async () => {
    const disabled = new EmailService(null, new ConfigService(), resend);
    expect(await disabled.enviarConfirmacao(pedido)).toBe(
      StatusEnvioEmail.DESABILITADO,
    );
    expect(mensagens).toHaveLength(0);
  });

  it('forwards the durable idempotency key to Resend without sending SMTP', async () => {
    const enviar = jest
      .spyOn(resend, 'enviarConfirmacao')
      .mockResolvedValue(StatusEnvioEmail.ACEITO_PELA_API);
    const api = new EmailService(
      null,
      new ConfigService({ RESEND_API_KEY: 're_test_key' }),
      resend,
    );
    try {
      expect(await api.enviarConfirmacao(pedido, 'checkout/pedido')).toBe(
        StatusEnvioEmail.ACEITO_PELA_API,
      );
      expect(enviar).toHaveBeenCalledWith(pedido, 'checkout/pedido');
      expect(mensagens).toHaveLength(0);
    } finally {
      enviar.mockRestore();
    }
  });

  it('escapes customer and product names in HTML', () => {
    const html = confirmacaoHtml({
      ...pedido,
      nomeCliente: '<script>alert(1)</script>',
      itens: [
        { ...pedido.itens[0], nomeProduto: '<img src=x onerror=alert(1)>' },
      ],
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img');
  });
});
