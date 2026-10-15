import type { User } from './types'

export const MOCK_PASSWORD = 'demo1234'

export const MOCK_USERS: User[] = [
  { id: 1, name: 'Admin Demo', email: 'admin@restoapi.dev', role: 'admin', is_active: true },
  { id: 2, name: 'Camarero Demo', email: 'camarero@restoapi.dev', role: 'waiter', is_active: true },
  { id: 3, name: 'Cocina Demo', email: 'cocina@restoapi.dev', role: 'kitchen', is_active: true },
  { id: 5, name: 'Barra Demo', email: 'barra@restoapi.dev', role: 'bartender', is_active: true },
  { id: 4, name: 'Cliente Demo', email: 'cliente@restoapi.dev', role: 'customer', is_active: true },
]

const TOKEN_PREFIX = 'mock-token-'

const SOCIAL_USER_ID = 4

export const MOCK_SOCIAL_USER = MOCK_USERS.find((u) => u.id === SOCIAL_USER_ID)!

const SOCIAL_ERRORS: Record<string, string> = {
  'mock-unverified': 'email_not_verified',
  'mock-expired': 'invalid_code',
}

export class MockApiError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.code = code
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function mockUserFromToken(token: string | null): User | undefined {
  const id = Number(token?.replace(TOKEN_PREFIX, ''))
  return MOCK_USERS.find((u) => u.id === id)
}

export const mockAuth = {
  async login(email: string, password: string): Promise<string> {
    await delay(400)
    const user = MOCK_USERS.find((u) => u.email === email.trim().toLowerCase())
    if (!user || password !== MOCK_PASSWORD) throw new Error('Email o contraseña incorrectos')
    return `${TOKEN_PREFIX}${user.id}`
  },
  async socialLogin(provider: string, code: string): Promise<string> {
    await delay(400)
    if (SOCIAL_ERRORS[code]) throw new MockApiError(`Login con ${provider} rechazado`, SOCIAL_ERRORS[code])
    return `${TOKEN_PREFIX}${SOCIAL_USER_ID}`
  },
  async me(token: string | null): Promise<User> {
    await delay(200)
    const user = mockUserFromToken(token)
    if (!user) throw new Error('Sesión no válida')
    return user
  },
}
