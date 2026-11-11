import { ConfigService } from '@nestjs/config';
import { ResendService } from './resend.service';
import { ConfirmacaoPedido, StatusEnvioEmail } from './confirmacao-pedido';

const mockSend = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: mockSend,
    },
  })),
}));

describe('ResendService', () => {
  const pedido: ConfirmacaoPedido = {
    idPedido: 'pedido-123',
    nomeCliente: 'Maria Silva',
    emailCliente: 'cliente@exemplo.com',
    itens: [
      {
        produtoId: 'produto-123',
        nomeProduto: 'Blusa Branca Serena',
        quantidade: 1,
        precoUnitarioCentavos: 9990,
        subtotalCentavos: 9990,
      },
    ],
    totalCentavos: 9990,
  };

  const criarService = (apiKey?: string) => {
    const config = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'RESEND_API_KEY') return apiKey;
        if (key === 'RESEND_FROM') {
          return 'Alva Modas <onboarding@resend.dev>';
        }
        return defaultValue;
      }),
    } as unknown as ConfigService;

    return new ResendService(config);
  };

  beforeEach(() => {
    mockSend.mockReset();
  });

  it('retorna DESABILITADO quando não existe chave da Resend', async () => {
    const service = criarService();

    expect(await service.enviarConfirmacao(pedido)).toBe(
      StatusEnvioEmail.DESABILITADO,
    );

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('retorna ACEITO_PELA_API quando a Resend aceita o envio', async () => {
    mockSend.mockResolvedValue({
      data: { id: 'email-123' },
      error: null,
    });

    const service = criarService('re_test_key');

    expect(await service.enviarConfirmacao(pedido)).toBe(
      StatusEnvioEmail.ACEITO_PELA_API,
    );

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Alva Modas <onboarding@resend.dev>',
        to: pedido.emailCliente,
        subject: `Alva Modas - Pedido ${pedido.idPedido} confirmado`,
        html: expect.any(String) as string,
        text: expect.any(String) as string,
      }),
      undefined,
    );
  });

  it('retorna FALHOU quando a API responde com erro', async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: 'Falha no envio' },
    });

    const service = criarService('re_test_key');

    expect(await service.enviarConfirmacao(pedido)).toBe(
      StatusEnvioEmail.FALHOU,
    );
  });

  it('encaminha a chave persistente de idempotência à Resend', async () => {
    mockSend.mockResolvedValue({ data: { id: 'email-123' }, error: null });
    await criarService('re_test_key').enviarConfirmacao(
      pedido,
      'checkout/pedido-123',
    );
    expect(mockSend).toHaveBeenCalledWith(expect.any(Object), {
      idempotencyKey: 'checkout/pedido-123',
      signal: expect.any(AbortSignal) as AbortSignal,
    });
  });

  it('retorna FALHOU quando a API não retorna um ID', async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: null,
    });

    const service = criarService('re_test_key');

    expect(await service.enviarConfirmacao(pedido)).toBe(
      StatusEnvioEmail.FALHOU,
    );
  });

  it('retorna FALHOU quando ocorre uma exceção', async () => {
    mockSend.mockRejectedValue(new Error('Erro de conexão'));

    const service = criarService('re_test_key');

    expect(await service.enviarConfirmacao(pedido)).toBe(
      StatusEnvioEmail.FALHOU,
    );
  });
});
