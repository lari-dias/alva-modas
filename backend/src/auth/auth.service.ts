import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { Cliente } from './entities/cliente.entity';
import { CadastroDto } from './dto/cadastro.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private hashAusente?: Promise<string>;
  constructor(
    @InjectRepository(Cliente) private readonly clientes: Repository<Cliente>,
    private readonly jwt: JwtService,
  ) {}

  async cadastrar(dto: CadastroDto) {
    if (dto.senha !== dto.confirmacaoSenha)
      throw new BadRequestException('As senhas não coincidem.');
    const email = dto.email.trim().toLowerCase();
    if (await this.clientes.existsBy({ email }))
      throw new ConflictException('E-mail já cadastrado.');
    const senhaHash = await argon2.hash(dto.senha, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    try {
      const cliente = await this.clientes.save(
        this.clientes.create({ nome: dto.nome.trim(), email, senhaHash }),
      );
      return this.sessao(cliente);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === '23505')
        throw new ConflictException('E-mail já cadastrado.');
      throw error;
    }
  }

  async entrar(dto: LoginDto) {
    const cliente = await this.clientes.findOne({
      where: { email: dto.email.trim().toLowerCase() },
      select: { id: true, nome: true, email: true, senhaHash: true },
    });
    const hash =
      cliente?.senhaHash ??
      (await (this.hashAusente ??= argon2.hash(
        'alva-dummy-password-not-an-account',
        {
          type: argon2.argon2id,
          memoryCost: 19456,
          timeCost: 2,
          parallelism: 1,
        },
      )));
    const valida = await argon2.verify(hash, dto.senha);
    if (!cliente || !valida)
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    return this.sessao(cliente);
  }

  async autenticar(token: string | undefined) {
    if (!token) throw new UnauthorizedException('Entre na sua conta.');
    let id: string;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      id = payload.sub;
      if (typeof id !== 'string') throw new Error();
    } catch {
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }
    const cliente = await this.clientes.findOneBy({ id });
    if (!cliente)
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    return this.publico(cliente);
  }

  private publico(cliente: Cliente) {
    return { id: cliente.id, nome: cliente.nome, email: cliente.email };
  }

  private async sessao(cliente: Cliente) {
    return {
      cliente: this.publico(cliente),
      token: await this.jwt.signAsync({ sub: cliente.id }),
    };
  }
}
