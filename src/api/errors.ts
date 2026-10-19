import axios from 'axios'
import type { ApiErrorBody } from './types'

export function getErrorMessage(error: unknown, fallback = 'Ha ocurrido un error inesperado'): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    if (!error.response) {
      return 'No se puede conectar con la API. Inténtalo de nuevo en unos segundos.'
    }
    const detail = error.response.data?.detail
    if (typeof detail === 'string') return detail
    return fallback
  }
  if (error instanceof Error) return error.message
  return fallback
}

export function getErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError<ApiErrorBody>(error)) return error.response?.data?.code
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code : undefined
}

export function isUnauthorized(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 401
}

export function tooManyAttemptsMessage(error: unknown): string | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 429) return null
  const seconds = Number(error.response.headers?.['retry-after'])
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 'Demasiados intentos fallidos. Espera unos minutos y vuelve a intentarlo.'
  }
  const minutes = Math.ceil(seconds / 60)
  return `Demasiados intentos fallidos. Vuelve a intentarlo en ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}.`
}
