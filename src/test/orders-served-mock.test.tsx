import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { db } from '../api/mock/db'
import { mockServer } from '../api/mock/server'
import { renderApp } from './renderApp'

vi.mock('../config', () => ({ USE_MOCK: true, API_URL: 'http://api.test' }))

function loginAsWaiter() {
  localStorage.setItem('restoapi.token', 'mock-token-2')
}

async function orderList(id: number) {
  return screen.findByRole('list', { name: `Platos del pedido ${id}` })
}

describe('Pedidos: platos servidos en la mesa', () => {
  it('el camarero marca y desmarca un plato como servido', async () => {
    loginAsWaiter()
    const { user } = renderApp('/pedidos')
    const list = await orderList(2)
    const paella = await within(list).findByRole('checkbox', { name: '2× Paella de marisco' })
    expect(paella).not.toBeChecked()
    expect(screen.getAllByText('0 de 3 servidos').length).toBeGreaterThan(0)

    await user.click(paella)
    await waitFor(() => expect(within(list).getByRole('checkbox', { name: '2× Paella de marisco' })).toBeChecked())
    expect(db.orders.find((o) => o.id === 2)!.items.find((i) => i.dish_id === 6)!.served).toBe(true)
    expect(within(list.closest('td')!).getByText('1 de 3 servidos')).toBeInTheDocument()

    await user.click(within(list).getByRole('checkbox', { name: '2× Paella de marisco' }))
    await waitFor(() => expect(within(list).getByRole('checkbox', { name: '2× Paella de marisco' })).not.toBeChecked())
    expect(db.orders.find((o) => o.id === 2)!.items.every((i) => !i.served)).toBe(true)
  })

  it('cocina marca y desmarca un plato como preparado', async () => {
    localStorage.setItem('restoapi.token', 'mock-token-3')
    const { user } = renderApp('/cocina')
    const list = await screen.findByRole('list', { name: 'Platos del pedido 2' })
    const paella = await within(list).findByRole('checkbox', { name: '2× Paella de marisco' })
    expect(paella).not.toBeChecked()
    const ticket = screen.getByRole('article', { name: 'Pedido 2' })
    expect(within(ticket).getByText('0 de 2 preparados')).toBeInTheDocument()

    await user.click(paella)
    await waitFor(() => expect(within(list).getByRole('checkbox', { name: '2× Paella de marisco' })).toBeChecked())
    expect(within(ticket).getByText('1 de 2 preparados')).toBeInTheDocument()
    const line = db.orders.find((o) => o.id === 2)!.items.find((i) => i.dish_id === 6)!
    expect(line.prepared).toBe(true)
    expect(line.served).toBe(false)

    await user.click(within(list).getByRole('checkbox', { name: '2× Paella de marisco' }))
    await waitFor(() => expect(within(list).getByRole('checkbox', { name: '2× Paella de marisco' })).not.toBeChecked())
  })

  it('el camarero ve "Listo" en los platos que cocina ya ha preparado', async () => {
    loginAsWaiter()
    db.orders.find((o) => o.id === 2)!.items[0].prepared = true
    renderApp('/pedidos')
    const list = await orderList(2)
    await within(list).findByRole('checkbox', { name: /Paella de marisco/ })
    expect(within(list).getAllByText('Listo')).toHaveLength(1)
  })

  it('cada rol solo puede marcar lo suyo', async () => {
    localStorage.setItem('restoapi.token', 'mock-token-3')
    await expect(mockServer.updateOrderItem(2, db.orders[1].items[0].id, { served: true })).rejects.toThrow('permiso')
    loginAsWaiter()
    await expect(mockServer.updateOrderItem(2, db.orders[1].items[0].id, { prepared: true })).rejects.toThrow('permiso')
  })

  it('en un pedido pagado se ve lo servido pero no se puede cambiar', async () => {
    loginAsWaiter()
    const order = db.orders.find((o) => o.id === 3)!
    order.status = 'paid'
    order.items[0].served = true
    const { user } = renderApp('/pedidos')
    await screen.findByLabelText('Mostrar')
    await user.selectOptions(screen.getByLabelText('Mostrar'), 'Todos')

    const list = await orderList(3)
    expect(within(list).queryByRole('checkbox')).not.toBeInTheDocument()
    expect(within(list).getByLabelText('servido')).toBeInTheDocument()
    expect(within(list.closest('td')!).getByText('1 de 2 servidos')).toBeInTheDocument()
  })
})
