import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { mockApi } from './fakeApi'
import { renderApp } from './renderApp'

vi.mock('../config', () => ({ USE_MOCK: false, API_URL: 'http://api.test', GOOGLE_CLIENT_ID: '', GITHUB_CLIENT_ID: '' }))

async function fill(user: ReturnType<typeof renderApp>['user'], password: string, repeat = password) {
  await user.type(await screen.findByLabelText('Contraseña nueva'), password)
  await user.type(screen.getByLabelText('Repite la contraseña'), repeat)
  await user.click(screen.getByRole('button', { name: 'Crear contraseña' }))
}

describe('crear la contraseña con el enlace del email (HU-52)', () => {
  it('envía el token y la contraseña a /auth/set-password y enlaza al login', async () => {
    const requests = mockApi(() => ({ status: 204 }))
    const { user } = renderApp('/crear-contrasena?token=abc123')

    await fill(user, 'MiClave2026')

    expect(await screen.findByText('Contraseña creada. Ya puedes iniciar sesión.')).toBeInTheDocument()
    const request = requests.find((r) => r.url === '/auth/set-password')!
    expect(request.method).toBe('post')
    expect(JSON.parse(String(request.data))).toEqual({ token: 'abc123', new_password: 'MiClave2026' })
    await user.click(screen.getByRole('link', { name: 'Ir a iniciar sesión' }))
    expect(await screen.findByText('Inicia sesión para continuar')).toBeInTheDocument()
  })

  it('es una página pública: no pide iniciar sesión', async () => {
    mockApi(() => ({ status: 200 }))
    renderApp('/crear-contrasena?token=abc123')
    expect(await screen.findByText('Crea tu contraseña para entrar en la app')).toBeInTheDocument()
  })

  it.each([
    ['invalid_token', 400, 'Este enlace no es válido. Pide uno nuevo al restaurante.'],
    ['token_used', 410, 'Este enlace ya se ha usado. Si ya creaste tu contraseña, inicia sesión.'],
    ['token_expired', 410, 'Este enlace ha caducado. Pide uno nuevo al restaurante.'],
  ])('con %s muestra su mensaje y el enlace al login', async (code, status, message) => {
    mockApi(() => ({ status, data: { detail: 'Error', code } }))
    const { user } = renderApp('/crear-contrasena?token=abc123')

    await fill(user, 'MiClave2026')

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByRole('link', { name: 'Ir a iniciar sesión' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Contraseña nueva')).not.toBeInTheDocument()
  })

  it('otro error deja el formulario para reintentar', async () => {
    mockApi(() => ({ status: 500, data: { detail: 'Internal server error', code: 'internal_error' } }))
    const { user } = renderApp('/crear-contrasena?token=abc123')

    await fill(user, 'MiClave2026')

    expect(await screen.findByRole('alert')).toHaveTextContent('Internal server error')
    expect(screen.getByLabelText('Contraseña nueva')).toBeInTheDocument()
  })
})
