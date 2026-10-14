import type { OrderStatus, Role } from './types'

export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['in_kitchen', 'cancelled'],
  in_kitchen: ['served', 'cancelled'],
  served: ['paid', 'cancelled'],
  paid: [],
  cancelled: [],
}

export interface Transition {
  to: OrderStatus
  roles: Role[]
  action: string
}

export const TRANSITIONS: Record<OrderStatus, Transition[]> = {
  pending: [
    { to: 'in_kitchen', roles: ['admin', 'kitchen', 'bartender'], action: 'Empezar' },
    { to: 'cancelled', roles: ['admin', 'waiter'], action: 'Cancelar' },
  ],
  in_kitchen: [{ to: 'served', roles: ['admin', 'kitchen', 'bartender'], action: 'Marcar servido' }],
  served: [{ to: 'paid', roles: ['admin', 'waiter'], action: 'Marcar pagado' }],
  paid: [],
  cancelled: [],
}

export function transitionsFor(role: Role, status: OrderStatus): Transition[] {
  return TRANSITIONS[status].filter((t) => t.roles.includes(role))
}

export const KITCHEN_STATUSES: OrderStatus[] = ['pending', 'in_kitchen']

export const ACTIVE_STATUSES: OrderStatus[] = ['pending', 'in_kitchen', 'served']
