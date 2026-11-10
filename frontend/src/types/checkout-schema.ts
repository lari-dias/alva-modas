import { z } from 'zod'

export const checkoutSchema = z.object({
  nome: z.string().trim().min(2, 'Informe seu nome com pelo menos 2 caracteres.').max(120, 'O nome deve ter no máximo 120 caracteres.'),
  email: z.string().trim().min(1, 'Informe seu e-mail.').email('Informe um e-mail válido.').max(254, 'O e-mail deve ter no máximo 254 caracteres.'),
})
