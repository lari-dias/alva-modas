import { Heart, ShoppingCart } from 'lucide-react'
import type { Produto } from '../types/produto'
import { formatarPreco } from '../services/formatar-preco'
import { useCarrinho } from '../hooks/useCarrinho'

interface ProductCardProps {
  produto: Produto
}

export function ProductCard({ produto }: ProductCardProps) {
  const carrinho = useCarrinho()
  const adicionando = carrinho.produtoPendente === produto.id
  const aproximarImagem = produto.imagemUrl.includes('/photos/7203494/')
  return (
    <article className="product-card" aria-labelledby={`produto-${produto.id}`}>
      <div className="product-image-wrapper">
        <img src={produto.imagemUrl} alt={produto.nome} className={`product-image${aproximarImagem ? ' product-image-close' : ''}`} loading="lazy" decoding="async" width={600} height={600} />
        <button type="button" className="favorite-button" disabled title="Favoritos disponíveis em breve" aria-label={`Salvar ${produto.nome} nos favoritos — disponível em breve`}><Heart size={20} strokeWidth={1.7} aria-hidden="true" /></button>
      </div>
      <div className="product-information">
        <h3 id={`produto-${produto.id}`}>{produto.nome}</h3>
        <p className="product-price">{formatarPreco(produto.preco)}</p>
        <div className="product-payment-slot" aria-hidden="true" />
      </div>
      <button type="button" className="primary-button add-to-cart" disabled={!carrinho.podeAdicionar(produto.id, produto.estoque)} onClick={() => carrinho.adicionar(produto.id)} aria-label={`Adicionar ${produto.nome} ao carrinho`} aria-busy={adicionando}>
        <ShoppingCart size={17} strokeWidth={1.5} aria-hidden="true" /><span>{produto.estoque === 0 ? 'Sem estoque' : adicionando ? 'Adicionando...' : 'Adicionar ao carrinho'}</span>
      </button>
    </article>
  )
}
