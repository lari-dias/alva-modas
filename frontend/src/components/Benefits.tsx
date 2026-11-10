import { CreditCard, Gift, ShieldCheck, Truck } from 'lucide-react'

const beneficios = [
  { icon: CreditCard, titulo: 'Sem cobrança real', mobile: 'Sem cobrança', descricao: 'Ambiente demonstrativo', descricaoMobile: 'Demonstração' },
  { icon: Truck, titulo: 'Sem entrega física', mobile: 'Sem entrega', descricao: 'Produtos fictícios', descricaoMobile: 'Produtos fictícios' },
  { icon: ShieldCheck, titulo: 'Revise sua sacola', mobile: 'Sua sacola', descricao: 'Itens não reservam estoque', descricaoMobile: 'Sem reserva' },
  { icon: Gift, titulo: 'Confirmação do pedido', mobile: 'Confirmação', descricao: 'Consulte o resultado na tela', descricaoMobile: 'Na tela' },
]

export function Benefits() {
  return (
    <section className="benefits" aria-label="Diferenciais da Alva Modas">
      <ul className="benefits-inner content-width">
        {beneficios.map(({ icon: Icon, titulo, mobile, descricao, descricaoMobile }) => (
          <li className="benefit" key={titulo}>
            <Icon className="benefit-icon" strokeWidth={1.4} aria-hidden="true" />
            <div className="benefit-desktop"><strong>{titulo}</strong><span>{descricao}</span></div>
            <div className="benefit-mobile"><strong>{mobile}</strong>{descricaoMobile && <span>{descricaoMobile}</span>}</div>
          </li>
        ))}
      </ul>
    </section>
  )
}
