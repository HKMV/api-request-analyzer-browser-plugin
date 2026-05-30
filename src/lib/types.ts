export interface DomainRule {
  id: string
  pattern: string
  type: 'wildcard' | 'regex'
  enabled: boolean
}

export interface RequestTiming {
  dnsLookup: number
  tcpConnect: number
  tlsHandshake: number
  requestSend: number
  waiting: number
  contentDownload: number
  total: number
}

export interface HttpHeader {
  name: string
  value: string
}

export interface CapturedRequest {
  id: string
  tabId: number
  url: string
  domain: string
  method: string
  statusCode: number
  statusText: string
  requestHeaders: HttpHeader[]
  responseHeaders: HttpHeader[]
  requestBody: string | null
  responseBody: string | null
  mimeType: string
  timing: RequestTiming
  startTime: number
  endTime: number
  timestamp: number
}

export type ExportFormat = 'csv' | 'xlsx'

export interface StorageData {
  requests: CapturedRequest[]
  rules: DomainRule[]
  isRecording: boolean
  maxRequests: number
}
