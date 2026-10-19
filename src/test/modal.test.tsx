import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderApp } from './renderApp'

vi.mock('../config', () => ({ USE_MOCK: true, API_URL: 'http://api.test' }))

function loginAs(token: string) {
  localStorage.setItem('restoapi.token', token)
}

describe('formularios en ventana modal', () => {
  it('el nuevo pedido se abre en un modal con el foco en el primer campo y se cierra con ✕', async () => {
    loginAs('mock-token-2')
    const { user } = renderApp('/pedidos')
    const open = await screen.findByRole('button', { name: '+ Nuevo pedido' })
    await user.click(open)

    const dialog = screen.getByRole('dialog', { name: 'Nuevo pedido' })
    expect(within(dialog).getByRole('form', { name: 'Nuevo pedido' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Mesa')).toHaveFocus()
    expect(document.body.style.overflow).toBe('hidden')

    await user.click(within(dialog).getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')
    await waitFor(() => expect(screen.getByRole('button', { name: '+ Nuevo pedido' })).toBeInTheDocument())
  })

  it('Escape cierra el modal', async () => {
    loginAs('mock-token-1')
    const { user } = renderApp('/mesas')
    await user.click(await screen.findByRole('button', { name: '+ Nueva mesa' }))
    expect(screen.getByRole('dialog', { name: 'Nueva mesa' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('el foco no sale del modal al tabular', async () => {
    loginAs('mock-token-1')
    const { user } = renderApp('/mesas')
    await user.click(await screen.findByRole('button', { name: '+ Nueva mesa' }))
    const dialog = screen.getByRole('dialog', { name: 'Nueva mesa' })

    for (let i = 0; i < 12; i++) {
      await user.tab()
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    }
  })

  it('los platos y las categorías también se editan en un modal', async () => {
    loginAs('mock-token-1')
    const { user } = renderApp('/carta')
    const newDish = await screen.findByRole('button', { name: '+ Nuevo plato' })
    await waitFor(() => expect(newDish).toBeEnabled())
    await user.click(newDish)
    expect(screen.getByRole('dialog', { name: 'Nuevo plato' })).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: 'Gestionar categorías' }))
    expect(screen.getByRole('dialog', { name: 'Categorías' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
