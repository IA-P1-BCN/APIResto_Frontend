import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderApp } from './renderApp'

vi.mock('../config', () => ({ USE_MOCK: true, API_URL: 'http://api.test' }))

function savedState(provider: string, state = 'abc') {
  sessionStorage.setItem('restoapi.oauth', JSON.stringify({ provider, state }))
}

describe('login con Google y GitHub (modo simulado)', () => {
  it('el login ofrece Google y GitHub', async () => {
    renderApp('/login')
    expect(await screen.findByRole('button', { name: 'Continuar con Google' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continuar con GitHub' })).toBeInTheDocument()
  })

  it('Google simulado: se elige la cuenta, se continúa y entra como cliente en Inicio', async () => {
    const { user } = renderApp('/login')
    await user.click(await screen.findByRole('button', { name: 'Continuar con Google' }))
    const dialog = screen.getByRole('dialog', { name: 'Iniciar sesión con Google (simulado)' })
    expect(dialog).toHaveTextContent('Simulación · en producción se abre accounts.google.com')
    expect(dialog).toHaveTextContent('Elige una cuenta')
    expect(dialog).toHaveTextContent('cliente@restoapi.dev')
    await user.click(within(dialog).getByRole('button', { name: 'Continuar' }))
    expect(await within(dialog).findByText('Volviendo a APIResto…')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 1, name: 'Hola, Cliente Demo' }, { timeout: 3000 })).toBeInTheDocument()
    expect(localStorage.getItem('restoapi.token')).toBe('mock-token-4')
    expect(sessionStorage.getItem('restoapi.oauth')).toBeNull()
  })

  it('GitHub simulado: pide autorizar el email y, si se cancela, lo explica', async () => {
    const { user } = renderApp('/login')
    await user.click(await screen.findByRole('button', { name: 'Continuar con GitHub' }))
    const dialog = screen.getByRole('dialog', { name: 'Iniciar sesión con GitHub (simulado)' })
    expect(dialog).toHaveTextContent('Autorizar APIResto')
    expect(dialog).toHaveTextContent('Leer tus direcciones de email (solo lectura)')
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Has cancelado el inicio de sesión con GitHub.')
    expect(localStorage.getItem('restoapi.token')).toBeNull()
  })

  it('cerrar la ventana del proveedor deja en el login', async () => {
    const { user } = renderApp('/login')
    await user.click(await screen.findByRole('button', { name: 'Continuar con GitHub' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('sin el state guardado no inicia sesión', async () => {
    renderApp('/auth/callback?code=mock-code&state=abc')
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido comprobar el inicio de sesión')
    expect(screen.getByRole('link', { name: 'Volver al inicio de sesión' })).toHaveAttribute('href', '/login')
    expect(localStorage.getItem('restoapi.token')).toBeNull()
  })

  it('con un state distinto no inicia sesión', async () => {
    savedState('google', 'bueno')
    renderApp('/auth/callback?code=mock-code&state=falso')
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido comprobar el inicio de sesión')
    expect(localStorage.getItem('restoapi.token')).toBeNull()
  })

  it('si el usuario cancela en el proveedor lo explica', async () => {
    savedState('github')
    renderApp('/auth/callback?error=access_denied&state=abc')
    expect(await screen.findByRole('alert')).toHaveTextContent('Has cancelado el inicio de sesión con GitHub.')
  })

  it('si el proveedor no da un email verificado lo explica', async () => {
    savedState('github')
    renderApp('/auth/callback?code=mock-unverified&state=abc')
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu cuenta de GitHub no tiene un email verificado')
    expect(localStorage.getItem('restoapi.token')).toBeNull()
  })
})
