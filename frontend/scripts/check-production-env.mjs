import { loadEnv } from 'vite'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

export function validateApiUrl(value) {
  let url
  try { url = new URL(value) } catch { throw new Error('Configure VITE_API_URL com a origem HTTPS pública da API.') }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || ['localhost', '127.0.0.1', '[::1]', 'example.com', 'api.example.com'].includes(url.hostname)) {
    throw new Error('VITE_API_URL deve ser uma origem HTTPS pública, sem credenciais, caminhos ou parâmetros.')
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  validateApiUrl(loadEnv('production', process.cwd(), 'VITE_').VITE_API_URL)
}
