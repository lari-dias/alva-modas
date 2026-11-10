import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './services/query-client'
import { CarrinhoProvider } from './providers/CarrinhoProvider'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter><CarrinhoProvider><App /></CarrinhoProvider></BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
