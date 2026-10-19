import { toServerTimestamp } from '../../utils/format'
import { mockUserFromToken } from '../mockAuth'
import { VALID_TRANSITIONS } from '../orderRules'
import {
  CUSTOMER_PARTY_TOO_LARGE,
  MAX_CUSTOMER_PARTY_SIZE,
  noTableAvailable,
  RESERVATION_IN_PAST,
} from '../reservationRules'
import { DEFAULT_STATION } from '../stations'
import { tokenStorage } from '../tokenStorage'
import type {
  Category,
  DiningTable,
  Dish,
  Invoice,
  Order,
  OrderCreate,
  OrderItem,
  OrderItemMarks,
  OrderStatus,
  Page,
  Reservation,
  ReservationCreate,
  ReservationUpdate,
  Role,
  Station,
  SalesSummary,
  TableStatus,
  TopDish,
} from '../types'
import { db, DEFAULT_DURATION_MIN, endsAt, saveDemoDb } from './db'
import { mockEvents } from './events'

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms))

const nextId = (items: { id: number }[]) => Math.max(0, ...items.map((i) => i.id)) + 1

function paginate<T>(items: T[], page: number, size: number): Page<T> {
  const start = (page - 1) * size
  return { items: items.slice(start, start + size), total: items.length, page, size }
}

function currentUser(...roles: Role[]) {
  const user = mockUserFromToken(tokenStorage.get())
  if (!user) throw new Error('Sesión no válida')
  if (roles.length > 0 && !roles.includes(user.role)) throw new Error('No tienes permiso para esta acción')
  return user
}

const isStaff = (role: Role) => role === 'admin' || role === 'waiter'

function overlaps(startA: string, minutesA: number, startB: string, minutesB: number): boolean {
  const a = new Date(startA).getTime()
  const b = new Date(startB).getTime()
  return a < b + minutesB * 60_000 && b < a + minutesA * 60_000
}

function isTableFree(tableId: number, reservedAt: string, durationMin: number, excludeId?: number): boolean {
  return !db.reservations.some(
    (r) =>
      r.id !== excludeId &&
      r.table_id === tableId &&
      r.status === 'confirmed' &&
      overlaps(r.reserved_at, r.duration_min, reservedAt, durationMin),
  )
}

function freeTables(reservedAt: string, partySize: number, durationMin: number): DiningTable[] {
  return db.tables
    .filter(
      (t) => t.status !== 'out_of_service' && t.capacity >= partySize && isTableFree(t.id, reservedAt, durationMin),
    )
    .sort((a, b) => a.capacity - b.capacity || a.id - b.id)
}

export interface DishFilters {
  category_id?: number
  is_available?: boolean
  max_price?: number
  page?: number
  size?: number
}

export interface ReservationFilters {
  date?: string
}

export interface OrderFilters {
  statuses?: OrderStatus[]
  table_id?: number
}

export interface InvoiceFilters {
  date_from?: string
  date_to?: string
  page?: number
  size?: number
}

const TAX_RATE = 0.1

function invoicesInRange({ date_from, date_to }: InvoiceFilters): Invoice[] {
  const inRange = (day: string) => (!date_from || day >= date_from) && (!date_to || day <= date_to)
  return db.invoices.filter((i) => inRange(i.issued_at.slice(0, 10))).sort((a, b) => a.number.localeCompare(b.number))
}

function checkDateRange({ date_from, date_to }: InvoiceFilters) {
  if (date_from && date_to && date_from > date_to) throw new Error('La fecha "desde" debe ser anterior a la fecha "hasta"')
}

export interface StatsFilters {
  from?: string
  to?: string
}

const SALE_STATUSES: OrderStatus[] = ['served', 'paid']
const cents = (amount: number | string) => Math.round(Number(amount) * 100)
const euros = (amountInCents: number) => (amountInCents / 100).toFixed(2)

