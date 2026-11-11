import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { In, Repository } from 'typeorm';
import { Produto } from '../produtos/entities/produto.entity';
import { LIMITES_CARRINHO } from './carrinho.constants';
import { AdicionarItemDto } from './dto/adicionar-item.dto';
import { AtualizarItemDto } from './dto/atualizar-item.dto';
import { CarrinhoRespostaDto } from './dto/carrinho-resposta.dto';
import { paraCentavos } from './centavos';

interface Carrinho {
  itens: Map<string, number>;
  produtos: Map<string, Produto>;
  ultimaAtividade: number;
  ocupado: boolean;
}

@Injectable()
export class CarrinhoService implements OnModuleInit, OnModuleDestroy {
  private readonly carrinhos = new Map<string, Carrinho>();
  private limpeza?: ReturnType<typeof setInterval>;

  constructor(
    @InjectRepository(Produto) private readonly produtos: Repository<Produto>,
  ) {}

  onModuleInit() {
    this.limpeza = setInterval(
      () => this.limparExpirados(),
      LIMITES_CARRINHO.limpezaMs,
    );
    this.limpeza.unref();
  }

  onModuleDestroy() {
    if (this.limpeza) clearInterval(this.limpeza);
    this.carrinhos.clear();
  }

  async adicionar(
    dto: AdicionarItemDto,
    id?: string,
  ): Promise<CarrinhoRespostaDto> {
    this.validarQuantidade(dto.quantidade, 1);
    return this.operar(id, true, (itens) => {
      itens.set(
        dto.produtoId,
        (itens.get(dto.produtoId) ?? 0) + dto.quantidade,
      );
    });
  }

  consultar(id: string): Promise<CarrinhoRespostaDto> {
    return this.operar(id, false);
  }

  descartarConfirmado(id: string): void {
    this.carrinhos.delete(id);
  }

  async atualizar(
    dto: AtualizarItemDto,
    id: string,
  ): Promise<CarrinhoRespostaDto> {
    this.validarQuantidade(dto.quantidade, 0);
    return this.operar(id, false, (itens) => {
      if (!itens.has(dto.produtoId))
        throw new NotFoundException({
          code: 'CART_ITEM_NOT_FOUND',
          message: 'Produto não encontrado no carrinho.',
        });
      const reducao = dto.quantidade < itens.get(dto.produtoId)!;
      if (dto.quantidade === 0) itens.delete(dto.produtoId);
      else itens.set(dto.produtoId, dto.quantidade);
      return reducao;
    });
  }

  async finalizar<T>(
    id: string,
    confirmar: (itens: ReadonlyMap<string, number>) => Promise<T>,
  ): Promise<T> {
    this.limparExpirados();
    const carrinho = this.carrinhos.get(id);
    if (!carrinho)
      throw new NotFoundException({
        code: 'CART_NOT_FOUND',
        message: 'Carrinho não encontrado ou expirado.',
      });
    if (carrinho.ocupado)
      throw new ConflictException('Carrinho em atualização. Tente novamente.');
    if (!carrinho.itens.size) throw new BadRequestException('Carrinho vazio.');
    this.validarLimites(carrinho.itens);
    carrinho.ocupado = true;
    try {
      const resultado = await confirmar(new Map(carrinho.itens));
      this.carrinhos.delete(id);
      return resultado;
    } finally {
      carrinho.ocupado = false;
    }
  }

  private async operar(
    id: string | undefined,
    criar: boolean,
    alterar?: (itens: Map<string, number>) => boolean | void,
  ): Promise<CarrinhoRespostaDto> {
    this.limparExpirados();
    const novo = id === undefined;
    if (novo && !criar)
      throw new BadRequestException('Informe o header X-Cart-Id.');
    if (novo && this.carrinhos.size >= LIMITES_CARRINHO.carrinhos) {
      throw new ServiceUnavailableException(
        'Limite de carrinhos atingido. Tente novamente mais tarde.',
      );
    }
    const cartId = id ?? randomUUID();
    const carrinho = novo
      ? {
          itens: new Map<string, number>(),
          produtos: new Map<string, Produto>(),
          ultimaAtividade: Date.now(),
          ocupado: false,
        }
      : this.carrinhos.get(cartId);
    if (!carrinho)
      throw new NotFoundException({
        code: 'CART_NOT_FOUND',
        message: 'Carrinho não encontrado ou expirado.',
      });
    if (carrinho.ocupado)
      throw new ConflictException('Carrinho em atualização. Tente novamente.');
    carrinho.ocupado = true;
    if (novo) this.carrinhos.set(cartId, carrinho);
    try {
      const itens = new Map(carrinho.itens);
      const recuperando = alterar ? alterar(itens) === true : true;
      this.validarLimites(itens);
      const produtos = new Map(carrinho.produtos);
      const resposta = await this.montarResposta(
        cartId,
        itens,
        produtos,
        recuperando,
      );
      carrinho.itens = itens;
      carrinho.produtos = new Map(
        [...produtos].filter(([id]) => itens.has(id)),
      );
      carrinho.ultimaAtividade = Date.now();
      return resposta;
    } catch (error) {
      if (novo) this.carrinhos.delete(cartId);
      throw error;
    } finally {
      carrinho.ocupado = false;
    }
  }

