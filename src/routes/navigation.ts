import type { Role } from '../api/types'

export interface NavItem {
  path: string
  label: string
  roles: Role[]
  labelByRole?: Partial<Record<Role, string>>
  description: string
  hu?: string
}

const ALL_ROLES: Role[] = ['admin', 'waiter', 'kitchen', 'customer']

export const NAV_ITEMS: NavItem[] = [
  { path: '/carta', label: 'Carta', roles: ALL_ROLES, description: 'Categorías, platos, precios y alérgenos', hu: 'HU-13' },
  { path: '/mesas', label: 'Mesas', roles: ['admin', 'waiter'], description: 'Estado de la sala en tiempo real', hu: 'HU-13' },
  {
    path: '/reservas',
    label: 'Reservas',
    labelByRole: { customer: 'Mis reservas' },
    roles: ['admin', 'waiter', 'customer'],
    description: 'Reservas por fecha y hora',
    hu: 'HU-13',
  },
  { path: '/pedidos', label: 'Pedidos', roles: ['admin', 'waiter'], description: 'Comandas por mesa', hu: 'HU-13' },
  { path: '/cocina', label: 'Cocina', roles: ['admin', 'kitchen'], description: 'Pedidos en tiempo real para cocina', hu: 'HU-13' },
  { path: '/facturas', label: 'Facturas', roles: ['admin', 'waiter'], description: 'Facturas y exportación CSV' },
  { path: '/estadisticas', label: 'Estadísticas', roles: ['admin'], description: 'Ventas y platos más vendidos' },
  { path: '/usuarios', label: 'Usuarios', roles: ['admin'], description: 'Personal y clientes' },
]

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administración',
  waiter: 'Sala',
  kitchen: 'Cocina',
  customer: 'Cliente',
}

export function navItemsFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role))
}

export function labelFor(item: NavItem, role: Role): string {
  return item.labelByRole?.[role] ?? item.label
}

const HOME_BY_ROLE: Partial<Record<Role, string>> = {
  admin: '/',
  waiter: '/pedidos',
  kitchen: '/cocina',
  customer: '/carta',
}

export function homeFor(role: Role): string {
  return HOME_BY_ROLE[role] ?? '/'
}
