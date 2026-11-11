export const API_URL =
  import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '') ||
  (import.meta.env.PROD ? '/api' : 'http://localhost:3000')
