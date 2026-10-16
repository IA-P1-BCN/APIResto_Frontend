export const MAX_CUSTOMER_PARTY_SIZE = 8

export const CUSTOMER_PARTY_TOO_LARGE = `Para reservas de más de ${MAX_CUSTOMER_PARTY_SIZE} personas, llama al restaurante`

export const RESERVATION_IN_PAST = 'No se puede reservar en una fecha pasada'

export function noTableAvailable(partySize: number, reservedAt: string): string {
  const [day, time] = reservedAt.split('T')
  const [year, month, date] = day.split('-')
  return `No hay mesa libre para ${partySize} personas el ${date}/${month}/${year} a las ${time.slice(0, 5)}`
}
