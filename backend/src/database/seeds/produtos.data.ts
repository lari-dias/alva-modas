import { Produto } from '../../produtos/entities/produto.entity';

type ProdutoSeed = Pick<
  Produto,
  | 'id'
  | 'nome'
  | 'descricao'
  | 'preco'
  | 'imagemUrl'
  | 'categoria'
  | 'estoque'
  | 'ativo'
>;

export const PRODUTOS_SEED: ProdutoSeed[] = [
  {
    id: 'a17a0000-0000-4000-8000-000000000001',
    nome: 'Vestido Floral Aurora',
    descricao: 'Vestido floral para passeios e encontros.',
    preco: '189.90',
    imagemUrl:
      'https://images.pexels.com/photos/9397491/pexels-photo-9397491.jpeg?auto=compress&cs=tinysrgb&w=800',
    categoria: 'Vestidos',
    estoque: 15,
    ativo: true,
  },
  {
    id: 'a17a0000-0000-4000-8000-000000000002',
    nome: 'Vestido Vermelho Rubi',
    descricao: 'Vestido vermelho para ocasiões especiais.',
    preco: '229.90',
    imagemUrl:
      'https://images.pexels.com/photos/35858117/pexels-photo-35858117.jpeg?auto=compress&cs=tinysrgb&w=800',
    categoria: 'Vestidos',
    estoque: 10,
    ativo: true,
  },
  {
    id: 'a17a0000-0000-4000-8000-000000000003',
    nome: 'Vestido Preto Essencial',
    descricao: 'Vestido preto versátil para compor diferentes looks.',
    preco: '169.90',
    imagemUrl:
      'https://images.pexels.com/photos/15555033/pexels-photo-15555033.jpeg?auto=compress&cs=tinysrgb&w=800',
    categoria: 'Vestidos',
    estoque: 18,
    ativo: true,
  },
  {
    id: 'a17a0000-0000-4000-8000-000000000004',
    nome: 'Blusa Preta Elegance',
    descricao: 'Blusa preta para combinações casuais e de trabalho.',
    preco: '89.90',
    imagemUrl:
      'https://images.pexels.com/photos/33374992/pexels-photo-33374992.jpeg?auto=compress&cs=tinysrgb&w=800',
    categoria: 'Blusas',
    estoque: 25,
    ativo: true,
  },
  {
    id: 'a17a0000-0000-4000-8000-000000000005',
    nome: 'Blusa Branca Serena',
    descricao: 'Blusa branca para um visual clássico.',
    preco: '99.90',
    imagemUrl:
      'https://images.pexels.com/photos/7752617/pexels-photo-7752617.jpeg?auto=compress&cs=tinysrgb&w=800',
    categoria: 'Blusas',
    estoque: 22,
    ativo: true,
  },
  {
    id: 'a17a0000-0000-4000-8000-000000000006',
    nome: 'Blusa Floral Jardim',
    descricao: 'Blusa estampada com flores para o dia a dia.',
    preco: '79.90',
    imagemUrl:
      'https://images.pexels.com/photos/11577107/pexels-photo-11577107.jpeg?auto=compress&cs=tinysrgb&w=800',
    categoria: 'Blusas',
    estoque: 30,
    ativo: true,
  },
  {
    id: 'a17a0000-0000-4000-8000-000000000007',
    nome: 'Calça Jeans Urbana',
    descricao: 'Calça jeans para composições urbanas.',
    preco: '149.90',
    imagemUrl:
      'https://images.pexels.com/photos/8856113/pexels-photo-8856113.jpeg?auto=compress&cs=tinysrgb&w=800',
    categoria: 'Calças',
    estoque: 20,
    ativo: true,
  },
  {
    id: 'a17a0000-0000-4000-8000-000000000008',
    nome: 'Calça Bege Cidade',
    descricao: 'Calça bege para combinar com peças neutras.',
    preco: '159.90',
    imagemUrl:
      'https://images.pexels.com/photos/13578630/pexels-photo-13578630.jpeg?auto=compress&cs=tinysrgb&w=800',
    categoria: 'Calças',
    estoque: 16,
    ativo: true,
  },
  {
    id: 'a17a0000-0000-4000-8000-000000000009',
    nome: 'Calça Jeans Horizonte',
    descricao: 'Calça jeans azul para looks descontraídos.',
    preco: '139.90',
    imagemUrl:
      'https://images.pexels.com/photos/17630808/pexels-photo-17630808.jpeg?auto=compress&cs=tinysrgb&w=800',
    categoria: 'Calças',
    estoque: 24,
    ativo: true,
  },
  {
    id: 'a17a0000-0000-4000-8000-000000000010',
    nome: 'Conjunto Laranja Solar',
    descricao: 'Conjunto de duas peças em tom laranja.',
    preco: '249.90',
    imagemUrl:
      'https://images.pexels.com/photos/8801174/pexels-photo-8801174.jpeg?auto=compress&cs=tinysrgb&w=800',
    categoria: 'Conjuntos',
    estoque: 12,
    ativo: true,
  },
  {
    id: 'a17a0000-0000-4000-8000-000000000011',
    nome: 'Conjunto Bege Executivo',
    descricao: 'Conjunto feminino de blazer e calça bege.',
    preco: '349.90',
    imagemUrl:
      'https://images.pexels.com/photos/3888210/pexels-photo-3888210.jpeg?auto=compress&cs=tinysrgb&w=800',
    categoria: 'Conjuntos',
    estoque: 8,
    ativo: true,
  },
  {
    id: 'a17a0000-0000-4000-8000-000000000012',
    nome: 'Conjunto Rosa Presença',
    descricao: 'Conjunto feminino rosa para um visual marcante.',
    preco: '329.90',
    imagemUrl:
      'https://images.pexels.com/photos/7203494/pexels-photo-7203494.jpeg?auto=compress&cs=tinysrgb&w=800',
    categoria: 'Conjuntos',
    estoque: 10,
    ativo: true,
  },
];
