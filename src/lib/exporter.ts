import type { CapturedRequest } from './types'

function escapeCsv(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n'))
    return '"' + v.replace(/"/g, '""') + '"'
  return v
}

function rowsFromRequests(requests: CapturedRequest[]) {
  const header = [
    '时间', '域名', 'URL', '方法', '状态码',
    'DNS(ms)', 'TCP(ms)', 'TLS(ms)', '发送(ms)', '等待(ms)', '下载(ms)', '总耗时(ms)',
    '请求头', '响应头', '请求体', '响应体',
  ]

  const body = requests.map(r => [
    new Date(r.timestamp).toISOString(),
    r.domain,
    r.url,
    r.method,
    String(r.statusCode),
    r.timing.dnsLookup.toFixed(2),
    r.timing.tcpConnect.toFixed(2),
    r.timing.tlsHandshake.toFixed(2),
    r.timing.requestSend.toFixed(2),
    r.timing.waiting.toFixed(2),
    r.timing.contentDownload.toFixed(2),
    r.timing.total.toFixed(2),
    JSON.stringify(r.requestHeaders),
    JSON.stringify(r.responseHeaders),
    r.requestBody ?? '',
    r.responseBody ?? '',
  ])

  return [header, ...body]
}

export function exportCsv(requests: CapturedRequest[]): Blob {
  const rows = rowsFromRequests(requests)
  const csv = rows.map(r => r.map(escapeCsv).join(',')).join('\n')
  return new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
}

export async function exportXlsx(requests: CapturedRequest[]): Promise<Blob> {
  const XLSX = await import('xlsx')
  const rows = rowsFromRequests(requests)
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [
    { wch: 22 }, { wch: 18 }, { wch: 50 }, { wch: 8 }, { wch: 8 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 10 }, { wch: 36 }, { wch: 36 }, { wch: 30 }, { wch: 30 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Requests')
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
