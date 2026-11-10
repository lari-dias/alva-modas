import type { ReactNode } from 'react'
import { AuthContext } from '../contexts/auth-context'
import { useAuthController } from '../hooks/useAuthController'

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthController()
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}
