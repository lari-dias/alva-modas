import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from '../src/app.setup';
import { AuthModule } from '../src/auth/auth.module';
import { Cliente } from '../src/auth/entities/cliente.entity';

describe('Autenticação HTTP (repositório em memória)', () => {
  let app: INestApplication<App>;
  const clientes = new Map<string, Cliente>();
  const dados = {
    nome: 'Maria Silva',
    email: 'cliente@example.com',
    senha: 'Senha-segura-123',
    confirmacaoSenha: 'Senha-segura-123',
  };
  const repository = {
    existsBy: jest.fn(({ email }: { email: string }) =>
      Promise.resolve(clientes.has(email)),
    ),
    create: jest.fn((cliente: Cliente) => ({
      ...cliente,
      id: 'a17a0000-0000-4000-8000-000000000001',
    })),
    save: jest.fn((cliente: Cliente) => {
      clientes.set(cliente.email, cliente);
      return Promise.resolve(cliente);
    }),
    findOne: jest.fn(({ where }: { where: { email: string } }) =>
      Promise.resolve(clientes.get(where.email) ?? null),
    ),
    findOneBy: jest.fn(({ id }: { id: string }) =>
      Promise.resolve(
        [...clientes.values()].find((cliente) => cliente.id === id) ?? null,
      ),
    ),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          load: [
            () => ({
              FRONTEND_URL: 'http://localhost:5173',
              JWT_SECRET: 'test-only-secret-with-at-least-32-characters',
              JWT_COOKIE_SECURE: 'false',
            }),
          ],
        }),
        AuthModule,
      ],
    })
      .overrideProvider(getRepositoryToken(Cliente))
      .useValue(repository)
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });
  beforeEach(() => {
    clientes.clear();
  });
  afterAll(async () => {
    await app.close();
  });

  it('cadastra, consulta sessão, faz login e logout sem expor token ou senha no JSON', async () => {
    const agent = request.agent(app.getHttpServer());
    const cadastro = await agent
      .post('/auth/cadastro')
      .set('Origin', 'http://localhost:5173')
      .send({ ...dados, email: ' CLIENTE@example.com ' })
      .expect(201);
    expect(cadastro.body).toEqual({
      id: 'a17a0000-0000-4000-8000-000000000001',
      nome: dados.nome,
      email: dados.email,
    });
    expect(cadastro.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(cadastro.headers['set-cookie'][0]).toContain('SameSite=Strict');
    expect(cadastro.headers['set-cookie'][0]).toContain('Path=/auth');
    expect(cadastro.headers['cache-control']).toBe('no-store');
    await agent.get('/auth/me').expect(200).expect(cadastro.body);
    await agent.post('/auth/logout').send({}).expect(204);
    await agent.get('/auth/me').expect(401);
    await agent
      .post('/auth/login')
      .send({ email: dados.email, senha: dados.senha })
      .expect(200);
    await agent.get('/auth/me').expect(200).expect(cadastro.body);
  });

  it.each([
    { nome: '' },
    { nome: ' '.repeat(3) },
    { email: 'invalido' },
    { senha: 'curta' },
    { senha: 'x'.repeat(129) },
    { confirmacaoSenha: 'diferente' },
    { senha: 12345678 },
    { preco: '0.01' },
  ])('rejeita cadastro inválido: %j', async (alteracao) => {
    await request(app.getHttpServer())
      .post('/auth/cadastro')
      .send({ ...dados, ...alteracao })
      .expect(400);
    expect(clientes.size).toBe(0);
  });

  it('rejeita e-mail duplicado com outra capitalização', async () => {
    await request(app.getHttpServer())
      .post('/auth/cadastro')
      .send(dados)
      .expect(201);
    await request(app.getHttpServer())
      .post('/auth/cadastro')
      .send({ ...dados, email: dados.email.toUpperCase() })
      .expect(409);
  });

  it('rejeita credenciais erradas e sessão inválida', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: dados.email, senha: dados.senha })
      .expect(401);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', 'alva_session=invalid')
      .expect(401);
  });

  it('bloqueia origem externa e permite CORS credenciado somente para o frontend', async () => {
    await request(app.getHttpServer())
      .post('/auth/cadastro')
      .set('Origin', 'https://other.example')
      .send(dados)
      .expect(403);
    const response = await request(app.getHttpServer())
      .options('/auth/login')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('limita tentativas repetidas de autenticação', async () => {
    for (let tentativa = 0; tentativa < 21; tentativa++)
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: dados.email, senha: dados.senha });
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: dados.email, senha: dados.senha })
      .expect(429);
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });
});
