import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import type { Role } from '../api/types'
import { useAuth } from '../context/useAuth'
import ForbiddenPage from '../pages/ForbiddenPage'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()

  if (status === 'loading') return <p className="page-message">Cargando sesión…</p>
  if (status === 'anonymous') return <Navigate to="/login" replace />
  return <>{children}</>
}

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth()
  if (!user || !roles.includes(user.role)) return <ForbiddenPage />
  return <>{children}</>
}
