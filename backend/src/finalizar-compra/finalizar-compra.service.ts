import {
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CarrinhoService } from '../carrinho/carrinho.service';
import { paraCentavos } from '../carrinho/centavos';
import { EmailService } from '../email/email.service';
import {
  ConfirmacaoPedido,
  StatusEnvioEmail,
} from '../email/confirmacao-pedido';
import { Produto } from '../produtos/entities/produto.entity';
import { Pedido } from '../pedidos/entities/pedido.entity';
import { ItemPedido } from '../pedidos/entities/item-pedido.entity';
import { StatusPedido } from '../pedidos/enums/status-pedido.enum';
import { FinalizarCompraDto } from './dto/finalizar-compra.dto';
import { CompraRespostaDto } from './dto/compra-resposta.dto';
import { paraDecimal } from './decimal';

@Injectable()
export class FinalizarCompraService {
  constructor(
    private readonly carrinhos: CarrinhoService,
    private readonly dataSource: DataSource,
    private readonly email: EmailService,
  ) {}

  async finalizar(
    id: string,
    cliente: FinalizarCompraDto,
  ): Promise<CompraRespostaDto> {
    const confirmado = await this.carrinhos.finalizar(
      id,
      async (quantidades) => {
        try {
          return await this.dataSource.transaction(
            async (manager): Promise<ConfirmacaoPedido> => {
              const produtos = await manager
                .getRepository(Produto)
                .createQueryBuilder('produto')
                .where('produto.id IN (:...ids)', {
                  ids: [...quantidades.keys()].sort(),
                })
                .orderBy('produto.id', 'ASC')
                .setLock('pessimistic_write')
                .getMany();
              const porId = new Map(
                produtos.map((produto) => [produto.id, produto]),
              );
              const itens = [...quantidades].map(([produtoId, quantidade]) => {
                const produto = porId.get(produtoId);
                if (!produto)
                  throw new NotFoundException('Produto não encontrado.');
                if (!produto.ativo)
                  throw new ConflictException('Produto inativo.');
                if (produto.estoque < quantidade)
                  throw new ConflictException('Estoque insuficiente.');
                const precoUnitarioCentavos = paraCentavos(produto.preco);
                const subtotalCentavos = precoUnitarioCentavos * quantidade;
                paraDecimal(subtotalCentavos);
                return {
                  produtoId,
                  nomeProduto: produto.nome,
                  quantidade,
                  precoUnitarioCentavos,
                  subtotalCentavos,
                };
              });
              const totalCentavos = itens.reduce(
                (total, item) => total + item.subtotalCentavos,
                0,
              );
              const valorTotal = paraDecimal(totalCentavos);
              const pedido = await manager.save(
                Pedido,
                manager.create(Pedido, {
                  nomeCliente: cliente.nome,
                  emailCliente: cliente.email,
                  valorTotal,
                  status: StatusPedido.CONFIRMADO,
                }),
              );
              const registros = itens.map((item) =>
                manager.create(ItemPedido, {
                  pedido,
                  produto: { id: item.produtoId },
                  nomeProduto: item.nomeProduto,
                  quantidade: item.quantidade,
                  precoUnitario: paraDecimal(item.precoUnitarioCentavos),
                  subtotal: paraDecimal(item.subtotalCentavos),
                }),
              );
              await manager.save(ItemPedido, registros);
              for (const produto of produtos) {
                produto.estoque -= quantidades.get(produto.id)!;
              }
              await manager.save(Produto, produtos);
              return {
                idPedido: pedido.id,
                nomeCliente: cliente.nome,
                emailCliente: cliente.email,
                itens,
                totalCentavos,
              };
            },
          );
        } catch (error) {
          if (error instanceof HttpException) throw error;
          throw new ServiceUnavailableException(
            'Não foi possível confirmar a compra. Consulte o resultado antes de tentar novamente.',
          );
        }
      },
    );
    let emailStatus: StatusEnvioEmail;
    try {
      emailStatus = await this.email.enviarConfirmacao(confirmado);
    } catch {
      emailStatus = StatusEnvioEmail.FALHOU;
    }
    return {
      idPedido: confirmado.idPedido,
      status: StatusPedido.CONFIRMADO,
      itens: confirmado.itens,
      totalCentavos: confirmado.totalCentavos,
      emailStatus,
    };
  }
}
