import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { demoNavigation } from '../api/demo'
import { renderApp } from './renderApp'

vi.mock('../config', () => ({ USE_MOCK: true, API_URL: 'http://api.test', GOOGLE_CLIENT_ID: '', GITHUB_CLIENT_ID: '' }))

describe('dentro de la demo', () => {
  it('el login muestra los usuarios demo y el botón para salir', async () => {
    localStorage.setItem('restoapi.demo', '1')
    renderApp('/login')
    expect(await screen.findByRole('button', { name: 'Administración' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salir de la demo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Probar la demo' })).not.toBeInTheDocument()
  })

  it('la cabecera avisa de la demo y permite salir', async () => {
    localStorage.setItem('restoapi.demo', '1')
    localStorage.setItem('restoapi.token', 'mock-token-1')
    const restart = vi.spyOn(demoNavigation, 'restart').mockImplementation(() => {})
    const { user } = renderApp('/')

    expect(await screen.findByText('Estás en la demo: datos de prueba guardados solo en este navegador.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Salir de la demo' }))

    expect(localStorage.getItem('restoapi.demo')).toBeNull()
    expect(localStorage.getItem('restoapi.token')).toBeNull()
    expect(restart).toHaveBeenCalledOnce()
  })

  it('Empezar de cero borra los datos guardados de la demo y la sesión', async () => {
    localStorage.setItem('restoapi.demo', '1')
    localStorage.setItem('restoapi.demo.db', '{"version":1}')
    const restart = vi.spyOn(demoNavigation, 'restart').mockImplementation(() => {})
    const { user } = renderApp('/login')

    await user.click(await screen.findByRole('button', { name: 'Empezar de cero' }))

    expect(localStorage.getItem('restoapi.demo.db')).toBeNull()
    expect(localStorage.getItem('restoapi.demo')).toBe('1')
    expect(restart).toHaveBeenCalledOnce()
  })

  it('con el modo simulado de desarrollo (sin elegir la demo) no sale el botón de salir', async () => {
    renderApp('/login')
    expect(await screen.findByRole('button', { name: 'Administración' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Salir de la demo' })).not.toBeInTheDocument()
  })
})
