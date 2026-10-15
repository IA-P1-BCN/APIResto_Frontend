import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { socialLoginUrl } from '../api/social'
import type { User } from '../api/types'
import { mockApi } from './fakeApi'
import { renderApp } from './renderApp'

vi.mock('../config', () => ({
  USE_MOCK: false,
  API_URL: 'http://api.test',
  GOOGLE_CLIENT_ID: 'google-client-id',
  GITHUB_CLIENT_ID: '',
}))

const CLIENT: User = { id: 9, name: 'Clara Cliente', email: 'clara@gmail.com', role: 'customer', is_active: true }

describe('login con Google y GitHub contra la API', () => {
  it('solo sale el botón de los proveedores que tienen client id', async () => {
    mockApi(() => ({ status: 200 }))
    renderApp('/login')
    expect(await screen.findByRole('button', { name: 'Continuar con Google' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continuar con GitHub' })).not.toBeInTheDocument()
  })

  it('la URL de Google lleva el client id, la callback, los permisos y el state guardado', () => {
    const url = new URL(socialLoginUrl('google'))
    const saved = JSON.parse(sessionStorage.getItem('restoapi.oauth')!) as { provider: string; state: string }
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('client_id')).toBe('google-client-id')
    expect(url.searchParams.get('redirect_uri')).toBe(`${window.location.origin}/auth/callback`)
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('scope')).toBe('openid email profile')
    expect(saved).toEqual({ provider: 'google', state: url.searchParams.get('state') })
    expect(saved.state).toMatch(/^[0-9a-f]{32}$/)
  })

  it('la callback envía el code y la redirect_uri a /auth/social/{provider} y entra', async () => {
    sessionStorage.setItem('restoapi.oauth', JSON.stringify({ provider: 'google', state: 'abc' }))
    const requests = mockApi((config) => {
      if (config.url === '/auth/social/google') return { status: 200, data: { access_token: 'jwt-social', token_type: 'bearer' } }
      if (config.url === '/auth/me') return { status: 200, data: CLIENT }
      return { status: 200, data: [] }
    })
    renderApp('/auth/callback?code=codigo-de-google&state=abc')

    expect(await screen.findByRole('heading', { level: 1, name: 'Hola, Clara Cliente' })).toBeInTheDocument()
    expect(localStorage.getItem('restoapi.token')).toBe('jwt-social')
    const social = requests.filter((r) => r.url === '/auth/social/google')
    expect(social).toHaveLength(1)
    expect(JSON.parse(String(social[0].data))).toEqual({
      code: 'codigo-de-google',
      redirect_uri: `${window.location.origin}/auth/callback`,
    })
  })

  it.each([
    [401, 'inactive_account', 'Esta cuenta está desactivada'],
    [503, 'provider_not_configured', 'El inicio de sesión con Google todavía no está disponible.'],
    [502, 'provider_unavailable', 'Google no responde ahora mismo'],
  ])('un %s con código %s muestra un mensaje claro', async (status, code, message) => {
    sessionStorage.setItem('restoapi.oauth', JSON.stringify({ provider: 'google', state: 'abc' }))
    mockApi(() => ({ status, data: { detail: 'error', code } }))
    renderApp('/auth/callback?code=x&state=abc')
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(localStorage.getItem('restoapi.token')).toBeNull()
  })
})
