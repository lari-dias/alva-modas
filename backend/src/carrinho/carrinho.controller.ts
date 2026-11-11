import {
  Body,
  Controller,
  Get,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CarrinhoService } from './carrinho.service';
import { CarrinhoId } from './carrinho-id.decorator';
import { AdicionarItemDto } from './dto/adicionar-item.dto';
import { AtualizarItemDto } from './dto/atualizar-item.dto';
import { CarrinhoRespostaDto } from './dto/carrinho-resposta.dto';
import { CarrinhoCheckoutService } from './carrinho-checkout.service';

@ApiTags('Carrinho')
@ApiBadRequestResponse({
  description:
    'Body, UUID ou quantidade inválidos; limite de itens ou unidades excedido.',
})
@ApiNotFoundResponse({
  description:
    'code CART_NOT_FOUND: carrinho expirado/inexistente; PRODUCT_NOT_FOUND: produto inexistente; CART_ITEM_NOT_FOUND: produto ausente do carrinho. Apenas CART_NOT_FOUND invalida o identificador.',
})
@ApiConflictResponse({
  description:
    'Produto inativo, estoque insuficiente ou carrinho em atualização concorrente.',
})
@Controller('carrinho')
export class CarrinhoController {
  constructor(
    private readonly carrinhoService: CarrinhoService,
    private readonly checkout: CarrinhoCheckoutService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Adicionar produto',
    description:
      'Sem X-Cart-Id, cria um carrinho com UUID gerado pelo servidor. Com o header, incrementa a quantidade existente. Limites: 20 produtos distintos e 100 unidades no total e por produto. Expira após 30 minutos sem operação bem-sucedida. Não reserva estoque. Retorna valores monetários em centavos.',
  })
  @ApiHeader({
    name: 'X-Cart-Id',
    required: false,
    schema: { type: 'string', format: 'uuid' },
    description:
      'Omitir na primeira adição. Depois, enviar o idCarrinho retornado no JSON.',
  })
  @ApiCreatedResponse({ type: CarrinhoRespostaDto })
  @ApiServiceUnavailableResponse({
    description: 'Capacidade máxima de 1000 carrinhos atingida.',
  })
  adicionar(
    @Body() dto: AdicionarItemDto,
    @CarrinhoId(new ParseUUIDPipe({ version: '4', optional: true }))
    id?: string,
  ) {
    return this.checkout.executar(id, () =>
      this.carrinhoService.adicionar(dto, id),
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Consultar carrinho',
    description:
      'Reconsulta preços, status e estoque atuais. Não reserva estoque. Itens indisponíveis retornam disponivel=false e podem ser reduzidos ou removidos com PUT.',
  })
  @ApiHeader({
    name: 'X-Cart-Id',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiOkResponse({ type: CarrinhoRespostaDto })
  consultar(@CarrinhoId(new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.carrinhoService.consultar(id);
  }

  @Put()
  @ApiOperation({
    summary: 'Atualizar quantidade ou remover produto',
    description:
      'Define a quantidade absoluta; zero remove. Reduções e remoções são permitidas mesmo com outros itens indisponíveis. Esses itens retornam disponivel=false; produtos excluídos exibem os últimos dados conhecidos, sem autorizar a compra. Aumentos revalidam todos os itens. Carrinho vazio permanece disponível até expirar.',
  })
  @ApiHeader({
    name: 'X-Cart-Id',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiOkResponse({ type: CarrinhoRespostaDto })
  atualizar(
    @Body() dto: AtualizarItemDto,
    @CarrinhoId(new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.checkout.executar(id, () =>
      this.carrinhoService.atualizar(dto, id),
    );
  }
}
