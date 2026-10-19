import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { User } from '../api/types'
import { mockApi } from './fakeApi'
import { renderApp } from './renderApp'

vi.mock('../config', () => ({ USE_MOCK: false, API_URL: 'http://api.test', GOOGLE_CLIENT_ID: '', GITHUB_CLIENT_ID: '' }))

const WAITER: User = { id: 2, name: 'Wanda Waiter', email: 'waiter@restoapi.dev', role: 'waiter', is_active: true }

async function login(user: ReturnType<typeof renderApp>['user']) {
  await user.type(screen.getByLabelText('Email'), 'waiter@restoapi.dev')
  await user.type(screen.getByLabelText('Contraseña'), 'secreta')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('verificación en dos pasos contra la API', () => {
  it('si /auth/login pide el código, lo canjea en /auth/2fa/verify', async () => {
    const requests = mockApi((config) => {
      if (config.url === '/auth/login') return { status: 200, data: { mfa_required: true, mfa_token: 'mfa-1' } }
      if (config.url === '/auth/2fa/verify') return { status: 200, data: { access_token: 'jwt-2fa', token_type: 'bearer' } }
      if (config.url === '/auth/me') return { status: 200, data: WAITER }
      return { status: 200 }
    })
    const { user } = renderApp('/login')
    await login(user)

    await user.type(await screen.findByLabelText('Código de verificación'), '123456')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))

    expect(await screen.findByRole('heading', { name: 'Hola, Wanda Waiter' })).toBeInTheDocument()
    expect(localStorage.getItem('restoapi.token')).toBe('jwt-2fa')
    const verify = requests.find((r) => r.url === '/auth/2fa/verify')!
    expect(JSON.parse(String(verify.data))).toEqual({ mfa_token: 'mfa-1', code: '123456' })
  })

  it('si el token temporal ha caducado, pide volver a iniciar sesión', async () => {
    mockApi((config) => {
      if (config.url === '/auth/login') return { status: 200, data: { mfa_required: true, mfa_token: 'mfa-1' } }
      if (config.url === '/auth/2fa/verify') {
        return { status: 401, data: { detail: 'Invalid or expired two-factor token', code: 'invalid_mfa_token' } }
      }
      return { status: 200 }
    })
    const { user } = renderApp('/login')
    await login(user)

    await user.type(await screen.findByLabelText('Código de verificación'), '123456')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La verificación ha caducado')
    expect(screen.queryByRole('button', { name: 'Verificar' })).not.toBeInTheDocument()
    expect(localStorage.getItem('restoapi.token')).toBeNull()
  })

  it('tras demasiados códigos incorrectos (429) dice cuánto esperar', async () => {
    mockApi((config) => {
      if (config.url === '/auth/login') return { status: 200, data: { mfa_required: true, mfa_token: 'mfa-1' } }
      if (config.url === '/auth/2fa/verify') {
        return {
          status: 429,
          data: { detail: 'Too many failed login attempts. Try again later.', code: 'too_many_attempts' },
          headers: { 'retry-after': '45' },
        }
      }
      return { status: 200 }
    })
    const { user } = renderApp('/login')
    await login(user)

    await user.type(await screen.findByLabelText('Código de verificación'), '123456')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Demasiados intentos fallidos. Vuelve a intentarlo en 1 minuto.',
    )
  })

  it('Seguridad llama a setup y enable y muestra el QR de la API', async () => {
    localStorage.setItem('restoapi.token', 'jwt-1')
    const requests = mockApi((config) => {
      if (config.url === '/auth/me') return { status: 200, data: WAITER }
      if (config.url === '/users/me/2fa') return { status: 200, data: { enabled: false, recovery_codes_left: 0 } }
      if (config.url === '/users/me/2fa/setup') {
        return { status: 200, data: { secret: 'ABCDEF', otpauth_uri: 'otpauth://totp/x', qr_svg: '<svg></svg>' } }
      }
      if (config.url === '/users/me/2fa/enable') return { status: 200, data: { recovery_codes: ['aaaaaa-bbbbbb'] } }
      return { status: 200 }
    })
    const { user } = renderApp('/seguridad')

    await user.click(await screen.findByRole('button', { name: 'Activar' }))
    const qr = await screen.findByRole('img', { name: 'Código QR para la app de autenticación' })
    expect(qr.getAttribute('src')).toBe(`data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg></svg>')}`)

    await user.type(screen.getByLabelText('Código de 6 dígitos de la app'), ' 123456 ')
    await user.click(screen.getByRole('button', { name: 'Activar' }))

    expect(await screen.findByText('aaaaaa-bbbbbb')).toBeInTheDocument()
    const enable = requests.find((r) => r.url === '/users/me/2fa/enable')!
    expect(JSON.parse(String(enable.data))).toEqual({ code: '123456' })
  })
})