function sales({ from, to }: StatsFilters): Order[] {
  if (from && to && from > to) throw new Error('La fecha "desde" debe ser anterior a la fecha "hasta"')
  return db.orders.filter((o) => {
    const day = o.created_at.slice(0, 10)
    return SALE_STATUSES.includes(o.status) && (!from || day >= from) && (!to || day <= to)
  })
}

function insertOrder(data: OrderCreate, waiterId: number): Order {
  const table = db.tables.find((t) => t.id === data.table_id)
  if (!table) throw new Error('Mesa no encontrada')
  if (data.items.length === 0) throw new Error('El pedido no tiene platos')
  const items: OrderItem[] = data.items.map((i) => {
    const dish = db.dishes.find((d) => d.id === i.dish_id)
    if (!dish || !dish.is_available) throw new Error(`"${dish?.name ?? `Plato ${i.dish_id}`}" no está disponible`)
    if (i.quantity < 1) throw new Error('La cantidad debe ser al menos 1')
    return {
      id: db.nextOrderItemId++,
      dish_id: dish.id,
      quantity: i.quantity,
      unit_price: dish.price,
      notes: i.notes?.trim() || null,
      prepared_quantity: 0,
      served_quantity: 0,
      prepared: false,
      served: false,
    }
  })
  const order: Order = {
    id: db.nextOrderId++,
    table_id: table.id,
    waiter_id: waiterId,
    status: 'pending',
    total: items.reduce((t, i) => t + i.quantity * Number(i.unit_price), 0).toFixed(2),
    created_at: toServerTimestamp(new Date()),
    updated_at: null,
    items,
  }
  db.orders.push(order)
  mockEvents.emit({
    event: 'order_created',
    order: {
      id: order.id,
      table_id: order.table_id,
      waiter_id: order.waiter_id,
      status: order.status,
      total: order.total,
    },
  })
  return structuredClone(order)
}

