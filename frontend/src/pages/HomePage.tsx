import { AnnouncementBar } from '../components/AnnouncementBar'
import { Header } from '../components/Header'
import { Hero } from '../components/Hero'
import { Benefits } from '../components/Benefits'
import { ProductSection } from '../components/ProductSection'
import { Footer } from '../components/Footer'
import { useCatalogo } from '../hooks/useCatalogo'
import { CatalogFilters } from '../components/CatalogFilters'

export function HomePage() {
  const catalogo = useCatalogo()
  const produtos = catalogo.consulta

  return (
    <div id="inicio" className="storefront">
      <a className="skip-link" href="#produtos">Pular para os produtos</a>
      <AnnouncementBar />
      <Header />
      <main>
        <Hero />
        <Benefits />
        <ProductSection
          produtos={catalogo.produtos}
          filtrado={catalogo.filtrado}
          filtros={<CatalogFilters categorias={catalogo.categorias} categoria={catalogo.categoria} busca={catalogo.busca} onCategoria={catalogo.filtrarCategoria} onLimpar={catalogo.limpar} />}
          carregando={produtos.isPending}
          erro={produtos.isError}
          tentandoNovamente={produtos.isFetching}
          onTentarNovamente={() => { void produtos.refetch() }}
        />
      </main>
      <Footer />
    </div>
  )
}
