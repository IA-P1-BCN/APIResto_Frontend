import { useMemo } from 'react'
import { listAllDishes, listCategories } from '../api/menu'
import { dishStations } from '../api/stations'
import { listTables } from '../api/tables'
import type { DiningTable, Station } from '../api/types'
import { useQuery } from './useQuery'

const noTables = () => Promise.resolve<DiningTable[]>([])

export function useDishNames(): Map<number, string> {
  const { data } = useQuery(listAllDishes)
  return useMemo(() => new Map((data ?? []).map((d) => [d.id, d.name])), [data])
}

export function useDishStations(): Map<number, Station> | null {
  const { data: categories } = useQuery(listCategories)
  const { data: dishes } = useQuery(listAllDishes)
  return useMemo(() => (categories && dishes ? dishStations(categories, dishes) : null), [categories, dishes])
}

export function useTableNumbers(enabled: boolean): Map<number, number> {
  const { data } = useQuery(enabled ? listTables : noTables)
  return useMemo(() => new Map((data ?? []).map((t) => [t.id, t.number])), [data])
}

export function tableLabel(tableId: number, numbers: Map<number, number>): string {
  const number = numbers.get(tableId)
  return number === undefined ? `Mesa (id ${tableId})` : `Mesa ${number}`
}

export function dishLabel(dishId: number, names: Map<number, string>): string {
  return names.get(dishId) ?? `Plato ${dishId}`
}
