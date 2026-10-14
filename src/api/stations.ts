import type { Category, Dish, OrderItem, Station } from './types'

export const DEFAULT_STATION: Station = 'kitchen'

export function dishStations(categories: Category[], dishes: Dish[]): Map<number, Station> {
  const byCategory = new Map(categories.map((c) => [c.id, c.station ?? DEFAULT_STATION]))
  return new Map(dishes.map((d) => [d.id, byCategory.get(d.category_id) ?? DEFAULT_STATION]))
}

export function stationOf(item: OrderItem, stations: Map<number, Station>): Station {
  return stations.get(item.dish_id) ?? DEFAULT_STATION
}
