import { USE_MOCK } from '../config'
import { api } from './client'
import { getErrorCode } from './errors'
import { createInvoice } from './invoices'
import { mockServer, type OrderFilters } from './mock/server'
import type { Order, OrderCreate, OrderItemMarks, OrderStatus } from './types'

export type { OrderFilters }

export async function listOrders(filters: OrderFilters = {}): Promise<Order[]> {
  if (USE_MOCK) return mockServer.listOrders(filters)
  const fetchByStatus = async (status?: OrderStatus) => {
    const { data } = await api.get<Order[]>('/orders/', { params: { status, table_id: filters.table_id } })
    return data
  }
  const lists = filters.statuses ? await Promise.all(filters.statuses.map(fetchByStatus)) : [await fetchByStatus()]
  return lists.flat().sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id)
}

export async function createOrder(order: OrderCreate): Promise<Order> {
  if (USE_MOCK) return mockServer.createOrder(order)
  const { data } = await api.post<Order>('/orders/', order)
  return data
}

async function ensureInvoice(orderId: number): Promise<void> {
  try {
    await createInvoice(orderId)
  } catch (error) {
    if (getErrorCode(error) !== 'invoice_already_exists') throw error
  }
}

export async function updateOrderStatus(id: number, status: OrderStatus): Promise<Order> {
  if (status === 'paid') await ensureInvoice(id)
  if (USE_MOCK) return mockServer.updateOrderStatus(id, status)
  const { data } = await api.patch<Order>(`/orders/${id}/status`, { status })
  return data
}

export async function updateOrderItem(orderId: number, itemId: number, marks: OrderItemMarks): Promise<Order> {
  if (USE_MOCK) return mockServer.updateOrderItem(orderId, itemId, marks)
  const { data } = await api.patch<Order>(`/orders/${orderId}/items/${itemId}`, marks)
  return data
}
