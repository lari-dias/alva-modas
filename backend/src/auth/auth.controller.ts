import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiConflictResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CadastroDto } from './dto/cadastro.dto';
import { LoginDto } from './dto/login.dto';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';
import { ClienteRespostaDto } from './dto/cliente-resposta.dto';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('cadastro')
  @UseGuards(AuthRateLimitGuard)
  @ApiOperation({ summary: 'Cadastrar cliente e iniciar sessão' })
  @ApiCreatedResponse({ type: ClienteRespostaDto })
  @ApiConflictResponse({ description: 'E-mail já cadastrado' })
  async cadastrar(
    @Body() dto: CadastroDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.validarOrigem(req);
    const sessao = await this.auth.cadastrar(dto);
    res.cookie('alva_session', sessao.token, this.cookie());
    res.setHeader('Cache-Control', 'no-store');
    return sessao.cliente;
  }

  @Post('login')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Entrar com e-mail e senha' })
  @ApiOkResponse({ type: ClienteRespostaDto })
  @ApiUnauthorizedResponse({ description: 'E-mail ou senha inválidos' })
  async entrar(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.validarOrigem(req);
    const sessao = await this.auth.entrar(dto);
    res.cookie('alva_session', sessao.token, this.cookie());
    res.setHeader('Cache-Control', 'no-store');
    return sessao.cliente;
  }

  @Get('me')
  @ApiCookieAuth('alva_session')
  @ApiOperation({ summary: 'Consultar cliente autenticado' })
  @ApiOkResponse({ type: ClienteRespostaDto })
  @ApiUnauthorizedResponse({ description: 'Sessão inválida ou expirada' })
  async consultar(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    const cookie = req.headers.cookie
      ?.split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith('alva_session='));
    return this.auth.autenticar(cookie?.slice('alva_session='.length));
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Encerrar sessão neste navegador' })
  @ApiNoContentResponse({ description: 'Cookie de sessão removido' })
  sair(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.validarOrigem(req);
    res.clearCookie('alva_session', { ...this.cookie(), maxAge: undefined });
  }

  private cookie(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get<string>('JWT_COOKIE_SECURE') === 'true',
      sameSite: 'strict',
      path: '/auth',
      maxAge: 3600000,
    };
  }

  private validarOrigem(req: Request) {
    const permitidas = this.config
      .getOrThrow<string>('FRONTEND_URL')
      .split(',')
      .map((item) => item.trim());
    if (
      req.headers.origin &&
      !permitidas.includes(req.headers.origin) &&
      req.headers['sec-fetch-site'] !== 'same-origin'
    )
      throw new ForbiddenException('Origem não permitida.');
  }
}
