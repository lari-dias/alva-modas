import { isIP } from 'node:net'

const routes = [
  ['GET', /^\/produtos$/], ['GET', /^\/checkout\/status$/],
  ['GET', /^\/carrinho$/], ['POST', /^\/carrinho$/], ['PUT', /^\/carrinho$/],
  ['GET', /^\/auth\/me$/], ['POST', /^\/auth\/(cadastro|login|logout)$/],
  ['POST', /^\/auth\/checkout\/tentativas\/[a-f0-9-]{36}(\/(confirmar|verificar))?$/],
  ['POST', /^\/finalizar-compra$/],
]

function configuration(env) {
  const upstream = new URL(env.API_UPSTREAM_URL)
  const storefront = new URL(env.STOREFRONT_ORIGIN)
  for (const url of [upstream, storefront]) {
    if ((url.protocol !== 'https:' && !(env.NODE_ENV === 'test' && url.protocol === 'http:' && url.hostname === '127.0.0.1')) || url.pathname !== '/' || url.username || url.password || url.search || url.hash) throw new Error('Invalid proxy configuration')
  }
  if (!env.API_PROXY_SECRET || env.API_PROXY_SECRET.length < 32) throw new Error('Invalid proxy credential')
  return { upstream, storefront, secret: env.API_PROXY_SECRET }
}

async function readBody(req) {
  if (req.body !== undefined) {
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    if (Buffer.byteLength(body) > 16384) throw new Error('Body too large')
    return body
  }
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk)
    if (size > 16384) throw new Error('Body too large')
    chunks.push(Buffer.from(chunk))
  }
  return size ? Buffer.concat(chunks).toString('utf8') : undefined
}

export function createApiProxy(env = process.env, fetchUpstream = fetch) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    const fail = (status, message) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ message })) }
    let config
    try { config = configuration(env) } catch { return fail(503, 'Serviço temporariamente indisponível.') }
    const url = new URL(req.url, config.storefront)
    const path = url.pathname.slice(4)
    if (!url.pathname.startsWith('/api/') || url.search || /%|\\|\.\./.test(req.url) || !routes.some(([method, pattern]) => method === req.method && pattern.test(path))) return fail(404, 'Rota não encontrada.')
    if (req.headers.host !== config.storefront.host || (req.headers.origin && req.headers.origin !== config.storefront.origin) || req.headers['sec-fetch-site'] === 'cross-site') return fail(403, 'Origem não permitida.')
    const writing = !['GET', 'HEAD'].includes(req.method)
    if (writing && (req.headers.origin !== config.storefront.origin || req.headers['content-type']?.split(';')[0].trim() !== 'application/json')) return fail(403, 'Requisição não permitida.')
    const headers = new Headers({ Accept: 'application/json', Origin: config.storefront.origin, 'X-Alva-Proxy-Secret': config.secret })
    const clientIp = req.headers['x-forwarded-for']
    if (typeof clientIp === 'string' && isIP(clientIp.trim())) headers.set('X-Alva-Client-Ip', clientIp.trim())
    for (const name of ['content-type', 'x-cart-id', 'x-checkout-token', 'x-checkout-authenticated']) {
      const value = req.headers[name]
      if (typeof value === 'string') headers.set(name, value)
    }
    const session = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('alva_session='))
    if (session) headers.set('Cookie', session)
    let body
    try { body = writing ? await readBody(req) : undefined } catch { return fail(413, 'Requisição muito grande.') }
    let response
    try {
      response = await fetchUpstream(`${config.upstream.origin}${path}`, { method: req.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(50000) })
      if (response.status >= 300 && response.status < 400) return fail(502, 'Resposta inesperada do serviço.')
      const cookies = response.headers.getSetCookie()
      if (cookies.some((cookie) => !/^alva_session=/.test(cookie) || !/;\s*Path=\/api\/auth(?:;|$)/i.test(cookie) || !/;\s*HttpOnly(?:;|$)/i.test(cookie) || !/;\s*Secure(?:;|$)/i.test(cookie) || !/;\s*SameSite=Strict(?:;|$)/i.test(cookie) || /;\s*Domain=/i.test(cookie))) return fail(502, 'Configuração de sessão incompatível.')
      const payload = await response.text()
      if (cookies.length) res.setHeader('Set-Cookie', cookies)
      res.statusCode = response.status
      res.setHeader('Content-Type', response.headers.get('content-type') ?? 'application/json')
      const retry = response.headers.get('retry-after')
      if (retry) res.setHeader('Retry-After', retry)
      res.end(payload)
    } catch { return fail(502, 'Não foi possível verificar o resultado. Preserve a tentativa e verifique a confirmação.') }
  }
}
