import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254, 'E-mail muito longo.').pipe(z.email('Informe um e-mail válido.')),
  senha: z.string().min(8, 'Use pelo menos 8 caracteres.').max(128, 'Use até 128 caracteres.'),
})

export const cadastroSchema = loginSchema.extend({
  nome: z.string().trim().min(2, 'Informe seu nome.').max(120, 'Use até 120 caracteres.'),
  confirmacaoSenha: z.string().min(8, 'Confirme sua senha.').max(128, 'Use até 128 caracteres.'),
}).refine((dados) => dados.senha === dados.confirmacaoSenha, { path: ['confirmacaoSenha'], message: 'As senhas não coincidem.' })
