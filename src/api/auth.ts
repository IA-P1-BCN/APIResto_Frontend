import { USE_MOCK } from '../config'
import { api } from './client'
import { mockAuth } from './mockAuth'
import { tokenStorage } from './tokenStorage'
import type { LoginResponse, TwoFactorChallenge, User } from './types'

export type LoginResult = { token: string } | { mfaToken: string }

export function toLoginResult(data: LoginResponse | TwoFactorChallenge): LoginResult {
  return 'mfa_token' in data ? { mfaToken: data.mfa_token } : { token: data.access_token }
}

export async function login(email: string, password: string): Promise<LoginResult> {
  if (USE_MOCK) return mockAuth.login(email, password)
  const body = new URLSearchParams({ username: email.trim(), password })
  const { data } = await api.post<LoginResponse | TwoFactorChallenge>('/auth/login', body)
  return toLoginResult(data)
}

export async function fetchMe(): Promise<User> {
  if (USE_MOCK) return mockAuth.me(tokenStorage.get())
  const { data } = await api.get<User>('/auth/me')
  return data
}

export function pingHealth(): void {
  if (USE_MOCK) return
  api.get('/health').catch(() => {
    // Si falla, la primera petición real mostrará el error
  })
}
