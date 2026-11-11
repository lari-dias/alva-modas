import { Module } from '@nestjs/common';
import { CarrinhoModule } from '../carrinho/carrinho.module';
import { EmailModule } from '../email/email.module';
import { FinalizarCompraController } from './finalizar-compra.controller';
import { FinalizarCompraService } from './finalizar-compra.service';
import { AuthModule } from '../auth/auth.module';
import { CheckoutTentativasService } from './checkout-tentativas.service';
import { CheckoutTentativasController } from './checkout-tentativas.controller';
import { CheckoutOutboxService } from './checkout-outbox.service';
import { CheckoutDeploymentService } from './checkout-deployment.service';
import { CheckoutDeploymentController } from './checkout-deployment.controller';

@Module({
  imports: [CarrinhoModule, EmailModule, AuthModule],
  controllers: [
    FinalizarCompraController,
    CheckoutTentativasController,
    CheckoutDeploymentController,
  ],
  providers: [
    FinalizarCompraService,
    CheckoutTentativasService,
    CheckoutOutboxService,
    CheckoutDeploymentService,
  ],
})
export class FinalizarCompraModule {}
