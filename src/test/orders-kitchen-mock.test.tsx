import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { db } from '../api/mock/db'
import { mockServer } from '../api/mock/server'
import { lineText } from './orderLines'
import { renderApp } from './renderApp'

vi.mock('../config', () => ({ USE_MOCK: true, API_URL: 'http://api.test' }))

const TOKEN = { admin: 'mock-token-1', waiter: 'mock-token-2', kitchen: 'mock-token-3' }

function loginAs(role: keyof typeof TOKEN) {
  localStorage.setItem('restoapi.token', TOKEN[role])
}

async function orderLines(id: number) {
  const list = await screen.findByRole('list', { name: `Platos del pedido ${id}` })
  return within(list)
    .getAllByRole('listitem')
    .map(lineText)
}

describe('Pedidos (sala)', () => {
  it('el camarero crea un pedido con varias líneas y notas', async () => {
    loginAs('waiter')
    const { user } = renderApp('/pedidos')
    expect(await orderLines(2)).toEqual(['2× Paella de marisco', '1× Ensalada de burrata', '2× Agua mineral'])

    await user.click(screen.getByRole('button', { name: '+ Nuevo pedido' }))
    const form = screen.getByRole('form', { name: 'Nuevo pedido' })
    await within(form).findByRole('option', { name: 'Mesa 1 · Interior' })
    await user.selectOptions(within(form).getByLabelText('Mesa'), 'Mesa 1 · Interior')
    await user.click(await within(form).findByRole('button', { name: 'Añadir Croquetas de jamón' }))
    await user.click(within(form).getByRole('button', { name: 'Añadir otro de Croquetas de jamón' }))
    await user.click(within(form).getByRole('button', { name: 'Añadir Café' }))
    await user.type(within(form).getByLabelText('Notas de Croquetas de jamón'), 'Sin sal')

    expect(within(form).getByLabelText('Cantidad de Croquetas de jamón')).toHaveTextContent('2')
    expect(within(form).getByTestId('order-total')).toHaveTextContent('18,80')

    await user.click(within(form).getByRole('button', { name: 'Enviar a cocina' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Pedido #4 enviado a cocina (mesa 1')
    expect(await orderLines(4)).toEqual(['2× Croquetas de jamón', '1× Café'])
    const order = db.orders.find((o) => o.id === 4)!
    expect(order.total).toBe('18.80')
    expect(order.items[0]).toMatchObject({ dish_id: 1, quantity: 2, unit_price: '8.50', notes: 'Sin sal' })
  })

  it('no deja enviar un pedido sin platos y permite quitar líneas', async () => {
    loginAs('waiter')
    const { user } = renderApp('/pedidos')
    await user.click(await screen.findByRole('button', { name: '+ Nuevo pedido' }))
    const form = screen.getByRole('form', { name: 'Nuevo pedido' })
    await user.selectOptions(
      await within(form).findByLabelText('Mesa'),
      await within(form).findByRole('option', { name: 'Mesa 4 · Interior' }),
    )
    expect(within(form).getByRole('button', { name: 'Enviar a cocina' })).toBeDisabled()

    await user.click(await within(form).findByRole('button', { name: 'Añadir Café' }))
    expect(within(form).getByRole('button', { name: 'Enviar a cocina' })).toBeEnabled()
    await user.click(within(form).getByRole('button', { name: 'Quitar uno de Café' }))
    expect(within(form).getByText('Añade platos desde la carta.')).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Enviar a cocina' })).toBeDisabled()
  })

  it('pulsar en la carta un plato que ya está en la comanda no lo añade: lleva a su línea', async () => {
    loginAs('waiter')
    const { user } = renderApp('/pedidos')
    await user.click(await screen.findByRole('button', { name: '+ Nuevo pedido' }))
    const form = screen.getByRole('form', { name: 'Nuevo pedido' })
    await user.click(await within(form).findByRole('button', { name: 'Añadir Café' }))
    await user.click(within(form).getByRole('button', { name: 'Añadir Café' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(within(form).getByLabelText('Cantidad de Café')).toHaveTextContent('1')
    expect(within(form).getByText('Café ya está en la comanda: cambia la cantidad con + y −.')).toHaveAttribute('role', 'status')
    const plus = within(form).getByRole('button', { name: 'Añadir otro de Café' })
    expect(plus).toHaveFocus()
    expect(plus.closest('li')).toHaveClass('draft-highlight')
    expect(within(form).getByRole('button', { name: 'Añadir Café' })).toHaveTextContent('×1')

    await user.click(plus)
    expect(within(form).getByLabelText('Cantidad de Café')).toHaveTextContent('2')
    expect(within(form).queryByText(/ya está en la comanda/)).not.toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Añadir Café' })).toHaveTextContent('×2')
  })

  it('la carta del pedido no ofrece platos agotados ni mesas fuera de servicio', async () => {
    loginAs('waiter')
    const { user } = renderApp('/pedidos')
    await user.click(await screen.findByRole('button', { name: '+ Nuevo pedido' }))
    const form = screen.getByRole('form', { name: 'Nuevo pedido' })
    await within(form).findByRole('button', { name: 'Añadir Croquetas de jamón' })
    expect(within(form).queryByRole('button', { name: 'Añadir Gazpacho' })).not.toBeInTheDocument()
    await within(form).findByRole('option', { name: 'Mesa 7 · Terraza' })
    expect(within(form).queryByRole('option', { name: 'Mesa 8 · Terraza' })).not.toBeInTheDocument()
  })

  it('el camarero solo ve sus acciones: cancelar pendientes y cobrar servidos', async () => {
    loginAs('waiter')
    const { user } = renderApp('/pedidos')
    expect(await screen.findByRole('button', { name: 'Cancelar pedido 2' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Empezar pedido 2' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Marcar servido pedido 1' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Marcar pagado pedido 3' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Pedido #3: facturado y pagado.')
    expect(db.invoices.some((i) => i.order_id === 3)).toBe(true)
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Platos del pedido 3' })).not.toBeInTheDocument())
  })
})

describe('Cocina en tiempo real', () => {
  it('muestra los pedidos por preparar en dos columnas y está "En directo"', async () => {
    loginAs('kitchen')
    renderApp('/cocina')
    expect(await screen.findByText('🟢 En directo')).toBeInTheDocument()
    const pending = screen.getByRole('region', { name: 'Pendientes' })
    const inKitchen = screen.getByRole('region', { name: 'En preparación' })
    const order2 = within(pending).getByRole('article', { name: 'Pedido 2' })
    expect(order2).toHaveTextContent('Sin frutos secos')
    expect(await within(order2).findByText('2× Paella de marisco')).toBeInTheDocument()
    expect(within(inKitchen).getByRole('article', { name: 'Pedido 1' })).toHaveTextContent('Al punto')
    expect(screen.queryByRole('article', { name: 'Pedido 3' })).not.toBeInTheDocument()
  })

  it('cocina empieza un pedido y lo marca como servido', async () => {
    loginAs('kitchen')
    const { user } = renderApp('/cocina')
    await user.click(await screen.findByRole('button', { name: 'Empezar pedido 2' }))
    const inKitchen = screen.getByRole('region', { name: 'En preparación' })
    expect(await within(inKitchen).findByRole('article', { name: 'Pedido 2' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Marcar servido pedido 1' }))
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Pedido 1' })).not.toBeInTheDocument())
    expect(db.orders.find((o) => o.id === 1)!.status).toBe('served')
  })

  it('un pedido nuevo de sala aparece al momento, marcado como "Nuevo"', async () => {
    loginAs('kitchen')
    const { user } = renderApp('/cocina')
    await screen.findByText('🟢 En directo')
    await user.click(screen.getByRole('button', { name: 'Simular pedido de sala' }))

    const pending = screen.getByRole('region', { name: 'Pendientes' })
    const created = await within(pending).findByRole('article', { name: 'Pedido 4' })
    expect(within(created).getByText('Nuevo')).toBeInTheDocument()

    await user.click(within(created).getByRole('button', { name: 'Empezar pedido 4' }))
    const inKitchen = screen.getByRole('region', { name: 'En preparación' })
    const started = await within(inKitchen).findByRole('article', { name: 'Pedido 4' })
    expect(within(started).queryByText('Nuevo')).not.toBeInTheDocument()
  })

  it('cocina identifica la mesa por su id (no tiene acceso a /tables)', async () => {
    loginAs('kitchen')
    renderApp('/cocina')
    expect(await screen.findByRole('article', { name: 'Pedido 2' })).toHaveTextContent('Mesa (id 6)')
  })

  it('admin ve el número de mesa en cocina', async () => {
    loginAs('admin')
    renderApp('/cocina')
    const order2 = await screen.findByRole('article', { name: 'Pedido 2' })
    await waitFor(() => expect(order2).toHaveTextContent('Mesa 6'))
  })

  it('el camarero no puede entrar en cocina', async () => {
    loginAs('waiter')
    renderApp('/cocina')
    expect(await screen.findByRole('heading', { name: '403 · Sin acceso' })).toBeInTheDocument()
  })
})

describe('reglas de pedidos del servidor simulado (como la API, HU-07 / HU-08)', () => {
  it('rechaza un pedido con un plato no disponible', async () => {
    loginAs('waiter')
    await expect(
      mockServer.createOrder({ table_id: 1, items: [{ dish_id: 1, quantity: 1 }, { dish_id: 5, quantity: 1 }] }),
    ).rejects.toThrow('"Gazpacho" no está disponible')
  })

  it('calcula el total y congela el precio de cada línea', async () => {
    loginAs('waiter')
    const order = await mockServer.createOrder({
      table_id: 1,
      items: [
        { dish_id: 7, quantity: 2 },
        { dish_id: 15, quantity: 3 },
      ],
    })
    expect(order.total).toBe('54.50')
    db.dishes.find((d) => d.id === 7)!.price = '30.00'
    expect(db.orders.find((o) => o.id === order.id)!.items[0].unit_price).toBe('22.00')
  })

  it('no permite saltarse estados y cocina no puede crear pedidos', async () => {
    loginAs('kitchen')
    await expect(mockServer.updateOrderStatus(2, 'served')).rejects.toThrow('No se puede pasar')
    await expect(mockServer.updateOrderStatus(3, 'in_kitchen')).rejects.toThrow('No se puede pasar')
    await expect(mockServer.createOrder({ table_id: 1, items: [{ dish_id: 1, quantity: 1 }] })).rejects.toThrow(
      'No tienes permiso',
    )
  })
})
