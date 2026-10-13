import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderApp } from './renderApp'

vi.mock('../config', () => ({ USE_MOCK: true, API_URL: 'http://api.test' }))

async function loginAs(user: ReturnType<typeof renderApp>['user'], email: string, password = 'demo1234') {
  await user.type(await screen.findByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Contraseña'), password)
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('login y navegación por rol (modo simulado)', () => {
  it('sin sesión, una ruta protegida redirige al login', async () => {
    renderApp('/mesas')
    expect(await screen.findByText('Inicia sesión para continuar')).toBeInTheDocument()
  })

  it('tras el login vuelve a la página que se había pedido', async () => {
    const { user } = renderApp('/mesas')
    await loginAs(user, 'camarero@restoapi.dev')
    expect(await screen.findByRole('heading', { name: 'Mesas' })).toBeInTheDocument()
  })

  it('el camarero ve su menú y no el de administración', async () => {
    const { user } = renderApp('/login')
    await loginAs(user, 'camarero@restoapi.dev')
    expect(await screen.findByRole('heading', { name: 'Hola, Camarero Demo' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mesas' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pedidos' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Estadísticas' })).not.toBeInTheDocument()
  })

  it('un rol sin permiso ve la página 403', async () => {
    localStorage.setItem('restoapi.token', 'mock-token-2')
    renderApp('/usuarios')
    expect(await screen.findByRole('heading', { name: '403 · Sin acceso' })).toBeInTheDocument()
  })

  it('cocina solo ve carta y cocina', async () => {
    localStorage.setItem('restoapi.token', 'mock-token-3')
    renderApp('/')
    expect(await screen.findByRole('link', { name: 'Cocina' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Carta' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Mesas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Pedidos' })).not.toBeInTheDocument()
  })

  it('barra entra en Inicio, ve la carta y no las vistas de otros roles', async () => {
    const { user } = renderApp('/login')
    await loginAs(user, 'barra@restoapi.dev')
    expect(await screen.findByRole('heading', { name: 'Hola, Barra Demo' })).toBeInTheDocument()
    expect(screen.getByText('Barra', { selector: '.badge' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Carta' })).toBeInTheDocument()
    for (const name of ['Mesas', 'Pedidos', 'Cocina', 'Usuarios']) {
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument()
    }
  })

  it('el cliente ve "Mis reservas"', async () => {
    localStorage.setItem('restoapi.token', 'mock-token-4')
    renderApp('/')
    expect(await screen.findByRole('link', { name: 'Mis reservas' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Mesas' })).not.toBeInTheDocument()
  })

  it('el botón muestra y oculta la contraseña', async () => {
    const { user } = renderApp('/login')
    const input = await screen.findByLabelText('Contraseña')
    expect(input).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(input).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: 'Ocultar contraseña' }))
    expect(input).toHaveAttribute('type', 'password')
  })

  it('con contraseña incorrecta muestra un error y no entra', async () => {
    const { user } = renderApp('/login')
    await loginAs(user, 'admin@restoapi.dev', 'mala')
    expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos')
    expect(localStorage.getItem('restoapi.token')).toBeNull()
  })

  it('la sesión se restaura al recargar y se cierra con "Cerrar sesión"', async () => {
    localStorage.setItem('restoapi.token', 'mock-token-1')
    const { user } = renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Hola, Admin Demo' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByText('Inicia sesión para continuar')).toBeInTheDocument()
    expect(localStorage.getItem('restoapi.token')).toBeNull()
  })

  it('un token guardado que ya no es válido lleva al login', async () => {
    localStorage.setItem('restoapi.token', 'mock-token-999')
    renderApp('/')
    expect(await screen.findByText('Inicia sesión para continuar')).toBeInTheDocument()
    expect(localStorage.getItem('restoapi.token')).toBeNull()
  })
})
