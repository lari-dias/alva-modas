export interface Cliente {
  id: string
  nome: string
  email: string
}

export interface Credenciais {
  email: string
  senha: string
}

export interface Cadastro extends Credenciais {
  nome: string
  confirmacaoSenha: string
}
