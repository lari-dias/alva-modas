import { Link } from 'react-router-dom'

interface BrandProps {
  className?: string
  onNavigate?: () => void
}

export function Brand({ className = '', onNavigate }: BrandProps) {
  return (
    <Link to="/#inicio" className={`brand ${className}`} onClick={onNavigate} aria-label="Alva Modas — início">
      <span className="brand-name">ALVA</span>
      <span className="brand-caption"><span />MODAS<span /></span>
    </Link>
  )
}
