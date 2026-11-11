import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createApiProxy } from '../server/api-proxy.mjs'

async function fixture(run, respond = () => Response.json({ ok: true })) {
  const calls = []
  const env = { NODE_ENV: 'test', API_UPSTREAM_URL: 'https://backend.example.test', API_PROXY_SECRET: 'private-proxy-secret-with-at-least-32-characters' }
  const server = createServer(createApiProxy(env, async (...args) => { calls.push(args); return respond(...args) }))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  env.STOREFRONT_ORIGIN = origin
  try { await run({ origin, calls, env }) } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)) }
}

test('proxy same-origin mantém cookie seguro e não encaminha credenciais arbitrárias', async () => {
  await fixture(async ({ origin, calls, env }) => {
    const response = await fetch(`${origin}/api/auth/login`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: 'tracking=ignored; alva_session=session', Authorization: 'Bearer ignored', 'X-Alva-Proxy-Secret': 'forged', 'X-Forwarded-For': '198.51.100.8', 'X-Alva-Client-Ip': 'forged' }, body: JSON.stringify({ email: 'cliente@example.test', senha: 'test-password' }) })
    assert.equal(response.status, 200)
    assert.match(response.headers.getSetCookie()[0], /Path=\/api\/auth/)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    const [url, options] = calls[0]
    assert.equal(url, 'https://backend.example.test/auth/login')
    assert.equal(options.headers.get('Cookie'), 'alva_session=session')
    assert.equal(options.headers.get('Authorization'), null)
    assert.equal(options.headers.get('X-Alva-Proxy-Secret'), env.API_PROXY_SECRET)
    assert.equal(options.headers.get('X-Alva-Client-Ip'), '198.51.100.8')
    assert.equal(calls.length, 1)
  }, () => Response.json({ ok: true }, { headers: { 'Set-Cookie': 'alva_session=session; Path=/api/auth; HttpOnly; Secure; SameSite=Strict' } }))
})

test('proxy rejeita CSRF mesmo com cookie e requisições sem origem ou JSON', async () => {
  await fixture(async ({ origin, calls }) => {
    for (const headers of [
      { Origin: 'https://attacker.example', 'Content-Type': 'application/json' },
      { Origin: origin, 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'cross-site' },
      { 'Content-Type': 'application/json' },
      { Origin: origin, 'Content-Type': 'text/plain' },
    ]) assert.equal((await fetch(`${origin}/api/auth/logout`, { method: 'POST', headers: { Cookie: 'alva_session=session', ...headers }, body: '{}' })).status, 403)
    assert.equal(calls.length, 0)
  })
})

test('proxy bloqueia rotas administrativas, query strings e roteamento arbitrário', async () => {
  await fixture(async ({ origin, calls }) => {
    for (const path of ['/api/internal/checkout/open', '/api/produtos?url=https://attacker.example', '/api/auth%2fme', '/api/unknown']) assert.equal((await fetch(origin + path)).status, 404)
    assert.equal(calls.length, 0)
  })
})

test('proxy não segue redirects nem tenta novamente após falha de rede', async () => {
  await fixture(async ({ origin, calls }) => {
    assert.equal((await fetch(`${origin}/api/auth/me`)).status, 502)
    assert.equal(calls.length, 1)
  }, () => new Response(null, { status: 302, headers: { Location: 'https://attacker.example' } }))
  await fixture(async ({ origin, calls, env }) => {
    const response = await fetch(`${origin}/api/auth/me`)
    assert.equal(response.status, 502)
    assert.ok(!(await response.text()).includes(env.API_PROXY_SECRET))
    assert.equal(calls.length, 1)
  }, () => { throw new Error('upstream failure') })
})

test('proxy rejeita cookie com Path incorreto ou atributos enfraquecidos', async () => {
  for (const cookie of ['alva_session=session; Path=/auth; HttpOnly; Secure; SameSite=Strict', 'alva_session=session; Path=/api/auth; HttpOnly; SameSite=None', 'alva_session=session; Path=/api/auth; HttpOnly; Secure; SameSite=Strict; Domain=example.test']) {
    await fixture(async ({ origin }) => {
      const response = await fetch(`${origin}/api/auth/me`)
      assert.equal(response.status, 502)
      assert.equal(response.headers.get('set-cookie'), null)
    }, () => Response.json({}, { headers: { 'Set-Cookie': cookie } }))
  }
})

test('proxy preserva remoção do cookie e limita o corpo das requisições', async () => {
  await fixture(async ({ origin, calls }) => {
    const response = await fetch(`${origin}/api/auth/logout`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' })
    assert.equal(response.status, 204)
    assert.match(response.headers.get('set-cookie'), /Expires=/)
    assert.equal((await fetch(`${origin}/api/auth/login`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: 'x'.repeat(20000) })).status, 413)
    assert.equal(calls.length, 1)
  }, () => new Response(null, { status: 204, headers: { 'Set-Cookie': 'alva_session=; Path=/api/auth; HttpOnly; Secure; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT' } }))
})
