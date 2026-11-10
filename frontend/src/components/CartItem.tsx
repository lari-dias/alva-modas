import { Minus, Plus, Trash2 } from 'lucide-react'
import { LIMITES_CARRINHO } from '../types/carrinho'
import type { ItemCarrinho } from '../types/carrinho'
import { formatarCentavos } from '../services/formatar-preco'

interface CartItemProps {
  item: ItemCarrinho
  ocupado: boolean
  desatualizado: boolean
  unidades: number
  onAjustar: (produtoId: string, delta: 1 | -1) => void
  onRemover: (produtoId: string) => void
}

export function CartItem({ item, ocupado, desatualizado, unidades, onAjustar, onRemover }: CartItemProps) {
  const { produto, quantidade } = item
  const limite = Math.min(produto.estoque, LIMITES_CARRINHO.unidadesPorItem)

  return (
    <li className="cart-item">
      <img className="cart-item-image" src={produto.imagemUrl} alt={produto.nome} width={76} height={96} />
      <div className="cart-item-information">
        <h3>{produto.nome}</h3>
        {item.disponivel === false && <p className="cart-unit-price">Item indisponível nesta quantidade. Reduza ou remova.</p>}
        <p className="cart-unit-price">{formatarCentavos(item.precoUnitarioCentavos)} <span>por unidade</span></p>
        <div className="cart-item-bottom">
          <div className="cart-quantity" role="group" aria-label={`Quantidade de ${produto.nome}`}>
            <button type="button" disabled={ocupado} onClick={() => onAjustar(produto.id, -1)} aria-label={`Diminuir quantidade de ${produto.nome}`}><Minus size={14} aria-hidden="true" /></button>
            <span aria-label={`${quantidade} unidades de ${produto.nome}`}>{quantidade}</span>
            <button type="button" disabled={ocupado || desatualizado || item.disponivel === false || quantidade >= limite || unidades >= LIMITES_CARRINHO.unidades} onClick={() => onAjustar(produto.id, 1)} aria-label={`Aumentar quantidade de ${produto.nome}`}><Plus size={14} aria-hidden="true" /></button>
          </div>
          <p className="cart-item-subtotal"><span className="sr-only">Subtotal de {produto.nome}: </span>{formatarCentavos(item.subtotalCentavos)}</p>
        </div>
      </div>
      <button type="button" className="cart-remove" disabled={ocupado} onClick={() => onRemover(produto.id)} aria-label={`Remover ${produto.nome} do carrinho`}><Trash2 size={17} strokeWidth={1.5} aria-hidden="true" /></button>
    </li>
  )
}
