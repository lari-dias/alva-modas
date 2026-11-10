import { DataSource } from 'typeorm';
import { Produto } from '../../produtos/entities/produto.entity';
import { PRODUTOS_SEED } from './produtos.data';

export async function seedProdutos(dataSource: DataSource): Promise<void> {
  await dataSource.transaction(async (manager) => {
    await manager
      .getRepository(Produto)
      .createQueryBuilder()
      .insert()
      .values(PRODUTOS_SEED)
      .orIgnore()
      .execute();
  });
}
