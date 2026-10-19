import { describe, expect, it, vi } from 'vitest'
import { listAllDishes, listCategories, listDishes } from '../api/menu'
import { createOrder, listOrders, updateOrderStatus } from '../api/orders'
import { cancelReservation, createReservation, listReservations } from '../api/reservations'
import { listAvailableTables, listTables, updateTableStatus } from '../api/tables'
import { getErrorMessage } from '../api/errors'
import { mockApi } from './fakeApi'

vi.mock('../config', () => ({ USE_MOCK: false, API_URL: 'http://api.test' }))

const page = (items: unknown[] = [], total = items.length) => ({ items, total, page: 1, size: 12 })

describe('carta', () => {
  it('GET /categories/ devuelve las categorías en el orden de la carta', async () => {
    const requests = mockApi(() => ({
      status: 200,
      data: [
        { id: 2, name: 'Postres', sort_order: 3 },
        { id: 1, name: 'Entrantes', sort_order: 1 },
      ],
    }))
    const categories = await listCategories()
    expect(requests[0].url).toBe('/categories/')
    expect(categories.map((c) => c.name)).toEqual(['Entrantes', 'Postres'])
  })

  it('GET /dishes/ con filtros y paginación', async () => {
    const requests = mockApi(() => ({ status: 200, data: page() }))
    await listDishes({ category_id: 2, is_available: true, max_price: 15, page: 3 })
    expect(requests[0].url).toBe('/dishes/')
    expect(requests[0].params).toEqual({ category_id: 2, is_available: true, max_price: 15, page: 3, size: 12 })
  })

  it('GET /dishes/ sin filtros no envía parámetros vacíos', async () => {
    const requests = mockApi(() => ({ status: 200, data: page() }))
    await listDishes()
    expect(requests[0].params).toEqual({
      category_id: undefined,
      is_available: undefined,
      max_price: undefined,
      page: 1,
      size: 12,
    })
  })

  it('listAllDishes recorre todas las páginas', async () => {
    const requests = mockApi((config) => ({
      status: 200,
      data: page(config.params.page === 1 ? Array.from({ length: 100 }, (_, i) => ({ id: i + 1 })) : [{ id: 101 }], 101),
    }))
    const dishes = await listAllDishes()
    expect(dishes).toHaveLength(101)
    expect(requests.map((r) => r.params.page)).toEqual([1, 2])
    expect(requests[0].params.size).toBe(100)
  })
})

describe('mesas', () => {
  it('GET /tables recorre las páginas', async () => {
    const requests = mockApi((config) => ({
      status: 200,
      data: page(config.params.page === 1 ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }], 3),
    }))
    expect(await listTables()).toHaveLength(3)
    expect(requests.map((r) => [r.url, r.params.page])).toEqual([
      ['/tables', 1],
      ['/tables', 2],
    ])
  })

  it('PATCH /tables/{id}/status con el nuevo estado', async () => {
    const requests = mockApi(() => ({ status: 200, data: {} }))
    await updateTableStatus(4, 'occupied')
    expect(requests[0].method).toBe('patch')
    expect(requests[0].url).toBe('/tables/4/status')
    expect(JSON.parse(requests[0].data)).toEqual({ status: 'occupied' })
  })

  it('GET /tables/available con reserved_at y party_size', async () => {
    const requests = mockApi(() => ({ status: 200, data: page([{ id: 3 }]) }))
    expect(await listAvailableTables('2026-10-08T21:00:00', 4)).toEqual([{ id: 3 }])
    expect(requests[0].url).toBe('/tables/available')
    expect(requests[0].params).toEqual({ reserved_at: '2026-10-08T21:00:00', party_size: 4, size: 100 })
  })
})

