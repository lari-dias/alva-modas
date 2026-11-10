import { ConfirmacaoPedido } from './confirmacao-pedido';

function escapar(value: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return value.replace(/[&<>"']/g, (character) => entities[character]);
}

function reais(centavos: number): string {
  const inteiro = Math.floor(centavos / 100).toLocaleString('pt-BR');
  return `R$ ${inteiro},${String(centavos % 100).padStart(2, '0')}`;
}

export function confirmacaoHtml(pedido: ConfirmacaoPedido): string {
  const linhas = pedido.itens
    .map(
      (item) =>
        `<tr><td>${escapar(item.nomeProduto)}</td><td>${item.quantidade}</td><td>${reais(item.precoUnitarioCentavos)}</td><td>${reais(item.subtotalCentavos)}</td></tr>`,
    )
    .join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Alva Modas</title></head><body><h1>Alva Modas</h1><p>Olá, ${escapar(pedido.nomeCliente)}!</p><p>Seu pedido ${escapar(pedido.idPedido)} foi confirmado.</p><table><thead><tr><th>Produto</th><th>Quantidade</th><th>Preço unitário</th><th>Subtotal</th></tr></thead><tbody>${linhas}</tbody></table><p><strong>Total: ${reais(pedido.totalCentavos)}</strong></p><p>Este pedido foi registrado em um e-commerce fictício. Nenhuma cobrança foi realizada.</p></body></html>`;
}

export function confirmacaoTexto(pedido: ConfirmacaoPedido): string {
  return `Alva Modas\nOlá, ${pedido.nomeCliente}!\nPedido ${pedido.idPedido} confirmado.\n${pedido.itens.map((item) => `${item.nomeProduto} - ${item.quantidade} x ${reais(item.precoUnitarioCentavos)} = ${reais(item.subtotalCentavos)}`).join('\n')}\nTotal: ${reais(pedido.totalCentavos)}\nE-commerce fictício. Nenhuma cobrança foi realizada.`;
}
