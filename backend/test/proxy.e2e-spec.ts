import { Controller, Get, INestApplication, Req } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApp } from '../src/app.setup';

@Controller('proxy-check')
class ProxyCheckController {
  @Get()
  consultar(@Req() req: Request) {
    return { ip: req.ip };
  }
}

describe('Trusted reverse proxy', () => {
  it.each([0, 1])(
    'only trusts the configured number of proxy hops: %i',
    async (hops) => {
      const module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            ignoreEnvFile: true,
            ignoreEnvVars: true,
            load: [
              () => ({
                FRONTEND_URL: 'https://www.loja-alva.test',
                TRUST_PROXY_HOPS: hops,
              }),
            ],
          }),
        ],
        controllers: [ProxyCheckController],
      }).compile();
      const app: INestApplication<App> = module.createNestApplication();
      configureApp(app);
      await app.init();
      try {
        const response = await request(app.getHttpServer())
          .get('/proxy-check')
          .set('X-Forwarded-For', '198.51.100.1, 203.0.113.2')
          .expect(200);
        const body = response.body as { ip: string };
        if (hops === 1) expect(body.ip).toBe('203.0.113.2');
        else expect(body.ip).not.toMatch(/198\.51\.100|203\.0\.113/);
      } finally {
        await app.close();
      }
    },
  );
});
