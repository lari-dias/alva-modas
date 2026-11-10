import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { cadastroSchema, loginSchema } from '../types/auth-schema'
import type { Cadastro, Credenciais } from '../types/auth'

type Props = { ocupado: boolean } & ({ cadastro: true, onEnviar: (dados: Cadastro) => Promise<void> } | { cadastro: false, onEnviar: (dados: Credenciais) => Promise<void> })

export function AuthForm(props: Props) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Cadastro>({
    resolver: zodResolver(cadastroSchema), mode: 'onBlur',
    defaultValues: { nome: '', email: '', senha: '', confirmacaoSenha: '' },
  })
  const login = useForm<Credenciais>({ resolver: zodResolver(loginSchema), mode: 'onBlur', defaultValues: { email: '', senha: '' } })
  const ocupado = props.ocupado || isSubmitting || login.formState.isSubmitting
  const campos = props.cadastro ? [
    { nome: 'nome' as const, label: 'Nome completo', tipo: 'text', auto: 'name', max: 120 },
    { nome: 'email' as const, label: 'E-mail', tipo: 'email', auto: 'email', max: 254 },
    { nome: 'senha' as const, label: 'Senha', tipo: 'password', auto: 'new-password', max: 128 },
    { nome: 'confirmacaoSenha' as const, label: 'Confirmar senha', tipo: 'password', auto: 'new-password', max: 128 },
  ] : [
    { nome: 'email' as const, label: 'E-mail', tipo: 'email', auto: 'email', max: 254 },
    { nome: 'senha' as const, label: 'Senha', tipo: 'password', auto: 'current-password', max: 128 },
  ]
  return <form noValidate aria-label={props.cadastro ? 'Cadastro de cliente' : 'Login de cliente'} aria-busy={ocupado} onSubmit={props.cadastro ? handleSubmit(props.onEnviar) : login.handleSubmit(props.onEnviar)}>
    <fieldset disabled={ocupado}>
      <legend className="sr-only">Dados de acesso</legend>
      {campos.map((campo) => {
        const erro = props.cadastro ? errors[campo.nome] : login.formState.errors[campo.nome as keyof Credenciais]
        return <div className="auth-field" key={campo.nome}>
          <label htmlFor={`auth-${campo.nome}`}>{campo.label}</label>
          <input id={`auth-${campo.nome}`} type={campo.tipo} autoComplete={campo.auto} maxLength={campo.max} required aria-invalid={Boolean(erro)} aria-describedby={erro ? `auth-${campo.nome}-error` : campo.nome === 'senha' && props.cadastro ? 'auth-password-hint' : undefined} {...(props.cadastro ? register(campo.nome) : login.register(campo.nome as keyof Credenciais))} />
          {erro && <p id={`auth-${campo.nome}-error`} role="alert">{erro.message}</p>}
        </div>
      })}
    </fieldset>
    {props.cadastro && <p id="auth-password-hint" className="auth-muted">Use de 8 a 128 caracteres na senha.</p>}
    <button type="submit" className="primary-button auth-submit" disabled={ocupado}>{ocupado ? 'Aguarde...' : props.cadastro ? 'Criar conta' : 'Entrar'}</button>
  </form>
}
