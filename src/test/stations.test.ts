import { describe, expect, it } from 'vitest'
import { coversWholeOrder } from '../api/stations'
import type { Order, OrderItem } from '../api/types'

const line = (id: number, quantity: number, unit_price: string): OrderItem => ({
  id,
  dish_id: id,
  quantity,
  unit_price,
  notes: null,
  prepared_quantity: 0,
  served_quantity: 0,
  prepared: false,
  served: false,
})

const PAELLA = line(1, 2, '18.50')
const VINO = line(2, 1, '3.50')
const CAFE = line(3, 2, '1.20')

const order = (items: OrderItem[], total: string): Order => ({
  id: 6,
  table_id: 3,
  waiter_id: 2,
  status: 'in_kitchen',
  total,
  created_at: '2026-10-15T13:05:00',
  updated_at: null,
  items,
})

describe('coversWholeOrder: ¿las líneas de la estación son todo el pedido?', () => {
  it('pedido solo de barra: sí', () => {
    const o = order([VINO, CAFE], '5.90')
    expect(coversWholeOrder(o, [VINO, CAFE])).toBe(true)
  })

  it('pedido mixto con la API anterior (envía todas las líneas): no', () => {
    const o = order([PAELLA, VINO], '40.50')
    expect(coversWholeOrder(o, [VINO])).toBe(false)
  })

  it('pedido mixto con la API de la HU-40 (solo envía las líneas de barra, total completo): no', () => {
    const o = order([VINO], '40.50')
    expect(coversWholeOrder(o, [VINO])).toBe(false)
  })

  it('compara en céntimos, sin errores de coma flotante', () => {
    const o = order([line(1, 3, '0.10'), line(2, 1, '0.20')], '0.50')
    expect(coversWholeOrder(o, o.items)).toBe(true)
  })
})
