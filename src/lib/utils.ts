import type { HttpHeader } from './types'

export function headersToArray(headers: Record<string, string> | HttpHeader[] | null | undefined): HttpHeader[] {
  if (!headers) return []
  if (Array.isArray(headers)) return headers
  return Object.entries(headers).map(([name, value]) => ({ name, value }))
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function getDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export function getMimeType(headers: { name: string; value: string }[]): string {
  if (!Array.isArray(headers) || headers.length === 0) return ''
  const ct = headers.find(h => h.name.toLowerCase() === 'content-type')
  return ct ? ct.value.split(';')[0].trim() : ''
}

export function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleString('zh-CN', {
    hour12: false,
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export function formatTimeFull(ts: number): string {
  const d = new Date(ts)
  const offset = -d.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const tz = `${sign}${String(Math.floor(offset / 60)).padStart(2, '0')}:${String(offset % 60).padStart(2, '0')}`
  return d.toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }) + ' ' + tz
}

export function formatDuration(ms: number): string {
  if (ms < 1) return ms.toFixed(2) + 'ms'
  if (ms < 1000) return ms.toFixed(2) + 'ms'
  return (ms / 1000).toFixed(2) + 's'
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i]
}

export function formatHeaders(headers: unknown): string {
  if (!headers) return '无'
  if (Array.isArray(headers)) {
    return headers.map(h => `${h.name}: ${h.value}`).join('\n')
  }
  if (typeof headers === 'object') {
    return Object.entries(headers).map(([name, value]) => `${name}: ${value}`).join('\n')
  }
  return '无'
}
