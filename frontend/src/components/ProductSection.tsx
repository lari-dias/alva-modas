import type { Produto } from '../types/produto'
import { ProductCard } from './ProductCard'
import { LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'

interface ProductSectionProps {
  produtos: Produto[]
  carregando: boolean
  erro: boolean
  tentandoNovamente: boolean
  onTentarNovamente: () => void
  filtros?: ReactNode
  filtrado?: boolean
}

export function ProductSection({ produtos, carregando, erro, tentandoNovamente, onTentarNovamente, filtros, filtrado = false }: ProductSectionProps) {
  return (
    <section id="produtos" className="product-section content-width" aria-labelledby="products-title" aria-busy={carregando || tentandoNovamente}>
      <div className="section-heading"><h2 id="products-title">Destaques da Alva</h2><span aria-hidden="true" /></div>
      {!carregando && !erro && filtros}
      {carregando ? (
        <div className="catalog-feedback" role="status">
          <LoaderCircle className="motion-safe:animate-spin" size={24} aria-hidden="true" />
          <p>Carregando produtos...</p>
        </div>
      ) : erro ? (
        <div className="catalog-feedback" role="alert">
          <p>Não foi possível carregar os produtos. Tente novamente.</p>
          <button type="button" className="primary-button catalog-retry" onClick={onTentarNovamente} disabled={tentandoNovamente}>
            {tentandoNovamente ? 'Tentando novamente...' : 'Tentar novamente'}
          </button>
        </div>
      ) : produtos.length === 0 ? (
        <div className="catalog-feedback" role="status"><p>{filtrado ? 'Nenhuma peça encontrada. Experimente outro termo ou ajuste os filtros.' : 'Nenhum produto disponível no momento.'}</p></div>
      ) : (
        <div className="product-grid">{produtos.map((produto) => <ProductCard key={produto.id} produto={produto} />)}</div>
      )}
    </section>
  )
}
