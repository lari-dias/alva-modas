interface CatalogFiltersProps {
  categorias: string[]
  categoria: string
  busca: string
  onCategoria: (categoria: string) => void
  onLimpar: () => void
}

export function CatalogFilters({ categorias, categoria, busca, onCategoria, onLimpar }: CatalogFiltersProps) {
  return (
    <div className="catalog-filters">
      <div className="catalog-categories" role="group" aria-label="Filtrar por categoria">
        <button type="button" aria-pressed={!categoria} onClick={() => onCategoria('')}>Todas as peças</button>
        {categorias.map((valor) => <button key={valor} type="button" aria-pressed={categoria === valor} onClick={() => onCategoria(valor)}>{valor}</button>)}
      </div>
      {(busca.trim() || categoria) && <div className="catalog-filter-summary"><p role="status">{busca.trim() ? `Busca por “${busca.trim()}”` : 'Todas as peças'}{categoria ? ` · ${categoria}` : ''}</p><button type="button" onClick={onLimpar}>Limpar filtros</button></div>}
    </div>
  )
}