const server = {
  async listCategories(): Promise<Category[]> {
    await delay()
    currentUser()
    return [...db.categories].sort((a, b) => a.sort_order - b.sort_order)
  },

  async listDishes({ category_id, is_available, max_price, page = 1, size = 12 }: DishFilters): Promise<Page<Dish>> {
    await delay()
    currentUser()
    const items = db.dishes.filter(
      (d) =>
        (category_id === undefined || d.category_id === category_id) &&
        (is_available === undefined || d.is_available === is_available) &&
        (max_price === undefined || Number(d.price) <= max_price),
    )
    return paginate(structuredClone(items), page, size)
  },

  async createCategory(data: Omit<Category, 'id'>): Promise<Category> {
    await delay()
    currentUser('admin')
    if (db.categories.some((c) => c.name === data.name)) throw new Error('Ya existe una categoría con ese nombre')
    const category: Category = { id: nextId(db.categories), ...data }
    db.categories.push(category)
    return { ...category }
  },

  async updateCategory(id: number, data: Partial<Omit<Category, 'id'>>): Promise<Category> {
    await delay()
    currentUser('admin')
    const category = db.categories.find((c) => c.id === id)
    if (!category) throw new Error('Categoría no encontrada')
    if (data.name && data.name !== category.name && db.categories.some((c) => c.name === data.name)) {
      throw new Error('Ya existe una categoría con ese nombre')
    }
    Object.assign(category, data)
    return { ...category }
  },

  async deleteCategory(id: number): Promise<void> {
    await delay()
    currentUser('admin')
    if (!db.categories.some((c) => c.id === id)) throw new Error('Categoría no encontrada')
    if (db.dishes.some((d) => d.category_id === id)) {
      throw new Error('La categoría tiene platos y no se puede borrar')
    }
    db.categories = db.categories.filter((c) => c.id !== id)
  },

  async createDish(data: Omit<Dish, 'id'>): Promise<Dish> {
    await delay()
    currentUser('admin')
    if (!db.categories.some((c) => c.id === data.category_id)) throw new Error('Categoría no encontrada')
    const dish: Dish = { id: nextId(db.dishes), ...data }
    db.dishes.push(dish)
    return { ...dish }
  },

  async updateDish(id: number, data: Partial<Omit<Dish, 'id'>>): Promise<Dish> {
    await delay()
    currentUser('admin')
    const dish = db.dishes.find((d) => d.id === id)
    if (!dish) throw new Error('Plato no encontrado')
    if (data.category_id !== undefined && !db.categories.some((c) => c.id === data.category_id)) {
      throw new Error('Categoría no encontrada')
    }
    Object.assign(dish, data)
    return { ...dish }
  },

  async deleteDish(id: number): Promise<void> {
    await delay()
    currentUser('admin')
    if (!db.dishes.some((d) => d.id === id)) throw new Error('Plato no encontrado')
    if (db.orders.some((o) => o.items.some((i) => i.dish_id === id))) {
      throw new Error('El plato está en algún pedido: márcalo como no disponible en lugar de borrarlo')
    }
    db.dishes = db.dishes.filter((d) => d.id !== id)
  },

  async listTables(): Promise<Page<DiningTable>> {
    await delay()
    currentUser('admin', 'waiter')
    return paginate(structuredClone(db.tables), 1, 100)
  },

  async updateTableStatus(id: number, status: TableStatus): Promise<DiningTable> {
    await delay()
    currentUser('admin', 'waiter')
    const table = db.tables.find((t) => t.id === id)
    if (!table) throw new Error('Mesa no encontrada')
    table.status = status
    return { ...table }
  },

  async createTable(data: Omit<DiningTable, 'id'>): Promise<DiningTable> {
    await delay()
    currentUser('admin')
    if (db.tables.some((t) => t.number === data.number)) throw new Error(`Ya existe la mesa ${data.number}`)
    const table: DiningTable = { id: nextId(db.tables), ...data }
    db.tables.push(table)
    return { ...table }
  },

  async updateTable(id: number, data: Omit<DiningTable, 'id'>): Promise<DiningTable> {
    await delay()
    currentUser('admin')
    const table = db.tables.find((t) => t.id === id)
    if (!table) throw new Error('Mesa no encontrada')
    if (db.tables.some((t) => t.id !== id && t.number === data.number)) {
      throw new Error(`Ya existe la mesa ${data.number}`)
    }
    Object.assign(table, data)
    return { ...table }
  },

  async deleteTable(id: number): Promise<void> {
    await delay()
    currentUser('admin')
    if (!db.tables.some((t) => t.id === id)) throw new Error('Mesa no encontrada')
    if (db.orders.some((o) => o.table_id === id) || db.reservations.some((r) => r.table_id === id)) {
      throw new Error('La mesa tiene pedidos o reservas: márcala como fuera de servicio en lugar de borrarla')
    }
    db.tables = db.tables.filter((t) => t.id !== id)
  },

  async listAvailableTables(reservedAt: string, partySize: number): Promise<Page<DiningTable>> {
    await delay()
    currentUser('admin', 'waiter')
    return paginate(structuredClone(freeTables(reservedAt, partySize, DEFAULT_DURATION_MIN)), 1, 100)
  },

  async listReservations({ date }: ReservationFilters): Promise<Page<Reservation>> {
    await delay()
    const user = currentUser('admin', 'waiter', 'customer')
    const items = db.reservations
      .filter((r) => isStaff(user.role) || r.user_id === user.id)
      .filter((r) => !date || r.reserved_at.startsWith(date))
      .sort((a, b) => a.reserved_at.localeCompare(b.reserved_at))
    return paginate(structuredClone(items), 1, 100)
  },

  async createReservation(data: ReservationCreate): Promise<Reservation> {
    await delay()
    const user = currentUser('admin', 'waiter', 'customer')
    const duration = data.duration_min ?? DEFAULT_DURATION_MIN
    if (user.role === 'customer' && data.party_size > MAX_CUSTOMER_PARTY_SIZE) {
      throw new Error(CUSTOMER_PARTY_TOO_LARGE)
    }
    if (data.table_id === undefined && new Date(data.reserved_at) < new Date()) {
      throw new Error(RESERVATION_IN_PAST)
    }
    const table =
      data.table_id === undefined
        ? freeTables(data.reserved_at, data.party_size, duration)[0]
        : db.tables.find((t) => t.id === data.table_id)
    if (!table) {
      throw new Error(data.table_id === undefined ? noTableAvailable(data.party_size, data.reserved_at) : 'Mesa no encontrada')
    }
    if (data.party_size > table.capacity) {
      throw new Error(`La mesa ${table.number} es para ${table.capacity} personas como máximo`)
    }
    if (!isTableFree(table.id, data.reserved_at, duration)) {
      throw new Error(`La mesa ${table.number} ya tiene una reserva en ese horario`)
    }
    const reservation: Reservation = {
      id: db.nextReservationId++,
      user_id: user.id,
      table_id: table.id,
      reserved_at: data.reserved_at,
      duration_min: duration,
      ends_at: endsAt(data.reserved_at, duration),
      party_size: data.party_size,
      status: 'confirmed',
      notes: data.notes?.trim() || null,
      created_at: toServerTimestamp(new Date()),
    }
    db.reservations.push(reservation)
    return structuredClone(reservation)
  },

  async cancelReservation(id: number): Promise<Reservation> {
    await delay()
    const user = currentUser('admin', 'waiter', 'customer')
    const reservation = db.reservations.find((r) => r.id === id)
    if (!reservation) throw new Error('Reserva no encontrada')
    if (!isStaff(user.role) && reservation.user_id !== user.id) throw new Error('Solo puedes cancelar tus reservas')
    if (reservation.status !== 'confirmed') throw new Error('Solo se pueden cancelar reservas confirmadas')
    reservation.status = 'cancelled'
    return structuredClone(reservation)
  },

  async updateReservation(id: number, changes: ReservationUpdate): Promise<Reservation> {
    await delay()
    const user = currentUser('admin', 'waiter', 'customer')
    const reservation = db.reservations.find((r) => r.id === id)
    if (!reservation) throw new Error('Reserva no encontrada')
    if (!isStaff(user.role) && reservation.user_id !== user.id) throw new Error('Solo puedes editar tus reservas')
    if (changes.status !== undefined && !isStaff(user.role)) {
      throw new Error('Solo admin y waiter pueden cambiar el estado de una reserva')
    }
    const next = { ...reservation, ...changes }
    const table = db.tables.find((t) => t.id === next.table_id)
    if (!table) throw new Error('Mesa no encontrada')
    if (next.party_size > table.capacity) {
      throw new Error(`La mesa ${table.number} es para ${table.capacity} personas como máximo`)
    }
    const moved = changes.table_id !== undefined || changes.reserved_at !== undefined
    if (moved && next.status !== 'cancelled' && !isTableFree(table.id, next.reserved_at, next.duration_min, id)) {
      throw new Error(`La mesa ${table.number} ya tiene una reserva en ese horario`)
    }
    Object.assign(reservation, next, { ends_at: endsAt(next.reserved_at, next.duration_min) })
    return structuredClone(reservation)
  },

  async deleteReservation(id: number): Promise<void> {
    await delay()
    const user = currentUser('admin', 'waiter', 'customer')
    const reservation = db.reservations.find((r) => r.id === id)
    if (!reservation) throw new Error('Reserva no encontrada')
    if (!isStaff(user.role) && reservation.user_id !== user.id) throw new Error('Solo puedes borrar tus reservas')
    db.reservations = db.reservations.filter((r) => r.id !== id)
  },

  async listOrders({ statuses, table_id }: OrderFilters = {}): Promise<Order[]> {
    await delay()
    currentUser('admin', 'waiter', 'kitchen', 'bartender')
    const items = db.orders
      .filter((o) => !statuses || statuses.includes(o.status))
      .filter((o) => table_id === undefined || o.table_id === table_id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id)
    return structuredClone(items)
  },

  async createOrder(data: OrderCreate): Promise<Order> {
    await delay()
    const user = currentUser('admin', 'waiter')
    return insertOrder(data, user.id)
  },

  async updateOrderItem(orderId: number, itemId: number, marks: OrderItemMarks): Promise<Order> {
    await delay()
    const user = currentUser('admin', 'waiter', 'kitchen', 'bartender')
    const marksPrepared = marks.prepared !== undefined || marks.prepared_quantity !== undefined
    const marksServed = marks.served !== undefined || marks.served_quantity !== undefined
    if (marksPrepared && user.role === 'waiter') throw new Error('No tienes permiso para esta acción')
    if (marksServed && (user.role === 'kitchen' || user.role === 'bartender')) {
      throw new Error('No tienes permiso para esta acción')
    }
    const order = db.orders.find((o) => o.id === orderId)
    if (!order) throw new Error('Pedido no encontrado')
    const item = order.items.find((i) => i.id === itemId)
    if (!item) throw new Error('Línea de pedido no encontrada')
    if (order.status === 'paid' || order.status === 'cancelled') {
      throw new Error('No se pueden cambiar las líneas de un pedido pagado o cancelado')
    }
    for (const field of ['prepared', 'served'] as const) {
      const flag = marks[field]
      const count = marks[`${field}_quantity`] ?? (flag === undefined ? undefined : flag ? item.quantity : 0)
      if (count === undefined) continue
      if (count < 0 || count > item.quantity) throw new Error(`Esta línea tiene ${item.quantity} unidades`)
      item[`${field}_quantity`] = count
      item[field] = count === item.quantity
    }
    return structuredClone(order)
  },

  async updateOrderStatus(id: number, status: OrderStatus): Promise<Order> {
    await delay()
    currentUser('admin', 'waiter', 'kitchen', 'bartender')
    const order = db.orders.find((o) => o.id === id)
    if (!order) throw new Error('Pedido no encontrado')
    if (order.status !== status) {
      if (!VALID_TRANSITIONS[order.status].includes(status)) {
        throw new Error(`No se puede pasar un pedido de "${order.status}" a "${status}"`)
      }
      order.status = status
      order.updated_at = toServerTimestamp(new Date())
      mockEvents.emit({
        event: 'order_status_changed',
        order: { id: order.id, table_id: order.table_id, status: order.status, total: order.total },
      })
    }
    return structuredClone(order)
  },

  async listInvoices(filters: InvoiceFilters = {}): Promise<Page<Invoice>> {
    await delay()
    currentUser('admin', 'waiter')
    checkDateRange(filters)
    return paginate(structuredClone(invoicesInRange(filters)), filters.page ?? 1, filters.size ?? 20)
  },

  async createInvoice(orderId: number): Promise<Invoice> {
    await delay()
    currentUser('admin', 'waiter')
    const order = db.orders.find((o) => o.id === orderId)
    if (!order) throw new Error('Pedido no encontrado')
    if (order.status !== 'served') throw new Error('Solo se pueden facturar pedidos servidos')
    const existing = db.invoices.find((i) => i.order_id === orderId)
    if (existing) throw new Error(`El pedido #${orderId} ya tiene la factura ${existing.number}`)
    const issuedAt = toServerTimestamp(new Date())
    const year = issuedAt.slice(0, 4)
    const sequence = db.invoices.filter((i) => i.number.startsWith(`F-${year}-`)).length + 1
    const totalCents = Math.round(Number(order.total) * 100)
    const baseCents = Math.round(totalCents / (1 + TAX_RATE))
    const invoice: Invoice = {
      id: nextId(db.invoices),
      number: `F-${year}-${String(sequence).padStart(5, '0')}`,
      order_id: orderId,
      base_amount: (baseCents / 100).toFixed(2),
      tax_rate: TAX_RATE.toFixed(2),
      tax_amount: ((totalCents - baseCents) / 100).toFixed(2),
      total: (totalCents / 100).toFixed(2),
      issued_at: issuedAt,
    }
    db.invoices.push(invoice)
    return structuredClone(invoice)
  },

  async exportInvoicesCsv(filters: Pick<InvoiceFilters, 'date_from' | 'date_to'> = {}): Promise<string> {
    await delay()
    currentUser('admin')
    checkDateRange(filters)
    const header = 'number,issued_at,order_id,table_id,base_amount,tax_rate,tax_amount,total'
    const rows = invoicesInRange(filters).map((i) => {
      const tableId = db.orders.find((o) => o.id === i.order_id)?.table_id ?? ''
      return [i.number, i.issued_at, i.order_id, tableId, i.base_amount, i.tax_rate, i.tax_amount, i.total].join(',')
    })
    return [header, ...rows].map((line) => `${line}\r\n`).join('')
  },

  async getSales(filters: StatsFilters = {}): Promise<SalesSummary> {
    await delay()
    currentUser('admin')
    const orders = sales(filters)
    const byDay = new Map<string, { orders_count: number; total: number }>()
    for (const o of orders) {
      const day = byDay.get(o.created_at.slice(0, 10)) ?? { orders_count: 0, total: 0 }
      byDay.set(o.created_at.slice(0, 10), { orders_count: day.orders_count + 1, total: day.total + cents(o.total) })
    }
    const total = orders.reduce((sum, o) => sum + cents(o.total), 0)
    return {
      date_from: filters.from ?? null,
      date_to: filters.to ?? null,
      orders_count: orders.length,
      total_sales: euros(total),
      average_ticket: euros(orders.length ? Math.round(total / orders.length) : 0),
      daily: [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, d]) => ({ day, orders_count: d.orders_count, total_sales: euros(d.total) })),
    }
  },

  async getTopDishes(filters: StatsFilters & { limit?: number } = {}): Promise<TopDish[]> {
    await delay()
    currentUser('admin')
    const totals = new Map<number, { quantity: number; revenue: number }>()
    for (const item of sales(filters).flatMap((o) => o.items)) {
      const dish = totals.get(item.dish_id) ?? { quantity: 0, revenue: 0 }
      totals.set(item.dish_id, {
        quantity: dish.quantity + item.quantity,
        revenue: dish.revenue + item.quantity * cents(item.unit_price),
      })
    }
    return [...totals.entries()]
      .map(([dish_id, t]) => ({
        dish_id,
        name: db.dishes.find((d) => d.id === dish_id)?.name ?? `Plato ${dish_id}`,
        quantity: t.quantity,
        revenue: euros(t.revenue),
      }))
      .sort((a, b) => b.quantity - a.quantity || cents(b.revenue) - cents(a.revenue) || a.dish_id - b.dish_id)
      .slice(0, filters.limit ?? 5)
  },

  async simulateWaiterOrder(station?: Station): Promise<Order> {
    await delay(100)
    const stationOf = (categoryId: number) => db.categories.find((c) => c.id === categoryId)?.station ?? DEFAULT_STATION
    const available = db.dishes.filter((d) => d.is_available && (!station || stationOf(d.category_id) === station))
    const tables = db.tables.filter((t) => t.status !== 'out_of_service')
    const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]
    const items = Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => ({
      dish_id: pick(available).id,
      quantity: 1 + Math.floor(Math.random() * 2),
    }))
    return insertOrder({ table_id: pick(tables).id, items }, 2)
  },
}

function savingDemo(target: typeof server): typeof server {
  return new Proxy(target, {
    get(obj, key, receiver) {
      const value = Reflect.get(obj, key, receiver)
      if (typeof value !== 'function') return value
      return async (...args: unknown[]) => {
        try {
          return await value.apply(obj, args)
        } finally {
          saveDemoDb()
        }
      }
    },
  })
}

export const mockServer = savingDemo(server)
