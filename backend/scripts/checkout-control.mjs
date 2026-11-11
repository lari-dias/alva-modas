const action = process.argv[2]
if (!['status', 'readiness', 'pause', 'open', 'retire-legacy'].includes(action)) throw new Error('Use status, readiness, pause, open ou retire-legacy.')
const origin = new URL(process.env.CHECKOUT_CONTROL_URL)
const local = process.env.NODE_ENV === 'development' && origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)
if ((!local && origin.protocol !== 'https:') || origin.pathname !== '/' || origin.username || origin.password || origin.search || origin.hash) throw new Error('Configure CHECKOUT_CONTROL_URL com a origem HTTPS do backend, ou HTTP loopback em development.')
const token = process.env.CHECKOUT_ADMIN_TOKEN
if (!token || token.length < 32) throw new Error('Configure CHECKOUT_ADMIN_TOKEN no ambiente seguro do operador.')
const response = await fetch(`${origin.origin}/internal/checkout/${action}`, {
  method: ['status', 'readiness'].includes(action) ? 'GET' : 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  signal: AbortSignal.timeout(90000),
})
if (!response.ok) throw new Error(`Operação não confirmada (HTTP ${response.status}). Consulte status; não presuma drenagem.`)
const status = await response.json()
console.log(JSON.stringify(action === 'readiness' ? { schemaEPermissoes: status.schemaEPermissoes, outboxHabilitada: status.outboxHabilitada, resendConfigurada: status.resendConfigurada } : { aberto: status.aberto, drenado: status.drenado, legado_retirado: status.legado_retirado }))
