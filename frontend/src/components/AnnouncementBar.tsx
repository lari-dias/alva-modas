import { ShoppingBag } from 'lucide-react'

export function AnnouncementBar() {
  return (
    <div className="announcement-bar">
      <ShoppingBag size={18} strokeWidth={1.5} aria-hidden="true" />
      <p>Alva Modas — e-commerce demonstrativo, sem pagamento real</p>
    </div>
  )
}
