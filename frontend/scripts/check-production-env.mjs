import { loadEnv } from 'vite'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

export function validateApiUrl(value) {
  if (value !== '/api') throw new Error('Configure VITE_API_URL=/api para utilizar o proxy same-origin da Vercel.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  validateApiUrl(loadEnv('production', process.cwd(), 'VITE_').VITE_API_URL)
}
