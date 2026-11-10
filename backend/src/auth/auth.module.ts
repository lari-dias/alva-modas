import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cliente } from './entities/cliente.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cliente]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret || secret.length < 32)
          throw new Error(
            'Configure JWT_SECRET com pelo menos 32 caracteres aleatórios.',
          );
        if (
          config.get<string>(
            'NODE_ENV',
            process.env.NODE_ENV ?? 'development',
          ) === 'production' &&
          config.get<string>('JWT_COOKIE_SECURE') !== 'true'
        )
          throw new Error('JWT_COOKIE_SECURE deve ser true em produção HTTPS.');
        return {
          secret,
          signOptions: {
            expiresIn: '1h',
            algorithm: 'HS256',
            issuer: 'alva-modas',
            audience: 'alva-clientes',
          },
          verifyOptions: {
            algorithms: ['HS256'],
            issuer: 'alva-modas',
            audience: 'alva-clientes',
          },
        };
      },
    }),
  ],
  providers: [AuthService, AuthRateLimitGuard],
  controllers: [AuthController],
})
export class AuthModule {}
