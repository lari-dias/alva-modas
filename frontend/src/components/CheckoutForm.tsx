import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { checkoutSchema } from '../types/checkout-schema'
import type { DadosCliente } from '../types/checkout'

interface CheckoutFormProps {
  bloqueado: boolean
  enviando: boolean
  onConfirmar: (dados: DadosCliente) => Promise<void>
}

export function CheckoutForm({ bloqueado, enviando, onConfirmar }: CheckoutFormProps) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<DadosCliente>({
    resolver: zodResolver(checkoutSchema), defaultValues: { nome: '', email: '' }, mode: 'onBlur',
  })
  const ocupado = bloqueado || enviando || isSubmitting

  return (
    <form className="checkout-form checkout-panel" onSubmit={handleSubmit(onConfirmar)} noValidate aria-labelledby="checkout-customer-title" aria-busy={enviando}>
      <h2 id="checkout-customer-title">Seus dados</h2>
      <p className="checkout-muted">Informe os dados para registrar o pedido e receber a confirmação.</p>
      <fieldset disabled={ocupado}>
        <legend className="sr-only">Dados do cliente</legend>
        <div className="checkout-field">
          <label htmlFor="checkout-nome">Nome completo</label>
          <input id="checkout-nome" type="text" autoComplete="name" required maxLength={120} {...register('nome')} aria-invalid={Boolean(errors.nome)} aria-describedby={errors.nome ? 'checkout-nome-error' : undefined} />
          {errors.nome && <p id="checkout-nome-error" className="checkout-field-error" role="alert">{errors.nome.message}</p>}
        </div>
        <div className="checkout-field">
          <label htmlFor="checkout-email">E-mail</label>
          <input id="checkout-email" type="email" autoComplete="email" inputMode="email" required maxLength={254} {...register('email')} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'checkout-email-error' : 'checkout-email-hint'} />
          {errors.email ? <p id="checkout-email-error" className="checkout-field-error" role="alert">{errors.email.message}</p> : <p id="checkout-email-hint" className="checkout-field-hint">Confira o endereço antes de confirmar.</p>}
        </div>
      </fieldset>
      <p className="checkout-payment-note">Nenhum pagamento será realizado. Esta etapa apenas registra o pedido.</p>
      <button className="primary-button checkout-submit" type="submit" disabled={ocupado}>
        {enviando && <LoaderCircle size={17} className="motion-safe:animate-spin" aria-hidden="true" />}
        {enviando ? 'Confirmando pedido...' : 'Confirmar pedido'}
      </button>
    </form>
  )
}
