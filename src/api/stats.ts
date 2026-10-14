import { USE_MOCK } from '../config'
import { api } from './client'
import { mockServer, type StatsFilters } from './mock/server'
import type { SalesSummary, TopDish } from './types'

export type { StatsFilters }

export async function getSales(filters: StatsFilters = {}): Promise<SalesSummary> {
  if (USE_MOCK) return mockServer.getSales(filters)
  const { data } = await api.get<SalesSummary>('/stats/sales', { params: filters })
  return data
}

export async function getTopDishes(filters: StatsFilters & { limit?: number } = {}): Promise<TopDish[]> {
  if (USE_MOCK) return mockServer.getTopDishes(filters)
  const { data } = await api.get<TopDish[]>('/stats/top-dishes', { params: filters })
  return data
}
