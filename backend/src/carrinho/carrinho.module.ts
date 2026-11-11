import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Produto } from '../produtos/entities/produto.entity';
import { CarrinhoController } from './carrinho.controller';
import { CarrinhoCheckoutService } from './carrinho-checkout.service';
import { CarrinhoService } from './carrinho.service';

@Module({
  imports: [TypeOrmModule.forFeature([Produto])],
  controllers: [CarrinhoController],
  providers: [CarrinhoService, CarrinhoCheckoutService],
  exports: [CarrinhoService],
})
export class CarrinhoModule {}
