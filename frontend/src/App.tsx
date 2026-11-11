import { HomePage } from './pages/HomePage'
import { CheckoutPage } from './pages/CheckoutPage'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { CartDrawer } from './components/CartDrawer'
import { AccountPage } from './pages/AccountPage'
import { AuthProvider } from './providers/AuthProvider'
import { CartDiagnostics } from './components/CartDiagnostics'

function AppRoutes() {
  const { pathname, hash, key } = useLocation()
  useEffect(() => {
    if (['/checkout', '/conta', '/cadastro'].includes(pathname)) document.querySelector<HTMLHeadingElement>('main h1')?.focus({ preventScroll: true })
    if (!hash) {
      document.documentElement.scrollTop = 0
      return
    }
    const destino = document.getElementById(hash.slice(1))
    destino?.scrollIntoView?.()
    if (destino?.getAttribute('aria-busy') === 'true') {
      const observer = new MutationObserver(() => {
        if (destino.getAttribute('aria-busy') !== 'true') {
          destino.scrollIntoView?.()
          observer.disconnect()
        }
      })
      observer.observe(destino, { attributes: true, attributeFilter: ['aria-busy'] })
      return () => observer.disconnect()
    }
  }, [pathname, hash, key])
  return <><Routes><Route path="/" element={<HomePage />} /><Route path="/checkout" element={<CheckoutPage />} /><Route path="/conta" element={<AccountPage />} /><Route path="/cadastro" element={<AccountPage cadastro />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes><CartDrawer /></>
}

function App() { return <AuthProvider><AppRoutes /><CartDiagnostics /></AuthProvider> }

export default App
