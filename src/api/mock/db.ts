import { toISODate, toServerTimestamp } from '../../utils/format'
import { DEMO_DB_KEY, isDemoChosen } from '../demo'
import type { Category, DiningTable, Dish, Invoice, Order, OrderItem, Reservation } from '../types'

const CATEGORIES: Category[] = [
  { id: 1, name: 'Entrantes', sort_order: 1, station: 'kitchen' },
  { id: 2, name: 'Principales', sort_order: 2, station: 'kitchen' },
  { id: 3, name: 'Postres', sort_order: 3, station: 'bar' },
  { id: 4, name: 'Bebidas', sort_order: 4, station: 'bar' },
]

const dish = (
  id: number,
  category_id: number,
  name: string,
  description: string | null,
  price: string,
  allergens: string | null,
  is_available = true,
): Dish => ({ id, category_id, name, description, price, allergens, is_available })

const DISHES: Dish[] = [
  dish(1, 1, 'Croquetas de jamón', '6 unidades, cremosas', '8.50', 'gluten,lácteos'),
  dish(2, 1, 'Patatas bravas', 'Con alioli y salsa brava', '6.00', 'huevo'),
  dish(3, 1, 'Ensalada de burrata', 'Tomate, rúcula y pesto', '11.50', 'lácteos,frutos secos'),
  dish(4, 1, 'Pimientos de Padrón', null, '5.50', null),
  dish(5, 1, 'Gazpacho', 'Solo en temporada', '5.00', null, false),
  dish(6, 2, 'Paella de marisco', 'Mínimo 2 personas (precio por persona)', '18.00', 'crustáceos,moluscos'),
  dish(7, 2, 'Entrecot a la brasa', '300 g con patatas', '22.00', null),
  dish(8, 2, 'Lubina al horno', 'Con verduras de temporada', '19.50', 'pescado'),
  dish(9, 2, 'Risotto de setas', 'Vegetariano', '15.00', 'lácteos'),
  dish(10, 2, 'Hamburguesa de la casa', 'Ternera, queso y cebolla caramelizada', '14.00', 'gluten,lácteos,sésamo', false),
  dish(11, 3, 'Tarta de queso', 'Al horno, cremosa', '6.50', 'gluten,lácteos,huevo'),
  dish(12, 3, 'Crema catalana', null, '5.50', 'lácteos,huevo'),
  dish(13, 3, 'Coulant de chocolate', 'Con helado de vainilla', '7.00', 'gluten,lácteos,huevo'),
  dish(14, 4, 'Agua mineral', '50 cl', '2.00', null),
  dish(15, 4, 'Vino tinto de la casa', 'Copa', '3.50', 'sulfitos'),
  dish(16, 4, 'Café', null, '1.80', null),
]

const TABLES: DiningTable[] = [
  { id: 1, number: 1, capacity: 2, location: 'indoor', status: 'available' },
  { id: 2, number: 2, capacity: 2, location: 'indoor', status: 'occupied' },
  { id: 3, number: 3, capacity: 4, location: 'indoor', status: 'reserved' },
  { id: 4, number: 4, capacity: 4, location: 'indoor', status: 'available' },
  { id: 5, number: 5, capacity: 6, location: 'indoor', status: 'available' },
  { id: 6, number: 6, capacity: 4, location: 'terrace', status: 'occupied' },
  { id: 7, number: 7, capacity: 4, location: 'terrace', status: 'available' },
  { id: 8, number: 8, capacity: 8, location: 'terrace', status: 'out_of_service' },
  { id: 9, number: 9, capacity: 2, location: 'bar', status: 'available' },
  { id: 10, number: 10, capacity: 2, location: 'bar', status: 'occupied' },
]

export const DEFAULT_DURATION_MIN = 90

export function endsAt(reservedAt: string, durationMin: number): string {
  const end = new Date(new Date(reservedAt).getTime() + durationMin * 60_000)
  const hh = String(end.getHours()).padStart(2, '0')
  const mm = String(end.getMinutes()).padStart(2, '0')
  return `${toISODate(end)}T${hh}:${mm}:00`
}

function initialReservations(): Reservation[] {
  const today = toISODate(new Date())
  const tomorrow = toISODate(new Date(Date.now() + 24 * 60 * 60 * 1000))
  const r = (
    id: number,
    user_id: number,
    table_id: number,
    day: string,
    hhmm: string,
    party_size: number,
    status: Reservation['status'] = 'confirmed',
    notes: string | null = null,
  ): Reservation => {
    const reserved_at = `${day}T${hhmm}:00`
    return {
      id,
      user_id,
      table_id,
      reserved_at,
      duration_min: DEFAULT_DURATION_MIN,
      ends_at: endsAt(reserved_at, DEFAULT_DURATION_MIN),
      party_size,
      status,
      notes,
      created_at: `${today}T09:00:00`,
    }
  }
  return [
    r(1, 4, 3, today, '21:00', 4, 'confirmed', 'Cumpleaños, traen tarta'),
    r(2, 2, 4, today, '13:30', 3),
    r(3, 2, 7, today, '14:00', 2, 'completed'),
    r(4, 2, 5, today, '20:30', 6, 'cancelled'),
    r(5, 4, 7, tomorrow, '20:30', 2),
    r(6, 2, 1, tomorrow, '14:00', 2, 'confirmed', 'Mesa tranquila si es posible'),
  ]
}

