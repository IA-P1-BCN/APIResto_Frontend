import { describe, expect, it } from 'vitest'
import { parseCsv, toExcelCsv } from '../utils/excelCsv'

describe('CSV para Excel en español', () => {
  it('lee un CSV con comillas, comas y saltos de línea dentro de un campo', () => {
    expect(parseCsv('a,b\r\n"x, y","dice ""hola""\nadiós"\r\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'dice "hola"\nadiós'],
    ])
  })

  it('separa con punto y coma, usa coma decimal y traduce las cabeceras', () => {
    const csv = toExcelCsv('number,total,order_id\r\nF-2026-00001,12.10,3\r\n', { number: 'Número', total: 'Total' })
    expect(csv).toBe('\uFEFFNúmero;Total;order_id\r\nF-2026-00001;12,10;3\r\n')
  })

  it('pasa la fecha de UTC a hora local sin la T', () => {
    const csv = toExcelCsv('issued_at\r\n2026-10-14T09:12:05\r\n')
    const local = new Date(Date.UTC(2026, 9, 14, 9, 12, 5))
    const hh = String(local.getHours()).padStart(2, '0')
    expect(csv).toBe(`\uFEFFissued_at\r\n2026-10-14 ${hh}:12:05\r\n`)
  })

  it('entrecomilla los textos que llevan punto y coma o comillas', () => {
    expect(toExcelCsv('notes\r\n"sin sal; poco hecho"\r\n')).toBe('\uFEFFnotes\r\n"sin sal; poco hecho"\r\n')
  })

  it('quita el BOM del CSV original para no duplicarlo', () => {
    expect(toExcelCsv('\uFEFFa\r\n1\r\n')).toBe('\uFEFFa\r\n1\r\n')
  })
})
