import dataSource from '../data-source';
import { seedProdutos } from './produtos.seed';

async function main() {
  try {
    await dataSource.initialize();
    await seedProdutos(dataSource);
    console.log(
      'Seed de produtos concluído. Produtos existentes foram preservados.',
    );
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

void main().catch(() => {
  console.error(
    'Não foi possível executar o seed. Verifique o PostgreSQL, as migrations e as variáveis de ambiente.',
  );
  process.exitCode = 1;
});
