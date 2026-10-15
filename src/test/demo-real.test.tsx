import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { demoNavigation } from '../api/demo'
import { mockApi } from './fakeApi'
import { renderApp } from './renderApp'

vi.mock('../config', () => ({ USE_MOCK: false, API_URL: 'http://api.test', GOOGLE_CLIENT_ID: '', GITHUB_CLIENT_ID: '' }))

describe('demo en el despliegue con API', () => {
  it('el login ofrece probar la demo sin cuenta', async () => {
    mockApi(() => ({ status: 200 }))
    renderApp('/login')
    expect(await screen.findByRole('button', { name: 'Probar la demo' })).toBeInTheDocument()
    expect(screen.getByText('Sin cuenta: datos de prueba solo en tu navegador.')).toBeInTheDocument()
    expect(screen.queryByText(/Modo simulado/)).not.toBeInTheDocument()
  })

  it('al pulsarlo recuerda la demo, quita la sesión real y vuelve a cargar el login', async () => {
    mockApi(() => ({ status: 200 }))
    const restart = vi.spyOn(demoNavigation, 'restart').mockImplementation(() => {})
    const { user } = renderApp('/login')
    const tryDemo = await screen.findByRole('button', { name: 'Probar la demo' })
    localStorage.setItem('restoapi.token', 'jwt-caducado')

    await user.click(tryDemo)

    expect(localStorage.getItem('restoapi.demo')).toBe('1')
    expect(localStorage.getItem('restoapi.token')).toBeNull()
    expect(restart).toHaveBeenCalledOnce()
  })
})
