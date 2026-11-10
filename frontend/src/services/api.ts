export const API_URL =
  import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '') ||
  'http://localhost:3000'