describe('reservas', () => {
  it('GET /reservations por día', async () => {
    const requests = mockApi(() => ({ status: 200, data: page() }))
    await listReservations({ date: '2026-10-08' })
    expect(requests[0].url).toBe('/reservations')
    expect(requests[0].params).toEqual({ date: '2026-10-08', size: 100 })
  })

  it('POST /reservations y el 409 de solapamiento llega con su detalle', async () => {
    const requests = mockApi(() => ({ status: 409, data: { detail: 'La mesa ya está reservada', code: 'conflict' } }))
    const reservation = { table_id: 3, reserved_at: '2026-10-08T21:00:00', party_size: 2, notes: 'Aniversario' }
    const error = await createReservation(reservation).catch((e: unknown) => e)
    expect(getErrorMessage(error)).toBe('La mesa ya está reservada')
    expect(requests[0].method).toBe('post')
    expect(requests[0].url).toBe('/reservations')
    expect(JSON.parse(requests[0].data)).toEqual(reservation)
  })

  it('PATCH /reservations/{id}/cancel', async () => {
    const requests = mockApi(() => ({ status: 200, data: {} }))
    await cancelReservation(12)
    expect(requests[0].method).toBe('patch')
    expect(requests[0].url).toBe('/reservations/12/cancel')
  })
})

describe('pedidos', () => {
  it('GET /orders/ hace una petición por estado y junta los resultados por hora', async () => {
    const requests = mockApi((config) => ({
      status: 200,
      data:
        config.params.status === 'pending'
          ? [{ id: 2, created_at: '2026-10-08T12:10:00' }]
          : [{ id: 1, created_at: '2026-10-08T12:00:00' }],
    }))
    const orders = await listOrders({ statuses: ['pending', 'in_kitchen'] })
    expect(requests.map((r) => [r.url, r.params.status])).toEqual([
      ['/orders/', 'pending'],
      ['/orders/', 'in_kitchen'],
    ])
    expect(orders.map((o) => o.id)).toEqual([1, 2])
  })

  it('POST /orders/ con la mesa y las líneas', async () => {
    const requests = mockApi(() => ({ status: 201, data: {} }))
    const order = { table_id: 4, items: [{ dish_id: 1, quantity: 2, notes: 'Sin sal' }] }
    await createOrder(order)
    expect(requests[0].method).toBe('post')
    expect(requests[0].url).toBe('/orders/')
    expect(JSON.parse(requests[0].data)).toEqual(order)
  })

  it('PATCH /orders/{id}/status y el 409 de transición no válida', async () => {
    const requests = mockApi(() => ({
      status: 409,
      data: { detail: "Cannot change status from 'pending' to 'served'" },
    }))
    const error = await updateOrderStatus(5, 'served').catch((e: unknown) => e)
    expect(getErrorMessage(error)).toBe("Cannot change status from 'pending' to 'served'")
    expect(requests[0].url).toBe('/orders/5/status')
    expect(JSON.parse(requests[0].data)).toEqual({ status: 'served' })
  })

  it('cobrar factura primero (POST /orders/{id}/invoice) y luego marca pagado', async () => {
    const requests = mockApi((config) =>
      config.url === '/orders/5/invoice'
        ? { status: 201, data: { id: 1, number: 'F-2026-00001', order_id: 5 } }
        : { status: 200, data: { id: 5, status: 'paid' } },
    )
    expect(await updateOrderStatus(5, 'paid')).toMatchObject({ status: 'paid' })
    expect(requests.map((r) => `${r.method} ${r.url}`)).toEqual(['post /orders/5/invoice', 'patch /orders/5/status'])
  })

  it('cobrar un pedido ya facturado ignora el 409 invoice_already_exists', async () => {
    const requests = mockApi((config) =>
      config.url === '/orders/5/invoice'
        ? { status: 409, data: { detail: 'Order 5 already has invoice F-2026-00001', code: 'invoice_already_exists' } }
        : { status: 200, data: { id: 5, status: 'paid' } },
    )
    expect(await updateOrderStatus(5, 'paid')).toMatchObject({ status: 'paid' })
    expect(requests[1].url).toBe('/orders/5/status')
  })

  it('si la factura falla por otro motivo, no se marca pagado', async () => {
    const requests = mockApi(() => ({
      status: 409,
      data: { detail: 'Only served orders can be invoiced (current status: pending)', code: 'order_not_served' },
    }))
    const error = await updateOrderStatus(5, 'paid').catch((e: unknown) => e)
    expect(getErrorMessage(error)).toContain('Only served orders')
    expect(requests).toHaveLength(1)
  })
})
