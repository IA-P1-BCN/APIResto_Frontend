import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { db } from '../api/mock/db'
import { mockServer } from '../api/mock/server'
import { lineText } from './orderLines'
import { renderApp } from './renderApp'

vi.mock('../config', () => ({ USE_MOCK: true, API_URL: 'http://api.test' }))

const TOKEN = { admin: 'mock-token-1', waiter: 'mock-token-2', kitchen: 'mock-token-3', bartender: 'mock-token-5' }

function loginAs(role: keyof typeof TOKEN) {
  localStorage.setItem('restoapi.token', TOKEN[role])
}

async function orderLines(id: number) {
  const list = await screen.findByRole('list', { name: `Platos del pedido ${id}` })
  return within(list)
    .getAllByRole('listitem')
    .map(lineText)
}

describe('Barra en tiempo real (HU-41)', () => {
  it('barra solo ve las bebidas y los postres de cada pedido', async () => {
    loginAs('bartender')
    renderApp('/barra')
    expect(await screen.findByRole('heading', { level: 1, name: 'Barra' })).toBeInTheDocument()
    expect(await screen.findByText('🟢 En directo')).toBeInTheDocument()
    expect(await orderLines(1)).toEqual(['2× Vino tinto de la casa'])
    expect(await orderLines(2)).toEqual(['2× Agua mineral'])
    expect(screen.queryByRole('article', { name: 'Pedido 3' })).not.toBeInTheDocument()
  })

  it('cocina ya no ve las bebidas ni los postres', async () => {
    loginAs('kitchen')
    renderApp('/cocina')
    await waitFor(async () =>
      expect(await orderLines(2)).toEqual(['2× Paella de marisco', '1× Ensalada de burrata⚠ Sin frutos secos']),
    )
    expect(await orderLines(1)).toEqual(['1× Entrecot a la brasa⚠ Al punto', '1× Patatas bravas'])
  })

  it('barra marca sus platos como preparados', async () => {
    loginAs('bartender')
    const { user } = renderApp('/barra')
    const order2 = await screen.findByRole('article', { name: 'Pedido 2' })
    const more = await within(order2).findByRole('button', { name: 'Una preparada más de Agua mineral' })
    await user.click(more)
    await waitFor(() => expect(within(order2).getByText('1 de 2 preparados')).toBeInTheDocument())
    await user.click(more)
    await waitFor(() => expect(within(order2).getByText('2 de 2 preparados')).toBeInTheDocument())
    expect(db.orders.find((o) => o.id === 2)!.items[2]).toMatchObject({ prepared_quantity: 2, prepared: true })
  })

  it('en un pedido con platos de cocina, el estado lo lleva cocina', async () => {
    loginAs('bartender')
    renderApp('/barra')
    const order2 = await screen.findByRole('article', { name: 'Pedido 2' })
    expect(within(order2).getByText('Cocina lleva el estado del pedido')).toBeInTheDocument()
    expect(within(order2).queryByRole('button', { name: 'Empezar pedido 2' })).not.toBeInTheDocument()
  })

  it('barra empieza y sirve un pedido que solo tiene bebidas', async () => {
    loginAs('waiter')
    const { id } = await mockServer.createOrder({ table_id: 1, items: [{ dish_id: 16, quantity: 2 }] })

    loginAs('bartender')
    const { user } = renderApp('/barra')
    await user.click(await screen.findByRole('button', { name: `Empezar pedido ${id}` }))
    const inKitchen = screen.getByRole('region', { name: 'En preparación' })
    expect(await within(inKitchen).findByRole('article', { name: `Pedido ${id}` })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: `Marcar servido pedido ${id}` }))
    await waitFor(() => expect(screen.queryByRole('article', { name: `Pedido ${id}` })).not.toBeInTheDocument())
    expect(db.orders.find((o) => o.id === id)!.status).toBe('served')
  })

  it('un pedido que solo tiene bebidas no aparece en cocina', async () => {
    loginAs('waiter')
    const { id } = await mockServer.createOrder({ table_id: 1, items: [{ dish_id: 16, quantity: 2 }] })

    loginAs('kitchen')
    renderApp('/cocina')
    await screen.findByRole('article', { name: 'Pedido 2' })
    expect(screen.queryByRole('article', { name: `Pedido ${id}` })).not.toBeInTheDocument()
  })

  it('un pedido simulado desde barra llega con bebidas o postres', async () => {
    loginAs('bartender')
    const { user } = renderApp('/barra')
    await screen.findByText('🟢 En directo')
    await user.click(screen.getByRole('button', { name: 'Simular pedido de sala' }))
    const pending = screen.getByRole('region', { name: 'Pendientes' })
    const created = await within(pending).findByRole('article', { name: 'Pedido 4' })
    expect(within(created).getByText('Nuevo')).toBeInTheDocument()
  })

  it('barra no puede marcar platos como servidos', async () => {
    loginAs('bartender')
    await expect(mockServer.updateOrderItem(1, 3, { served: true })).rejects.toThrow('No tienes permiso')
  })

  it('el admin decide si una categoría se prepara en cocina o en barra', async () => {
    loginAs('admin')
    const { user } = renderApp('/carta')
    await user.click(await screen.findByRole('button', { name: 'Gestionar categorías' }))
    const section = await screen.findByRole('region', { name: 'Categorías' })
    expect(within(section).getByText(/orden 4 · Barra/)).toBeInTheDocument()

    await user.click(within(section).getByRole('button', { name: 'Editar categoría Entrantes' }))
    await user.selectOptions(within(section).getByLabelText('Se prepara en'), 'Barra')
    await user.click(within(section).getByRole('button', { name: 'Guardar categoría' }))
    await waitFor(() => expect(db.categories.find((c) => c.name === 'Entrantes')!.station).toBe('bar'))
  })

  it('cocina no puede entrar en barra', async () => {
    loginAs('kitchen')
    renderApp('/barra')
    expect(await screen.findByRole('heading', { name: '403 · Sin acceso' })).toBeInTheDocument()
  })
})
