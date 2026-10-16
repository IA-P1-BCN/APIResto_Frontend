export type Role = 'admin' | 'waiter' | 'kitchen' | 'bartender' | 'customer'

export interface User {
  id: number
  name: string
  email: string
  phone?: string | null
  role: Role
  is_active: boolean
  created_at?: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
}

export interface TwoFactorChallenge {
  mfa_required: true
  mfa_token: string
}

export interface TwoFactorStatus {
  enabled: boolean
  recovery_codes_left: number
}

export interface TwoFactorSetup {
  secret: string
  otpauth_uri: string
  qr_svg: string
}

export interface ApiErrorBody {
  detail?: unknown
  code?: string
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  size: number
}

export type Station = 'kitchen' | 'bar'

export interface Category {
  id: number
  name: string
  sort_order: number
  station?: Station
}

export interface Dish {
  id: number
  category_id: number
  name: string
  description: string | null
  price: string
  allergens: string | null
  is_available: boolean
}

export type TableLocation = 'indoor' | 'terrace' | 'bar'
export type TableStatus = 'available' | 'occupied' | 'reserved' | 'out_of_service'

export interface DiningTable {
  id: number
  number: number
  capacity: number
  location: TableLocation
  status: TableStatus
}

export type ReservationStatus = 'confirmed' | 'cancelled' | 'completed' | 'no_show'

export interface Reservation {
  id: number
  user_id: number
  table_id: number
  table_number?: number | null
  reserved_at: string
  duration_min: number
  ends_at: string
  party_size: number
  status: ReservationStatus
  notes: string | null
  created_at: string | null
}

export interface ReservationCreate {
  table_id?: number
  reserved_at: string
  party_size: number
  duration_min?: number
  notes?: string
}

export interface ReservationUpdate {
  table_id?: number
  reserved_at?: string
  party_size?: number
  notes?: string | null
  status?: Exclude<ReservationStatus, 'cancelled'>
}

export type OrderStatus = 'pending' | 'in_kitchen' | 'served' | 'paid' | 'cancelled'

export interface OrderItem {
  id: number
  dish_id: number
  quantity: number
  unit_price: string
  notes: string | null
  prepared_quantity: number
  served_quantity: number
  prepared: boolean
  served: boolean
}

export type OrderItemMarks = Partial<
  Pick<OrderItem, 'prepared' | 'served' | 'prepared_quantity' | 'served_quantity'>
>

export interface Order {
  id: number
  table_id: number
  waiter_id: number | null
  status: OrderStatus
  total: string
  created_at: string
  updated_at: string | null
  items: OrderItem[]
}

export interface OrderCreate {
  table_id: number
  items: { dish_id: number; quantity: number; notes?: string }[]
}

export interface Invoice {
  id: number
  number: string
  order_id: number
  base_amount: string
  tax_rate: string
  tax_amount: string
  total: string
  issued_at: string
}

export interface SalesDay {
  day: string
  orders_count: number
  total_sales: string
}

export interface SalesSummary {
  date_from: string | null
  date_to: string | null
  orders_count: number
  total_sales: string
  average_ticket: string
  daily: SalesDay[]
}

export interface TopDish {
  dish_id: number
  name: string
  quantity: number
  revenue: string
}

export interface KitchenEvent {
  event: 'order_created' | 'order_status_changed'
  order: Pick<Order, 'id' | 'status'> & Partial<Order>
}