function initialOrders(): Order[] {
  const minutesAgo = (min: number) => toServerTimestamp(new Date(Date.now() - min * 60_000))
  let itemId = 1
  const item = (dish_id: number, quantity: number, notes: string | null = null): OrderItem => ({
    id: itemId++,
    dish_id,
    quantity,
    unit_price: DISHES.find((d) => d.id === dish_id)!.price,
    notes,
    prepared_quantity: 0,
    served_quantity: 0,
    prepared: false,
    served: false,
  })
  const o = (id: number, table_id: number, status: Order['status'], min: number, items: OrderItem[]): Order => ({
    id,
    table_id,
    waiter_id: 2,
    status,
    total: items.reduce((t, i) => t + i.quantity * Number(i.unit_price), 0).toFixed(2),
    created_at: minutesAgo(min),
    updated_at: null,
    items,
  })
  return [
    o(1, 2, 'in_kitchen', 12, [item(7, 1, 'Al punto'), item(2, 1), item(15, 2)]),
    o(2, 6, 'pending', 3, [item(6, 2), item(3, 1, 'Sin frutos secos'), item(14, 2)]),
    o(3, 10, 'served', 40, [item(1, 1), item(16, 2)]),
  ]
}

const DAY_MS = 24 * 60 * 60 * 1000
const SOLD_DISH_IDS = [1, 2, 3, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16]

function pastOrders(): Order[] {
  let seed = 7
  const random = () => (seed = (seed * 9301 + 49297) % 233280) / 233280
  const pick = <T,>(list: T[]) => list[Math.floor(random() * list.length)]
  const sold = DISHES.filter((d) => SOLD_DISH_IDS.includes(d.id))
  const orders: Order[] = []
  let itemId = 1001
  for (let daysAgo = 13; daysAgo >= 1; daysAgo--) {
    const count = 2 + Math.floor(random() * 4)
    for (let n = 0; n < count; n++) {
      const createdAt = new Date(Date.now() - daysAgo * DAY_MS)
      createdAt.setUTCHours(11 + Math.floor(random() * 10), Math.floor(random() * 60), 0, 0)
      const items: OrderItem[] = Array.from({ length: 1 + Math.floor(random() * 3) }, () => {
        const dish = pick(sold)
        const quantity = 1 + Math.floor(random() * 2)
        return {
          id: itemId++,
          dish_id: dish.id,
          quantity,
          unit_price: dish.price,
          notes: null,
          prepared_quantity: quantity,
          served_quantity: quantity,
          prepared: true,
          served: true,
        }
      })
      orders.push({
        id: 1000 + orders.length + 1,
        table_id: pick(TABLES).id,
        waiter_id: 2,
        status: 'paid',
        total: items.reduce((t, i) => t + i.quantity * Number(i.unit_price), 0).toFixed(2),
        created_at: toServerTimestamp(createdAt),
        updated_at: toServerTimestamp(createdAt),
        items,
      })
    }
  }
  return orders
}

interface MockDb {
  categories: Category[]
  dishes: Dish[]
  tables: DiningTable[]
  reservations: Reservation[]
  orders: Order[]
  invoices: Invoice[]
  nextReservationId: number
  nextOrderId: number
  nextOrderItemId: number
  twoFactor?: Record<number, MockTwoFactor>
}

export interface MockTwoFactor {
  pending: boolean
  enabled: boolean
  recoveryCodes: string[]
}

export const TAX_RATE = 0.1

export function buildInvoice(id: number, order: Order, sequence: number, issuedAt: string): Invoice {
  const totalCents = Math.round(Number(order.total) * 100)
  const baseCents = Math.round(totalCents / (1 + TAX_RATE))
  return {
    id,
    number: `F-${issuedAt.slice(0, 4)}-${String(sequence).padStart(5, '0')}`,
    order_id: order.id,
    base_amount: (baseCents / 100).toFixed(2),
    tax_rate: TAX_RATE.toFixed(2),
    tax_amount: ((totalCents - baseCents) / 100).toFixed(2),
    total: (totalCents / 100).toFixed(2),
    issued_at: issuedAt,
  }
}

function paidInvoices(orders: Order[]): Invoice[] {
  const lastSequence = new Map<string, number>()
  return orders
    .filter((o) => o.status === 'paid')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((order, index) => {
      const issuedAt = order.updated_at ?? order.created_at
      const year = issuedAt.slice(0, 4)
      const sequence = (lastSequence.get(year) ?? 0) + 1
      lastSequence.set(year, sequence)
      return buildInvoice(index + 1, order, sequence, issuedAt)
    })
}

function createDb(): MockDb {
  const reservations = initialReservations()
  const current = initialOrders()
  const orders = [...pastOrders(), ...current]
  return {
    categories: structuredClone(CATEGORIES),
    dishes: structuredClone(DISHES),
    tables: structuredClone(TABLES),
    reservations,
    orders,
    invoices: paidInvoices(orders),
    nextReservationId: reservations.length + 1,
    nextOrderId: current.length + 1,
    nextOrderItemId: current.flatMap((o) => o.items).length + 1,
    twoFactor: {},
  }
}

const DEMO_DB_VERSION = 2

function loadDemoDb(): MockDb | null {
  if (!isDemoChosen()) return null
  try {
    const saved = JSON.parse(localStorage.getItem(DEMO_DB_KEY) ?? 'null')
    return saved?.version === DEMO_DB_VERSION ? (saved.db as MockDb) : null
  } catch {
    return null
  }
}

export let db: MockDb = loadDemoDb() ?? createDb()

export function resetMockDb(): void {
  db = createDb()
}

export function saveDemoDb(): void {
  if (!isDemoChosen()) return
  try {
    localStorage.setItem(DEMO_DB_KEY, JSON.stringify({ version: DEMO_DB_VERSION, db }))
  } catch {
    // Sin almacenamiento la demo empieza de cero en cada visita
  }
}
