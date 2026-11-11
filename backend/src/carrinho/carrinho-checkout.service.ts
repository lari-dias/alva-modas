import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class CarrinhoCheckoutService {
  constructor(private readonly db: DataSource) {}

  async executar<T>(
    id: string | undefined,
    operacao: () => Promise<T>,
  ): Promise<T> {
    if (!id) return operacao();
    return this.db.transaction(async (manager) => {
      await manager.query(
        'INSERT INTO checkout_carrinhos(id) VALUES ($1) ON CONFLICT DO NOTHING',
        [id],
      );
      const carts: { confirmado: boolean }[] = await manager.query(
        'SELECT confirmado FROM checkout_carrinhos WHERE id = $1 FOR UPDATE',
        [id],
      );
      const ativos: { id: string }[] = await manager.query(
        "SELECT id FROM checkout_tentativas WHERE carrinho_id = $1 AND estado IN ('PROCESSANDO', 'CONFIRMADA')",
        [id],
      );
      if (carts[0].confirmado || ativos.length)
        throw new ConflictException(
          'Confira o resultado do checkout antes de alterar esta sacola.',
        );
      return operacao();
    });
  }
}
