import { screen } from '@testing-library/react'
import { AxiosError } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import type { User } from '../api/types'
import { mockApi } from './fakeApi'
import { renderApp } from './renderApp'

vi.mock('../config', () => ({ USE_MOCK: false, API_URL: 'http://api.test', GOOGLE_CLIENT_ID: '', GITHUB_CLIENT_ID: '' }))

const ADMIN: User = { id: 1, name: 'Ada Admin', email: 'admin@restoapi.dev', role: 'admin', is_active: true }

describe('login contra la API', () => {
  it('envía el formulario OAuth2 a /auth/login, guarda el token y carga /auth/me', async () => {
    const requests = mockApi((config) => {
      if (config.url === '/auth/login') return { status: 200, data: { access_token: 'jwt-123', token_type: 'bearer' } }
      if (config.url === '/auth/me') return { status: 200, data: ADMIN }
      return { status: 200 }
    })
    const { user } = renderApp('/login')

    await user.type(screen.getByLabelText('Email'), 'admin@restoapi.dev')
    await user.type(screen.getByLabelText('Contraseña'), 'secreta')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('heading', { name: 'Hola, Ada Admin' })).toBeInTheDocument()
    expect(localStorage.getItem('restoapi.token')).toBe('jwt-123')

    const loginRequest = requests.find((r) => r.url === '/auth/login')!
    expect(loginRequest.method).toBe('post')
    expect(String(loginRequest.headers['Content-Type'])).toContain('application/x-www-form-urlencoded')
    expect(String(loginRequest.data)).toBe('username=admin%40restoapi.dev&password=secreta')

    const meRequest = requests.find((r) => r.url === '/auth/me')!
    expect(meRequest.headers.Authorization).toBe('Bearer jwt-123')
  })

  it('con credenciales erróneas (401) muestra el error', async () => {
    mockApi((config) =>
      config.url === '/auth/login' ? { status: 401, data: { detail: 'Incorrect credentials', code: 'auth' } } : { status: 200 },
    )
    const { user } = renderApp('/login')

    await user.type(screen.getByLabelText('Email'), 'admin@restoapi.dev')
    await user.type(screen.getByLabelText('Contraseña'), 'mala')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos')
  })

  it('con demasiados intentos (429) dice cuántos minutos esperar', async () => {
    mockApi((config) =>
      config.url === '/auth/login'
        ? {
            status: 429,
            data: { detail: 'Too many failed login attempts. Try again later.', code: 'too_many_attempts' },
            headers: { 'retry-after': '812' },
          }
        : { status: 200 },
    )
    const { user } = renderApp('/login')

    await user.type(screen.getByLabelText('Email'), 'admin@restoapi.dev')
    await user.type(screen.getByLabelText('Contraseña'), 'secreta')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Demasiados intentos fallidos. Vuelve a intentarlo en 14 minutos.',
    )
  })

  it('un 429 sin Retry-After también sale en castellano', async () => {
    mockApi((config) =>
      config.url === '/auth/login'
        ? { status: 429, data: { detail: 'Too many failed login attempts. Try again later.', code: 'too_many_attempts' } }
        : { status: 200 },
    )
    const { user } = renderApp('/login')

    await user.type(screen.getByLabelText('Email'), 'admin@restoapi.dev')
    await user.type(screen.getByLabelText('Contraseña'), 'secreta')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiados intentos fallidos. Espera unos minutos')
  })

  it('si la API no responde, lo dice claramente', async () => {
    mockApi((config) => {
      if (config.url === '/auth/login') throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config)
      return { status: 200 }
    })
    const { user } = renderApp('/login')

    await user.type(screen.getByLabelText('Email'), 'admin@restoapi.dev')
    await user.type(screen.getByLabelText('Contraseña'), 'secreta')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se puede conectar con la API')
  })

  it('un token expirado (401 en /auth/me) cierra la sesión y lleva al login', async () => {
    localStorage.setItem('restoapi.token', 'jwt-caducado')
    mockApi((config) => (config.url === '/auth/me' ? { status: 401, data: { detail: 'Token expirado' } } : { status: 200 }))
    renderApp('/mesas')

    expect(await screen.findByText('Inicia sesión para continuar')).toBeInTheDocument()
    expect(localStorage.getItem('restoapi.token')).toBeNull()
  })

  it('al abrir la web hace ping a /health para despertar Render', async () => {
    const requests = mockApi(() => ({ status: 200 }))
    renderApp('/login')
    await screen.findByText('Inicia sesión para continuar')
    expect(requests.some((r) => r.url === '/health')).toBe(true)
  })
})
