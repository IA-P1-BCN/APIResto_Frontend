import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderApp } from './renderApp'

vi.mock('../config', () => ({ USE_MOCK: true, API_URL: 'http://api.test', GOOGLE_CLIENT_ID: '', GITHUB_CLIENT_ID: '' }))

async function fill(user: ReturnType<typeof renderApp>['user'], password: string, repeat = password) {
  await user.type(await screen.findByLabelText('Contraseña nueva'), password)
  await user.type(screen.getByLabelText('Repite la contraseña'), repeat)
  await user.click(screen.getByRole('button', { name: 'Crear contraseña' }))
}

describe('crear la contraseña (modo simulado, HU-52)', () => {
  it('con un enlace válido crea la contraseña', async () => {
    const { user } = renderApp('/crear-contrasena?token=demo')
    await fill(user, 'MiClave2026')
    expect(await screen.findByText('Contraseña creada. Ya puedes iniciar sesión.')).toBeInTheDocument()
  })

  it('sin token avisa de que el enlace no es válido', async () => {
    renderApp('/crear-contrasena')
    expect(await screen.findByRole('alert')).toHaveTextContent('Este enlace no es válido')
    expect(screen.queryByLabelText('Contraseña nueva')).not.toBeInTheDocument()
  })

  it('pide al menos 8 caracteres sin llamar a la API', async () => {
    const { user } = renderApp('/crear-contrasena?token=demo')
    await fill(user, 'corta')
    expect(await screen.findByRole('alert')).toHaveTextContent('al menos 8 caracteres')
  })

  it('avisa si las dos contraseñas no coinciden', async () => {
    const { user } = renderApp('/crear-contrasena?token=demo')
    await fill(user, 'MiClave2026', 'OtraClave2026')
    expect(await screen.findByRole('alert')).toHaveTextContent('no coinciden')
  })

  it('simula un enlace caducado', async () => {
    const { user } = renderApp('/crear-contrasena?token=mock-caducado')
    await fill(user, 'MiClave2026')
    expect(await screen.findByRole('alert')).toHaveTextContent('Este enlace ha caducado')
  })

  it('el botón Mostrar enseña las dos contraseñas', async () => {
    const { user } = renderApp('/crear-contrasena?token=demo')
    await user.click(await screen.findByRole('button', { name: 'Mostrar contraseña' }))
    expect(screen.getByLabelText('Contraseña nueva')).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText('Repite la contraseña')).toHaveAttribute('type', 'text')
  })
})
