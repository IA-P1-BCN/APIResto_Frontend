import { db, saveDemoDb, type MockTwoFactor } from './mock/db'
import type { TwoFactorSetup, TwoFactorStatus, User } from './types'

export const MOCK_PASSWORD = 'demo1234'

export const MOCK_USERS: User[] = [
  { id: 1, name: 'Admin Demo', email: 'admin@restoapi.dev', role: 'admin', is_active: true },
  { id: 2, name: 'Camarero Demo', email: 'camarero@restoapi.dev', role: 'waiter', is_active: true },
  { id: 3, name: 'Cocina Demo', email: 'cocina@restoapi.dev', role: 'kitchen', is_active: true },
  { id: 5, name: 'Barra Demo', email: 'barra@restoapi.dev', role: 'bartender', is_active: true },
  { id: 4, name: 'Cliente Demo', email: 'cliente@restoapi.dev', role: 'customer', is_active: true },
]

const TOKEN_PREFIX = 'mock-token-'
const MFA_PREFIX = 'mock-mfa-'

export const MOCK_TOTP_CODE = '123456'
const MOCK_TOTP_SECRET = 'JBSWY3DPEHPK3PXP'
const RECOVERY_CODES = 8
const MOCK_QR_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29" width="174" height="174">' +
  '<rect width="29" height="29" fill="#fff"/>' +
  '<path d="M1 1h7v7H1zM21 1h7v7h-7zM1 21h7v7H1z" fill="none" stroke="#000" stroke-width="2"/>' +
  '<path d="M3 3h3v3H3zM23 3h3v3h-3zM3 23h3v3H3zM11 2h2v2h-2zM15 4h2v2h-2zM11 8h3v2h-3zM17 10h2v3h-2zM10 12h3v3h-3zM14 15h2v2h-2zM21 12h3v2h-3zM24 16h2v3h-2zM18 18h3v3h-3zM12 20h2v3h-2zM15 24h3v2h-3zM22 23h2v3h-2zM2 11h3v2H2zM5 15h2v3H5z"/>' +
  '</svg>'

type MockLoginResult = { token: string } | { mfaToken: string }

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

function twoFactorOf(userId: number): MockTwoFactor {
  db.twoFactor ??= {}
  return (db.twoFactor[userId] ??= { pending: false, enabled: false, recoveryCodes: [] })
}

function normalize(code: string): string {
  return code.replace(/[\s-]/g, '').toLowerCase()
}

function randomRecoveryCode(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 10)}-${hex.slice(10)}`
}

function acceptCode(state: MockTwoFactor, code: string): boolean {
  if (code.trim() === MOCK_TOTP_CODE) return true
  const index = state.recoveryCodes.findIndex((c) => normalize(c) === normalize(code))
  if (index === -1) return false
  state.recoveryCodes.splice(index, 1)
  saveDemoDb()
  return true
}

function signedIn(userId: number): MockLoginResult {
  return twoFactorOf(userId).enabled ? { mfaToken: `${MFA_PREFIX}${userId}` } : { token: `${TOKEN_PREFIX}${userId}` }
}

function currentUser(token: string | null): User {
  const user = mockUserFromToken(token)
  if (!user) throw new MockApiError('Sesión no válida', 'unauthorized')
  return user
}

export function mockUserFromToken(token: string | null): User | undefined {
  const id = Number(token?.replace(TOKEN_PREFIX, ''))
  return MOCK_USERS.find((u) => u.id === id)
}

export const mockAuth = {
  async login(email: string, password: string): Promise<MockLoginResult> {
    await delay(400)
    const user = MOCK_USERS.find((u) => u.email === email.trim().toLowerCase())
    if (!user || password !== MOCK_PASSWORD) throw new Error('Email o contraseña incorrectos')
    return signedIn(user.id)
  },
  async socialLogin(provider: string, code: string): Promise<MockLoginResult> {
    await delay(400)
    if (SOCIAL_ERRORS[code]) throw new MockApiError(`Login con ${provider} rechazado`, SOCIAL_ERRORS[code])
    return signedIn(SOCIAL_USER_ID)
  },
  async me(token: string | null): Promise<User> {
    await delay(200)
    const user = mockUserFromToken(token)
    if (!user) throw new Error('Sesión no válida')
    return user
  },
}

export const mockTwoFactor = {
  async verify(mfaToken: string, code: string): Promise<string> {
    await delay(300)
    const user = MOCK_USERS.find((u) => mfaToken === `${MFA_PREFIX}${u.id}`)
    if (!user || !twoFactorOf(user.id).enabled) throw new MockApiError('Verificación caducada', 'invalid_mfa_token')
    if (!acceptCode(twoFactorOf(user.id), code)) throw new MockApiError('Código incorrecto', 'invalid_totp_code')
    return `${TOKEN_PREFIX}${user.id}`
  },
  async status(token: string | null): Promise<TwoFactorStatus> {
    await delay(200)
    const state = twoFactorOf(currentUser(token).id)
    return { enabled: state.enabled, recovery_codes_left: state.enabled ? state.recoveryCodes.length : 0 }
  },
  async setup(token: string | null): Promise<TwoFactorSetup> {
    await delay(300)
    const user = currentUser(token)
    const state = twoFactorOf(user.id)
    if (state.enabled) throw new MockApiError('Ya está activada', 'totp_already_enabled')
    state.pending = true
    saveDemoDb()
    const label = encodeURIComponent(`APIResto:${user.email}`)
    return {
      secret: MOCK_TOTP_SECRET,
      otpauth_uri: `otpauth://totp/${label}?secret=${MOCK_TOTP_SECRET}&issuer=APIResto`,
      qr_svg: MOCK_QR_SVG,
    }
  },
  async enable(token: string | null, code: string): Promise<string[]> {
    await delay(300)
    const state = twoFactorOf(currentUser(token).id)
    if (state.enabled) throw new MockApiError('Ya está activada', 'totp_already_enabled')
    if (!state.pending) throw new MockApiError('Falta preparar la verificación', 'totp_not_set_up')
    if (code.trim() !== MOCK_TOTP_CODE) throw new MockApiError('Código incorrecto', 'invalid_totp_code')
    const codes = Array.from({ length: RECOVERY_CODES }, randomRecoveryCode)
    Object.assign(state, { pending: false, enabled: true, recoveryCodes: [...codes] })
    saveDemoDb()
    return codes
  },
  async disable(token: string | null, code: string): Promise<void> {
    await delay(300)
    const state = twoFactorOf(currentUser(token).id)
    if (!state.enabled) throw new MockApiError('No está activada', 'totp_not_enabled')
    if (!acceptCode(state, code)) throw new MockApiError('Código incorrecto', 'invalid_totp_code')
    Object.assign(state, { pending: false, enabled: false, recoveryCodes: [] })
    saveDemoDb()
  },
}
