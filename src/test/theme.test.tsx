import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderApp } from './renderApp'

vi.mock('../config', () => ({ USE_MOCK: true, API_URL: 'http://api.test' }))

describe('modo claro y oscuro', () => {
  it('cambia de tema desde el login y lo recuerda', async () => {
    const { user } = renderApp('/login')
    await user.click(await screen.findByRole('button', { name: 'Activar modo oscuro' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('restoapi.theme')).toBe('dark')

    await user.click(screen.getByRole('button', { name: 'Activar modo claro' }))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('restoapi.theme')).toBe('light')
  })

  it('con sesión iniciada, el botón está en la barra superior y respeta el tema guardado', async () => {
    localStorage.setItem('restoapi.theme', 'dark')
    localStorage.setItem('restoapi.token', 'mock-token-1')
    const { user } = renderApp('/')
    await user.click(await screen.findByRole('button', { name: 'Activar modo claro' }))
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
