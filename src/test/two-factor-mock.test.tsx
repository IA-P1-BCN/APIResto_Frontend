import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { mockTwoFactor } from '../api/mockAuth'
import { renderApp } from './renderApp'

vi.mock('../config', () => ({ USE_MOCK: true, API_URL: 'http://api.test' }))

const WAITER_TOKEN = 'mock-token-2'

async function enableFor(token: string): Promise<string[]> {
  await mockTwoFactor.setup(token)
  return mockTwoFactor.enable(token, '123456')
}

async function loginAsWaiter(user: ReturnType<typeof renderApp>['user']) {
  await user.type(await screen.findByLabelText('Email'), 'camarero@restoapi.dev')
  await user.type(screen.getByLabelText('Contraseña'), 'demo1234')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('verificación en dos pasos (modo simulado)', () => {
  it('Seguridad sale en el menú de todos los roles', async () => {
    localStorage.setItem('restoapi.token', 'mock-token-4')
    renderApp('/')
    expect(await screen.findByRole('link', { name: 'Seguridad' })).toHaveAttribute('href', '/seguridad')
  })

  it('activa la 2FA con el QR y un código y muestra 8 códigos de recuperación', async () => {
    localStorage.setItem('restoapi.token', WAITER_TOKEN)
    const { user } = renderApp('/seguridad')

    expect(await screen.findByText('Desactivada.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Activar' }))

    expect(await screen.findByRole('img', { name: 'Código QR para la app de autenticación' })).toBeInTheDocument()
    expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Código de 6 dígitos de la app'), '000000')
    await user.click(screen.getByRole('button', { name: 'Activar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El código no es correcto')

    await user.type(screen.getByLabelText('Código de 6 dígitos de la app'), '123456')
    await user.click(screen.getByRole('button', { name: 'Activar' }))

    const list = await screen.findByRole('list', { name: 'Códigos de recuperación' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(8)
    await user.click(screen.getByRole('button', { name: 'Ya los he guardado' }))
    expect(await screen.findByText('Activada. Al entrar se te pide un código de la app.')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
  })

  it('con 2FA, el login pide el código y sin él no entra', async () => {
    await enableFor(WAITER_TOKEN)
    const { user } = renderApp('/login')
    await loginAsWaiter(user)

    expect(await screen.findByText('Verificación en dos pasos')).toBeInTheDocument()
    expect(localStorage.getItem('restoapi.token')).toBeNull()

    await user.type(screen.getByLabelText('Código de verificación'), '000000')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El código no es correcto')

    await user.type(screen.getByLabelText('Código de verificación'), '123456')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Hola, Camarero Demo' })).toBeInTheDocument()
    expect(localStorage.getItem('restoapi.token')).toBe(WAITER_TOKEN)
  })

  it('un código de recuperación sirve una sola vez', async () => {
    const [first] = await enableFor(WAITER_TOKEN)
    await mockTwoFactor.verify('mock-mfa-2', first)

    const { user } = renderApp('/login')
    await loginAsWaiter(user)
    await user.click(await screen.findByRole('button', { name: 'Usar un código de recuperación' }))
    await user.type(screen.getByLabelText('Código de recuperación'), first)
    await user.click(screen.getByRole('button', { name: 'Verificar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El código no es correcto')
    expect(await mockTwoFactor.status(WAITER_TOKEN)).toEqual({ enabled: true, recovery_codes_left: 7 })
  })

  it('"Volver al inicio de sesión" vuelve al formulario', async () => {
    await enableFor(WAITER_TOKEN)
    const { user } = renderApp('/login')
    await loginAsWaiter(user)
    await user.click(await screen.findByRole('button', { name: 'Volver al inicio de sesión' }))
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('el login social también pide el código', async () => {
    await enableFor('mock-token-4')
    sessionStorage.setItem('restoapi.oauth', JSON.stringify({ provider: 'google', state: 'abc' }))
    const { user } = renderApp('/auth/callback?code=mock-code&state=abc')

    await user.type(await screen.findByLabelText('Código de verificación'), '123456')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Hola, Cliente Demo' })).toBeInTheDocument()
  })

  it('desactiva la 2FA con un código y el login vuelve a ser normal', async () => {
    await enableFor(WAITER_TOKEN)
    localStorage.setItem('restoapi.token', WAITER_TOKEN)
    const { user } = renderApp('/seguridad')

    await user.type(await screen.findByLabelText('Código de la app o de recuperación'), '123456')
    await user.click(screen.getByRole('button', { name: 'Desactivar' }))
    expect(await screen.findByText('Desactivada.')).toBeInTheDocument()
    expect(await mockTwoFactor.status(WAITER_TOKEN)).toEqual({ enabled: false, recovery_codes_left: 0 })
  })
})
