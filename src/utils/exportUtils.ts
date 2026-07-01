// CSV export with UTF-8 BOM for Excel compatibility

type Row = Record<string, string | number | boolean | null | undefined>

function toCSV(headers: string[], rows: string[][]): string {
  const escape = (v: string) => {
    if (v.includes(',') || v.includes('"') || v.includes('\n')) {
      return `"${v.replace(/"/g, '""')}"`
    }
    return v
  }
  const lines = [
    headers.map(escape).join(','),
    ...rows.map((r) => r.map(escape).join(',')),
  ]
  return '﻿' + lines.join('\r\n')
}

export function downloadCSV(filename: string, headers: string[], rows: Row[]): void {
  const strRows = rows.map((row) =>
    headers.map((h) => {
      const v = row[h]
      return v === null || v === undefined ? '' : String(v)
    })
  )
  const csv = toCSV(headers, strRows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadCSVRaw(filename: string, headers: string[], displayHeaders: string[], rows: Row[]): void {
  const strRows = rows.map((row) =>
    headers.map((h) => {
      const v = row[h]
      return v === null || v === undefined ? '' : String(v)
    })
  )
  const csv = toCSV(displayHeaders, strRows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function printElement(elementId: string, title: string): void {
  const el = document.getElementById(elementId)
  if (!el) return
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8"/>
    <title>${title}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1e293b; padding: 20px; }
      h1 { font-size: 16px; margin-bottom: 4px; }
      p.sub { font-size: 11px; color: #64748b; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th { background: #1565c0; color: white; padding: 6px 10px; text-align: left; font-size: 11px; }
      td { padding: 5px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
      tr:nth-child(even) td { background: #f8fafc; }
      .badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; }
      @media print { body { padding: 0; } }
    </style>
  </head><body>`)
  win.document.write(el.innerHTML)
  win.document.write('</body></html>')
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 400)
}
