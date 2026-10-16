import type { Category, Dish, Order, OrderItem, Station } from './types'

export const DEFAULT_STATION: Station = 'kitchen'

const cents = (amount: string | number) => Math.round(Number(amount) * 100)

/**
 * Las líneas de una estación son todo el pedido. Desde la HU-40 el backend solo envía a cocina
 * y a barra sus propias líneas, pero `total` sigue siendo el del pedido completo: si las líneas
 * no suman el total, el pedido tiene platos de otra estación.
 */
export function coversWholeOrder(order: Order, items: OrderItem[]): boolean {
  if (items.length !== order.items.length) return false
  const subtotal = items.reduce((sum, i) => sum + i.quantity * cents(i.unit_price), 0)
  return subtotal === cents(order.total)
}

export function dishStations(categories: Category[], dishes: Dish[]): Map<number, Station> {
  const byCategory = new Map(categories.map((c) => [c.id, c.station ?? DEFAULT_STATION]))
  return new Map(dishes.map((d) => [d.id, byCategory.get(d.category_id) ?? DEFAULT_STATION]))
}

export function stationOf(item: OrderItem, stations: Map<number, Station>): Station {
  return stations.get(item.dish_id) ?? DEFAULT_STATION
}
