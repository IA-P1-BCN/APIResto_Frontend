import { USE_MOCK } from '../config'
import { api } from './client'
import { getErrorCode, getErrorMessage, tooManyAttemptsMessage } from './errors'
import { mockTwoFactor } from './mockAuth'
import { tokenStorage } from './tokenStorage'
import type { LoginResponse, TwoFactorSetup, TwoFactorStatus } from './types'

const MESSAGES: Record<string, string> = {
  invalid_totp_code: 'El código no es correcto. Revisa la app e inténtalo otra vez.',
  invalid_mfa_token: 'La verificación ha caducado. Vuelve a iniciar sesión.',
  totp_already_enabled: 'La verificación en dos pasos ya está activada.',
  totp_not_set_up: 'Vuelve a empezar la activación.',
  totp_not_enabled: 'La verificación en dos pasos ya está desactivada.',
}

export function twoFactorErrorMessage(error: unknown): string {
  return tooManyAttemptsMessage(error) ?? MESSAGES[getErrorCode(error) ?? ''] ?? getErrorMessage(error)
}

export async function verifyTwoFactor(mfaToken: string, code: string): Promise<string> {
  if (USE_MOCK) return mockTwoFactor.verify(mfaToken, code)
  const { data } = await api.post<LoginResponse>('/auth/2fa/verify', { mfa_token: mfaToken, code: code.trim() })
  return data.access_token
}

export async function getTwoFactorStatus(): Promise<TwoFactorStatus> {
  if (USE_MOCK) return mockTwoFactor.status(tokenStorage.get())
  const { data } = await api.get<TwoFactorStatus>('/users/me/2fa')
  return data
}

export async function setupTwoFactor(): Promise<TwoFactorSetup> {
  if (USE_MOCK) return mockTwoFactor.setup(tokenStorage.get())
  const { data } = await api.post<TwoFactorSetup>('/users/me/2fa/setup')
  return data
}

export async function enableTwoFactor(code: string): Promise<string[]> {
  if (USE_MOCK) return mockTwoFactor.enable(tokenStorage.get(), code)
  const { data } = await api.post<{ recovery_codes: string[] }>('/users/me/2fa/enable', { code: code.trim() })
  return data.recovery_codes
}

export async function disableTwoFactor(code: string): Promise<void> {
  if (USE_MOCK) return mockTwoFactor.disable(tokenStorage.get(), code)
  await api.post('/users/me/2fa/disable', { code: code.trim() })
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
