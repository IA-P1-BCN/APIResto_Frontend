import axios from 'axios'
import { USE_MOCK } from '../config'
import { api } from './client'
import type { ApiErrorBody } from './types'

export const SET_PASSWORD_PATH = '/crear-contrasena'
export const MIN_PASSWORD_LENGTH = 8

export class SetPasswordError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.code = code
  }
}

const MOCK_ERRORS: Record<string, string> = {
  'mock-invalido': 'invalid_token',
  'mock-usado': 'token_used',
  'mock-caducado': 'token_expired',
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function setPassword(token: string, newPassword: string): Promise<void> {
  if (USE_MOCK) {
    await delay(400)
    const code = MOCK_ERRORS[token]
    if (code) throw new SetPasswordError('Enlace no válido', code)
    return
  }
  await api.post('/auth/set-password', { token, new_password: newPassword })
}

export function setPasswordErrorCode(error: unknown): string | undefined {
  if (error instanceof SetPasswordError) return error.code
  if (axios.isAxiosError<ApiErrorBody>(error)) return error.response?.data?.code
  return undefined
}
