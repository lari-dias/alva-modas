import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pedido } from './entities/pedido.entity';
import { ItemPedido } from './entities/item-pedido.entity';

@Module({ imports: [TypeOrmModule.forFeature([Pedido, ItemPedido])] })
export class PedidosModule {}
