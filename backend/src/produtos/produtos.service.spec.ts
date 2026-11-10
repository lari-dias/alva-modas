import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProdutosService } from './produtos.service';
import { Produto } from './entities/produto.entity';

describe('ProdutosService', () => {
  const repository = { find: jest.fn() };
  let service: ProdutosService;

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ProdutosService,
        { provide: getRepositoryToken(Produto), useValue: repository },
      ],
    }).compile();
    service = module.get(ProdutosService);
  });

  it('queries only active products, ordered by name, with the catalog fields', async () => {
    repository.find.mockResolvedValue([]);
    await expect(service.listar()).resolves.toEqual([]);
    expect(repository.find).toHaveBeenCalledWith({
      where: { ativo: true },
      order: { nome: 'ASC' },
      select: {
        id: true,
        nome: true,
        descricao: true,
        preco: true,
        imagemUrl: true,
        categoria: true,
        estoque: true,
      },
    });
  });

  it('preserves decimal strings, null descriptions and zero stock without exposing internal fields', async () => {
    const product = {
      id: 'a17a0000-0000-4000-8000-000000000001',
      nome: 'Vestido',
      descricao: null,
      preco: '189.90',
      imagemUrl: 'https://example.com/vestido.jpg',
      categoria: 'Vestidos',
      estoque: 0,
    };
    repository.find.mockResolvedValue([
      {
        ...product,
        ativo: true,
        criadoEm: new Date(),
        atualizadoEm: new Date(),
      },
    ]);
    await expect(service.listar()).resolves.toEqual([product]);
  });
});