  private validarQuantidade(quantidade: number, minimo: number) {
    if (
      !Number.isInteger(quantidade) ||
      quantidade < minimo ||
      quantidade > LIMITES_CARRINHO.unidadesPorItem
    ) {
      throw new BadRequestException(
        `Quantidade deve ser inteira entre ${minimo} e ${LIMITES_CARRINHO.unidadesPorItem}.`,
      );
    }
  }

  private validarLimites(itens: Map<string, number>) {
    if (itens.size > LIMITES_CARRINHO.itens)
      throw new BadRequestException(
        `Máximo de ${LIMITES_CARRINHO.itens} produtos distintos por carrinho.`,
      );
    let unidades = 0;
    for (const quantidade of itens.values()) {
      this.validarQuantidade(quantidade, 1);
      unidades += quantidade;
    }
    if (unidades > LIMITES_CARRINHO.unidades)
      throw new BadRequestException(
        `Máximo de ${LIMITES_CARRINHO.unidades} unidades por carrinho.`,
      );
  }

  private async montarResposta(
    idCarrinho: string,
    quantidades: Map<string, number>,
    anteriores: Map<string, Produto>,
    recuperando: boolean,
  ): Promise<CarrinhoRespostaDto> {
    if (!quantidades.size) return { idCarrinho, itens: [], totalCentavos: 0 };
    const produtos = await this.produtos.find({
      where: { id: In([...quantidades.keys()]) },
      select: {
        id: true,
        nome: true,
        descricao: true,
        preco: true,
        imagemUrl: true,
        categoria: true,
        estoque: true,
        ativo: true,
      },
    });
    const porId = new Map(produtos.map((produto) => [produto.id, produto]));
    const itens = [...quantidades].map(([id, quantidade]) => {
      const atual = porId.get(id);
      const produto = atual ?? (recuperando ? anteriores.get(id) : undefined);
      if (!produto)
        throw new NotFoundException({
          code: 'PRODUCT_NOT_FOUND',
          message: 'Produto não encontrado.',
        });
      if (!recuperando && !produto.ativo)
        throw new ConflictException('Produto inativo. Remova-o do carrinho.');
      if (!recuperando && produto.estoque < quantidade)
        throw new ConflictException(
          'Estoque insuficiente. Ajuste a quantidade do produto.',
        );
      const precoUnitarioCentavos = paraCentavos(produto.preco);
      if (atual) anteriores.set(id, { ...atual });
      return {
        disponivel: Boolean(atual?.ativo && atual.estoque >= quantidade),
        produto: {
          id: produto.id,
          nome: produto.nome,
          descricao: produto.descricao,
          preco: produto.preco,
          imagemUrl: produto.imagemUrl,
          categoria: produto.categoria,
          estoque: atual?.estoque ?? 0,
        },
        quantidade,
        precoUnitarioCentavos,
        subtotalCentavos: precoUnitarioCentavos * quantidade,
      };
    });
    return {
      idCarrinho,
      itens,
      totalCentavos: itens.reduce(
        (total, item) => total + item.subtotalCentavos,
        0,
      ),
    };
  }

  private limparExpirados() {
    const agora = Date.now();
    for (const [id, carrinho] of this.carrinhos) {
      if (
        !carrinho.ocupado &&
        agora - carrinho.ultimaAtividade >= LIMITES_CARRINHO.expiracaoMs
      )
        this.carrinhos.delete(id);
    }
  }
}
