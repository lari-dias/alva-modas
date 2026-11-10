import { createContext } from 'react'
import type { useAuthController } from '../hooks/useAuthController'

export const AuthContext = createContext<ReturnType<typeof useAuthController> | null>(null)
