import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'

interface ProductSearchProps {
  busca: string
  onBuscar: (termo: string) => void
  onFechar: () => void
}

export function ProductSearch({ busca, onBuscar, onFechar }: ProductSearchProps) {
  const [termo, setTermo] = useState(busca)
  const campo = useRef<HTMLInputElement>(null)
  useEffect(() => { campo.current?.focus() }, [])

  return (
    <div id="product-search" className="header-search content-width" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onFechar() } }}>
      <form role="search" aria-label="Busca no catálogo" onSubmit={(event) => { event.preventDefault(); onBuscar(termo) }}>
        <label className="sr-only" htmlFor="product-search-input">Pesquisar produtos</label>
        <Search size={19} aria-hidden="true" />
        <input ref={campo} id="product-search-input" type="search" value={termo} onChange={(event) => setTermo(event.target.value)} placeholder="Buscar peças" maxLength={120} />
        <button type="submit" className="primary-button">Buscar</button>
        <button type="button" className="icon-button" aria-label="Fechar busca" onClick={onFechar}><X size={20} aria-hidden="true" /></button>
      </form>
    </div>
  )
}
