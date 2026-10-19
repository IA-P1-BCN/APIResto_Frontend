import { createContext } from 'react'
import type { User } from '../api/types'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

export interface AuthContextValue {
  user: User | null
  status: AuthStatus
  /** Devuelve el `mfa_token` si la cuenta pide el código de verificación en dos pasos. */
  login: (email: string, password: string) => Promise<string | null>
  loginWithToken: (token: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
