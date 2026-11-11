import { Body, Controller, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CarrinhoId } from '../carrinho/carrinho-id.decorator';
import { FinalizarCompraDto } from './dto/finalizar-compra.dto';
import { CompraRespostaDto } from './dto/compra-resposta.dto';
import { CheckoutDeploymentService } from './checkout-deployment.service';

@ApiTags('Finalização da compra')
@Controller('finalizar-compra')
export class FinalizarCompraController {
  constructor(private readonly deployment: CheckoutDeploymentService) {}

  @Post()
  @ApiOperation({
    summary: 'Confirmar compra e registrar pedido',
    description:
      'Retorna 503 durante a transição e 410 somente após retirada explícita com checkout pausado e drenado. Nunca confirma pedidos pelo fluxo antigo.',
  })
  @ApiHeader({
    name: 'X-Cart-Id',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiCreatedResponse({ type: CompraRespostaDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos ou carrinho vazio.' })
  @ApiNotFoundResponse({
    description:
      'Carrinho inexistente, expirado ou finalizado; produto inexistente.',
  })
  @ApiConflictResponse({
    description: 'Carrinho ocupado, produto inativo ou estoque insuficiente.',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Valor excede a precisão numeric(10,2).',
  })
  @ApiServiceUnavailableResponse({
    description: 'Falha ao confirmar a transação.',
  })
  finalizar(
    @Body() dto: FinalizarCompraDto,
    @CarrinhoId(new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<CompraRespostaDto> {
    void id;
    void dto;
    return this.deployment.legado();
  }
}
