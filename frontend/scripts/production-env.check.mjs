import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { validateApiUrl } from './check-production-env.mjs'

test('aceita somente o caminho do proxy same-origin em produção', () => {
  assert.doesNotThrow(() => validateApiUrl('/api'))
  assert.throws(() => validateApiUrl('https://api.loja-alva.test'))
})

test('rejeita origens locais, placeholders, HTTP, credenciais e parâmetros', () => {
  for (const value of [undefined, '', 'http://api.loja-alva.test', 'https://localhost', 'https://api.example.com', 'https://user:password@api.loja-alva.test', 'https://api.loja-alva.test/auth', 'https://api.loja-alva.test?token=secret', 'https://api.loja-alva.test#fragment']) {
    assert.throws(() => validateApiUrl(value))
  }
})

test('o comando de produção recusa a URL local antes do build', () => {
  const result = spawnSync(process.execPath, ['scripts/check-production-env.mjs'], { env: { ...process.env, VITE_API_URL: 'http://localhost:3000' }, encoding: 'utf8' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /VITE_API_URL=\/api/)
})

test('o comando de produção utiliza a variável pública fornecida pelo ambiente', () => {
  const result = spawnSync(process.execPath, ['scripts/check-production-env.mjs'], { env: { ...process.env, VITE_API_URL: '/api' }, encoding: 'utf8' })
  assert.equal(result.status, 0)
})
