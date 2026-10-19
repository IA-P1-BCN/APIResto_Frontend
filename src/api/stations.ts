import type { Category, Dish, Order, OrderItem, Station } from './types'

export const DEFAULT_STATION: Station = 'kitchen'

const cents = (amount: string | number) => Math.round(Number(amount) * 100)

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
