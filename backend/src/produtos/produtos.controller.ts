import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProdutosService } from './produtos.service';
import { ProdutoRespostaDto } from './dto/produto-resposta.dto';

@ApiTags('Produtos')
@Controller('produtos')
export class ProdutosController {
  constructor(private readonly produtosService: ProdutosService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar produtos ativos',
    description:
      'Retorna somente produtos ativos em ordem crescente de nome, incluindo os sem estoque. Preços são strings decimais em reais.',
  })
  @ApiOkResponse({
    type: ProdutoRespostaDto,
    isArray: true,
    description: 'Lista do catálogo; vazia quando não há produtos ativos.',
  })
  listar(): Promise<ProdutoRespostaDto[]> {
    return this.produtosService.listar();
  }
}
