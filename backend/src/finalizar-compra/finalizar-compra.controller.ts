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
import { FinalizarCompraService } from './finalizar-compra.service';

@ApiTags('Finalização da compra')
@Controller('finalizar-compra')
export class FinalizarCompraController {
  constructor(private readonly finalizarCompra: FinalizarCompraService) {}

  @Post()
  @ApiOperation({
    summary: 'Confirmar compra e registrar pedido',
    description:
      'Registra pedido e itens e desconta estoque em uma transação, sem cobrança. Remove o carrinho após commit e tenta enviar e-mail. Requisições simultâneas no mesmo carrinho retornam 409; uma nova tentativa após o sucesso retorna 404. Totais em centavos. Carrinhos e proteção contra duplicação são locais ao processo.',
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
    return this.finalizarCompra.finalizar(id, dto);
  }
}
