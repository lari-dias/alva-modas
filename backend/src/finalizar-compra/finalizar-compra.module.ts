import { Module } from '@nestjs/common';
import { CarrinhoModule } from '../carrinho/carrinho.module';
import { EmailModule } from '../email/email.module';
import { FinalizarCompraController } from './finalizar-compra.controller';
import { FinalizarCompraService } from './finalizar-compra.service';

@Module({
  imports: [CarrinhoModule, EmailModule],
  controllers: [FinalizarCompraController],
  providers: [FinalizarCompraService],
})
export class FinalizarCompraModule {}
