import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { Cliente } from './entities/cliente.entity';

describe('AuthService', () => {
  const dto = {
    nome: ' Maria Silva ',
    email: ' CLIENTE@example.com ',
    senha: 'Senha-segura-123',
    confirmacaoSenha: 'Senha-segura-123',
  };
  const cliente = {
    id: 'a17a0000-0000-4000-8000-000000000001',
    nome: 'Maria Silva',
    email: 'cliente@example.com',
  };
  let service: AuthService;
  let jwt: JwtService;
  const repository = {
    existsBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jwt = new JwtService({
      secret: 'test-only-secret-with-at-least-32-characters',
      signOptions: { expiresIn: '1h' },
    });
    service = new AuthService(
      repository as unknown as Repository<Cliente>,
      jwt,
    );
    repository.existsBy.mockResolvedValue(false);
    repository.create.mockImplementation((dados: Partial<Cliente>) => ({
      ...dados,
      id: cliente.id,
    }));
    repository.save.mockImplementation((dados: Cliente) =>
      Promise.resolve(dados),
    );
  });

  it('normaliza cadastro, usa Argon2id e retorna somente dados públicos e JWT', async () => {
    const resultado = await service.cadastrar(dto);
    const [salvo] = repository.save.mock.calls[0] as [Cliente];
    expect(salvo.senhaHash).toMatch(/^\$argon2id\$/);
    expect(await argon2.verify(salvo.senhaHash, dto.senha)).toBe(true);
    expect(resultado.cliente).toEqual(cliente);
    expect(jwt.verify<{ sub: string }>(resultado.token).sub).toBe(cliente.id);
    expect(salvo).not.toHaveProperty('senha');
    expect(salvo).not.toHaveProperty('confirmacaoSenha');
  });

  it('rejeita confirmação diferente antes de acessar o banco', async () => {
    await expect(
      service.cadastrar({ ...dto, confirmacaoSenha: 'outra-senha' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.save).not.toHaveBeenCalled();
    expect(repository.existsBy).not.toHaveBeenCalled();
  });

  it('rejeita e-mail duplicado normalizado', async () => {
    repository.existsBy.mockResolvedValue(true);
    await expect(service.cadastrar(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repository.existsBy).toHaveBeenCalledWith({ email: cliente.email });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('trata corrida de cadastros pela restrição única do PostgreSQL', async () => {
    repository.save.mockRejectedValue(
      Object.assign(new Error('unique'), { code: '23505' }),
    );
    await expect(service.cadastrar(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('não oculta falhas inesperadas do banco', async () => {
    repository.save.mockRejectedValue(new Error('database unavailable'));
    await expect(service.cadastrar(dto)).rejects.toThrow(
      'database unavailable',
    );
  });

  it('autentica senha correta sem expor o hash', async () => {
    repository.findOne.mockResolvedValue({
      ...cliente,
      senhaHash: await argon2.hash(dto.senha),
    });
    const resultado = await service.entrar(dto);
    expect(resultado.cliente).toEqual(cliente);
    expect(repository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: cliente.email } }),
    );
  });

  it('rejeita senha incorreta e e-mail inexistente com a mesma mensagem', async () => {
    repository.findOne.mockResolvedValue({
      ...cliente,
      senhaHash: await argon2.hash(dto.senha),
    });
    await expect(
      service.entrar({ ...dto, senha: 'senha-errada' }),
    ).rejects.toThrow('E-mail ou senha inválidos.');
    repository.findOne.mockResolvedValue(null);
    await expect(service.entrar(dto)).rejects.toThrow(
      'E-mail ou senha inválidos.',
    );
  });

  it.each([undefined, 'invalid-token'])(
    'rejeita sessão ausente ou inválida: %s',
    async (token) => {
      await expect(service.autenticar(token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(repository.findOneBy).not.toHaveBeenCalled();
    },
  );

  it('rejeita token expirado e token sem subject', async () => {
    await expect(
      service.autenticar(jwt.sign({ sub: cliente.id }, { expiresIn: -1 })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.autenticar(jwt.sign({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('consulta o cliente atual e rejeita um cliente removido', async () => {
    const token = jwt.sign({ sub: cliente.id });
    repository.findOneBy.mockResolvedValue(cliente);
    expect(await service.autenticar(token)).toEqual(cliente);
    repository.findOneBy.mockResolvedValue(null);
    await expect(service.autenticar(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
