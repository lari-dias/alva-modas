import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnvironment } from './config/environment';
import { databaseOptions } from './database/database.options';
import { ProdutosModule } from './produtos/produtos.module';
import { CarrinhoModule } from './carrinho/carrinho.module';
import { PedidosModule } from './pedidos/pedidos.module';
import { EmailModule } from './email/email.module';
import { FinalizarCompraModule } from './finalizar-compra/finalizar-compra.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    TypeOrmModule.forRootAsync({
      useFactory: () => databaseOptions(process.env),
    }),
    ProdutosModule,
    CarrinhoModule,
    PedidosModule,
    EmailModule,
    FinalizarCompraModule,
    AuthModule,
  ],
})
export class AppModule {}
