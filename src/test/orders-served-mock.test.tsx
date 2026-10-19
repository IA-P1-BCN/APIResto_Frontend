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

const line = (orderId: number, dishId: number) =>
  db.orders.find((o) => o.id === orderId)!.items.find((i) => i.dish_id === dishId)!

describe('Pedidos: botones del pedido a la vista', () => {
  it('cada pedido lleva arriba la mesa, el estado y sus botones, antes de los platos', async () => {
    loginAsWaiter()
    renderApp('/pedidos')
    const list = await orderList(2)
    const card = list.closest('article')!
    const cancel = within(card).getByRole('button', { name: 'Cancelar pedido 2' })

    expect(within(card).getByRole('banner')).toHaveTextContent('Mesa')
    expect(within(card).getByRole('banner')).toContainElement(cancel)
    expect(cancel.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('Pedidos: platos servidos en la mesa', () => {
  it('el camarero marca y desmarca un plato de una unidad como servido', async () => {
    loginAsWaiter()
    const { user } = renderApp('/pedidos')
    const list = await orderList(2)
    const salad = await within(list).findByRole('checkbox', { name: '1× Ensalada de burrata' })
    expect(salad).not.toBeChecked()
    expect(screen.getAllByText('0 de 5 servidos').length).toBeGreaterThan(0)

    await user.click(salad)
    await waitFor(() => expect(within(list).getByRole('checkbox', { name: '1× Ensalada de burrata' })).toBeChecked())
    expect(line(2, 3).served).toBe(true)
    expect(within(list.closest('article')!).getByText('1 de 5 servidos')).toBeInTheDocument()

    await user.click(within(list).getByRole('checkbox', { name: '1× Ensalada de burrata' }))
    await waitFor(() => expect(within(list).getByRole('checkbox', { name: '1× Ensalada de burrata' })).not.toBeChecked())
    expect(line(2, 3).served).toBe(false)
  })

  it('el camarero sirve las dos paellas de una en una', async () => {
    loginAsWaiter()
    const { user } = renderApp('/pedidos')
    const list = await orderList(2)
    await user.click(await within(list).findByRole('button', { name: 'Una servida más de Paella de marisco' }))
    expect(await within(list).findByText('1 de 2 servidas')).toBeInTheDocument()
    expect(line(2, 6)).toMatchObject({ served_quantity: 1, served: false })

    await user.click(within(list).getByRole('button', { name: 'Una servida más de Paella de marisco' }))
    expect(await within(list).findByText('2 de 2 servidas')).toBeInTheDocument()
    expect(line(2, 6)).toMatchObject({ served_quantity: 2, served: true })
    expect(within(list).getByRole('button', { name: 'Una servida más de Paella de marisco' })).toBeDisabled()

    await user.click(within(list).getByRole('button', { name: 'Una servida menos de Paella de marisco' }))
    expect(await within(list).findByText('1 de 2 servidas')).toBeInTheDocument()
  })

  it('cocina prepara las paellas de una en una y la ensalada con su casilla', async () => {
    localStorage.setItem('restoapi.token', 'mock-token-3')
    const { user } = renderApp('/cocina')
    const list = await screen.findByRole('list', { name: 'Platos del pedido 2' })
    const ticket = screen.getByRole('article', { name: 'Pedido 2' })
    await within(list).findByRole('button', { name: 'Una preparada más de Paella de marisco' })
    expect(within(ticket).getByText('0 de 3 preparados')).toBeInTheDocument()

    await user.click(within(list).getByRole('button', { name: 'Una preparada más de Paella de marisco' }))
    await waitFor(() => expect(within(ticket).getByText('1 de 3 preparados')).toBeInTheDocument())
    expect(line(2, 6)).toMatchObject({ prepared_quantity: 1, prepared: false, served: false })

    await user.click(within(list).getByRole('checkbox', { name: '1× Ensalada de burrata' }))
    await waitFor(() => expect(within(ticket).getByText('2 de 3 preparados')).toBeInTheDocument())
    expect(line(2, 3).prepared).toBe(true)
  })

  it('el camarero ve cuántas unidades ha preparado ya cocina', async () => {
    loginAsWaiter()
    Object.assign(line(2, 6), { prepared_quantity: 1 })
    Object.assign(line(2, 3), { prepared_quantity: 1, prepared: true })
    renderApp('/pedidos')
    const list = await orderList(2)
    expect(await within(list).findByText('1 lista')).toBeInTheDocument()
    expect(within(list).getByText('Listo')).toBeInTheDocument()
  })

  it('cada rol solo puede marcar lo suyo y no más unidades de las pedidas', async () => {
    localStorage.setItem('restoapi.token', 'mock-token-3')
    const itemId = line(2, 6).id
    await expect(mockServer.updateOrderItem(2, itemId, { served: true })).rejects.toThrow('permiso')
    await expect(mockServer.updateOrderItem(2, itemId, { served_quantity: 1 })).rejects.toThrow('permiso')
    await expect(mockServer.updateOrderItem(2, itemId, { prepared_quantity: 3 })).rejects.toThrow('2 unidades')
    loginAsWaiter()
    await expect(mockServer.updateOrderItem(2, itemId, { prepared: true })).rejects.toThrow('permiso')
  })

  it('en un pedido pagado se ve lo servido pero no se puede cambiar', async () => {
    loginAsWaiter()
    const order = db.orders.find((o) => o.id === 3)!
    order.status = 'paid'
    Object.assign(order.items[0], { served_quantity: 1, served: true })
    Object.assign(order.items[1], { served_quantity: 1 })
    const { user } = renderApp('/pedidos')
    await screen.findByLabelText('Mostrar')
    await user.selectOptions(screen.getByLabelText('Mostrar'), 'Todos')

    const list = await orderList(3)
    expect(within(list).queryByRole('checkbox')).not.toBeInTheDocument()
    expect(within(list).queryByRole('button')).not.toBeInTheDocument()
    expect(within(list).getByLabelText('servido')).toBeInTheDocument()
    expect(within(list).getByText(/2× Café \(1 servida\)/)).toBeInTheDocument()
    expect(within(list.closest('article')!).getByText('2 de 3 servidos')).toBeInTheDocument()
  })
})
