import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Produto } from './entities/produto.entity';
import { ProdutoRespostaDto } from './dto/produto-resposta.dto';

@Injectable()
export class ProdutosService {
  constructor(
    @InjectRepository(Produto) private readonly produtos: Repository<Produto>,
  ) {}

  async listar(): Promise<ProdutoRespostaDto[]> {
    const produtos = await this.produtos.find({
      where: { ativo: true },
      select: {
        id: true,
        nome: true,
        descricao: true,
        preco: true,
        imagemUrl: true,
        categoria: true,
        estoque: true,
      },
      order: { nome: 'ASC' },
    });
    return produtos.map(
      ({ id, nome, descricao, preco, imagemUrl, categoria, estoque }) => ({
        id,
        nome,
        descricao,
        preco,
        imagemUrl,
        categoria,
        estoque,
      }),
    );
  }
}
