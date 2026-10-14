import { parseServerTimestamp, toISODate } from './format'

const BOM = '\uFEFF'
const DECIMAL = /^-?\d+\.\d+$/
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const input = text.startsWith(BOM) ? text.slice(1) : text
  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function excelValue(value: string): string {
  if (DECIMAL.test(value)) return value.replace('.', ',')
  if (!ISO_DATETIME.test(value)) return value
  const date = parseServerTimestamp(value)
  const time = [date.getHours(), date.getMinutes(), date.getSeconds()].map((n) => String(n).padStart(2, '0'))
  return `${toISODate(date)} ${time.join(':')}`
}

function excelField(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

export function toExcelCsv(csv: string, headers: Record<string, string> = {}): string {
  const [header = [], ...rows] = parseCsv(csv)
  const lines = [
    header.map((name) => headers[name] ?? name),
    ...rows.map((row) => row.map(excelValue)),
  ].map((row) => row.map(excelField).join(';'))
  return `${BOM}${lines.map((line) => `${line}\r\n`).join('')}`
}
