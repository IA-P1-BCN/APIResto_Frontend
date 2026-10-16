import type { Role } from '../api/types'

export interface NavItem {
  path: string
  label: string
  roles: Role[]
  labelByRole?: Partial<Record<Role, string>>
  description: string
  hu?: string
}

const ALL_ROLES: Role[] = ['admin', 'waiter', 'kitchen', 'bartender', 'customer']

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
  { path: '/barra', label: 'Barra', roles: ['admin', 'bartender'], description: 'Bebidas y postres en tiempo real', hu: 'HU-41' },
  { path: '/facturas', label: 'Facturas', roles: ['admin', 'waiter'], description: 'Facturas y exportación CSV', hu: 'HU-14' },
  { path: '/estadisticas', label: 'Estadísticas', roles: ['admin'], description: 'Ventas y platos más vendidos', hu: 'HU-15' },
  { path: '/usuarios', label: 'Usuarios', roles: ['admin'], description: 'Personal y clientes' },
  { path: '/seguridad', label: 'Seguridad', roles: ALL_ROLES, description: 'Verificación en dos pasos', hu: 'HU-37' },
]

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administración',
  waiter: 'Sala',
  kitchen: 'Cocina',
  bartender: 'Barra',
  customer: 'Cliente',
}

export function navItemsFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role))
}

export function labelFor(item: NavItem, role: Role): string {
  return item.labelByRole?.[role] ?? item.label
}

export const HOME_PATH = '/'
