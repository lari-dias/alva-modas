import { useEffect, useLayoutEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useCarrinho } from '../hooks/useCarrinho'
import { lerRegistrosCarrinho, presencaArmazenamento, registrarCarrinho, sincronizarAtivacaoDiagnostico } from '../services/carrinho-diagnostico'
import './cart-diagnostics.css'

function capturarBotoes() {
  return [...document.querySelectorAll<HTMLButtonElement>('.add-to-cart')].map((botao, indice) => ({
    posicao: indice + 1,
    disabled: botao.disabled,
    bloqueadoHTML: botao.matches(':disabled'),
    ocupado: botao.getAttribute('aria-busy') === 'true',
    motivos: botao.dataset.diagnosticoMotivos ?? 'não disponível',
  }))
}

function Painel() {
  const cart = useCarrinho()
  const [leitura, setLeitura] = useState(() => ({ botoes: capturarBotoes(), armazenamento: presencaArmazenamento(), eventos: lerRegistrosCarrinho() }))
  const estado = JSON.stringify(cart.diagnostico, (chave, valor) => chave === 'motivos' ? undefined : valor)
  const consultaEstado = cart.diagnostico?.consulta.estado
  const consultaRede = cart.diagnostico?.consulta.rede
  const mutationEstado = cart.diagnostico?.mutation.estado
  const mutationPausada = cart.diagnostico?.mutation.pausada

  useEffect(() => { registrarCarrinho('estado atualizado') }, [estado])
  useEffect(() => { if (consultaEstado) registrarCarrinho(`consulta ${consultaEstado}`) }, [consultaEstado])
  useEffect(() => { if (consultaRede) registrarCarrinho(`rede ${consultaRede}`) }, [consultaRede])
  useEffect(() => { if (mutationEstado) registrarCarrinho(`mutation ${mutationEstado}`) }, [mutationEstado])
  useEffect(() => { if (mutationPausada) registrarCarrinho('mutation pausada') }, [mutationPausada])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const proxima = { botoes: capturarBotoes(), armazenamento: presencaArmazenamento(), eventos: lerRegistrosCarrinho() }
      setLeitura(anterior => JSON.stringify(anterior) === JSON.stringify(proxima) ? anterior : proxima)
    }, 700)
    const toque = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('.add-to-cart')) registrarCarrinho('toque no botão')
    }
    const erro = () => registrarCarrinho('erro de execução')
    const rejeicao = () => registrarCarrinho('promise rejeitada')
    document.addEventListener('pointerdown', toque, { capture: true, passive: true })
    window.addEventListener('error', erro)
    window.addEventListener('unhandledrejection', rejeicao)
    return () => {
      clearInterval(timer)
      document.removeEventListener('pointerdown', toque, true)
      window.removeEventListener('error', erro)
      window.removeEventListener('unhandledrejection', rejeicao)
    }
  }, [])

  return <aside className="cart-diagnostics" aria-label="Diagnóstico temporário do carrinho">
    <h2>Diagnóstico do carrinho</h2>
    <p>Somente observação. Histórico em memória, sem envio externo. Atualização a cada 700 ms.</p>
    <h3>Estado atual</h3><pre>{estado}</pre>
    <h3>Presença no armazenamento</h3><pre>{JSON.stringify(leitura.armazenamento, null, 2)}</pre>
    <h3>Botões por posição no catálogo</h3>
    <ul>{leitura.botoes.map(botao => <li key={botao.posicao}>Botão {botao.posicao}: disabled={String(botao.disabled)}; bloqueado HTML={String(botao.bloqueadoHTML)}; ocupado={String(botao.ocupado)}; motivos: {botao.motivos}</li>)}</ul>
    <h3>Eventos (últimos 60)</h3>
    <p>Sem registro de toque não prova ausência de interação. Eventos globais de erro podem vir de outras partes da página.</p>
    <ol>{leitura.eventos.map((evento, indice) => <li key={indice}>{evento.hora} — {evento.evento}{evento.status === undefined ? '' : ` (${evento.status})`}</li>)}</ol>
  </aside>
}

export function CartDiagnostics() {
  const { search } = useLocation()
  useLayoutEffect(() => { sincronizarAtivacaoDiagnostico() }, [search])
  return new URLSearchParams(search).get('diagnostico-carrinho') === '1' ? <Painel /> : null
}
