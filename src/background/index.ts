import type { CapturedRequest, HttpHeader } from '../lib/types'
import { matchUrl, compileRules } from '../lib/ruleMatcher'
import { addRequest, getStorage, updateIsRecording } from '../lib/storage'
import { generateId, getDomain, getMimeType, headersToArray } from '../lib/utils'

interface TimingData {
  dnsStart?: number
  dnsEnd?: number
  connectStart?: number
  connectEnd?: number
  sslStart?: number
  sslEnd?: number
  sendStart?: number
  sendEnd?: number
  receiveHeadersEnd?: number
}

interface PendingReq {
  requestId: string
  tabId: number
  url: string
  method: string
  requestHeaders: HttpHeader[]
  requestBody: string | null
  startTime: number     // monotonic ms from requestWillBeSent.timestamp
  wallTime: number      // Date.now() epoch ms at capture
  statusCode: number
  statusText: string
  responseHeaders: HttpHeader[]
  mimeType: string
  timing: TimingData
}

const pending = new Map<string, PendingReq>()

const SKIP_TYPES = new Set(['Image', 'Media', 'Font', 'Stylesheet'])

/* ---- cached storage ---- */

let cachedStorage: Awaited<ReturnType<typeof getStorage>> | null = null
let storageCacheTime = 0
const STORAGE_CACHE_TTL = 200
let compiledRules: ReturnType<typeof compileRules> = { compiled: [], rawEnabledCount: 0 }

async function getCachedStorage() {
  const now = Date.now()
  if (!cachedStorage || now - storageCacheTime > STORAGE_CACHE_TTL) {
    cachedStorage = await getStorage()
    storageCacheTime = now
    compiledRules = compileRules(cachedStorage.rules)
  }
  return cachedStorage
}

function invalidateStorageCache() {
  cachedStorage = null
}

/* ---- listen for storage changes to invalidate cache ---- */
chrome.storage.onChanged.addListener((changes) => {
  if (changes['apiAnalyzer']) {
    invalidateStorageCache()
  }
})

function getDuration(t: TimingData, key: 'dns' | 'tcp' | 'ssl' | 'send' | 'wait'): number {
  let s: number | undefined
  let e: number | undefined
  switch (key) {
    case 'dns':  s = t.dnsStart; e = t.dnsEnd; break
    case 'tcp':  s = t.connectStart; e = t.connectEnd; break
    case 'ssl':  s = t.sslStart; e = t.sslEnd; break
    case 'send': s = t.sendStart; e = t.sendEnd; break
    case 'wait': s = t.sendEnd; e = t.receiveHeadersEnd; break
  }
  if (s === undefined || e === undefined || s < 0 || e < 0) return 0
  return Math.max(0, e - s)
}

/* ---- debugger lifecycle ---- */

async function attachToTab(tabId: number) {
  try {
    await chrome.debugger.attach({ tabId }, '1.3')
    await chrome.debugger.sendCommand({ tabId }, 'Network.enable')
  } catch { /* tab may be gone */ }
}

async function setBadge(isRecording: boolean) {
  await chrome.action.setBadgeText({ text: isRecording ? ' ' : '' })
  if (isRecording) await chrome.action.setBadgeBackgroundColor({ color: '#ef4444' })
}

async function startRecording() {
  const tabs = await chrome.tabs.query({})
  await Promise.all(tabs.map(t => t.id ? attachToTab(t.id) : Promise.resolve()))
  invalidateStorageCache()
  await updateIsRecording(true)
  await setBadge(true)
}

async function stopRecording() {
  const tabs = await chrome.tabs.query({})
  for (const t of tabs) {
    if (t.id) {
      try { await chrome.debugger.detach({ tabId: t.id }) } catch { /* ok */ }
    }
  }
  pending.clear()
  invalidateStorageCache()
  await updateIsRecording(false)
  await setBadge(false)
}

/* ---- tab lifecycle hooks ---- */

chrome.tabs.onCreated.addListener(async tab => {
  if (tab.id) {
    const s = await getCachedStorage()
    if (s.isRecording) await attachToTab(tab.id)
  }
})

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    const s = await getCachedStorage()
    if (s.isRecording && !pending.has(`tab_${tabId}`)) {
      try {
        await chrome.debugger.attach({ tabId }, '1.3')
        await chrome.debugger.sendCommand({ tabId }, 'Network.enable')
      } catch { /* ok */ }
    }
  }
})

chrome.debugger.onDetach.addListener(async (source, reason) => {
  if (!source.tabId) return

  if (reason === 'canceled_by_user') {
    // user manually detached in devtools — stop recording entirely
    const tabs = await chrome.tabs.query({})
    for (const t of tabs) {
      if (t.id && t.id !== source.tabId) {
        try { await chrome.debugger.detach({ tabId: t.id }) } catch { /* ok */ }
      }
    }
    pending.clear()
    invalidateStorageCache()
    await updateIsRecording(false)
    await setBadge(false)
    return
  }

  // tab closed / navigated — re-attach if still recording
  const s = await getCachedStorage()
  if (s.isRecording) await attachToTab(source.tabId)
})

/* ---- network events ---- */

chrome.debugger.onEvent.addListener(async (source, method, params) => {
  if (!source.tabId) return
  const tabId = source.tabId

  if (method === 'Network.requestWillBeSent') {
    const { requestId, request, timestamp, type } = params
    if (SKIP_TYPES.has(type)) return

    const s = await getCachedStorage()
    if (!s.isRecording) return
    if (!matchUrl(request.url, compiledRules)) return

    const req: PendingReq = {
      requestId,
      tabId,
      url: request.url,
      method: request.method,
      requestHeaders: headersToArray(request.headers),
      requestBody: null,
      startTime: timestamp * 1000,
      wallTime: Date.now(),
      statusCode: 0,
      statusText: '',
      responseHeaders: [],
      mimeType: '',
      timing: {},
    }
    pending.set(requestId, req)

    try {
      const body = await chrome.debugger.sendCommand(
        { tabId },
        'Network.getRequestPostData',
        { requestId },
      ) as { postData?: string }
      const r = pending.get(requestId)
      if (r) r.requestBody = body.postData ?? null
    } catch { /* no post data */ }
  }

  else if (method === 'Network.responseReceived') {
    const { requestId, response, timestamp } = params
    const r = pending.get(requestId)
    if (!r) return

    r.timing = { ...r.timing, ...response.timing }
    r.statusCode = response.status
    r.statusText = response.statusText
    r.responseHeaders = headersToArray(response.headers)
    r.mimeType = getMimeType(r.responseHeaders)
  }

  else if (method === 'Network.loadingFinished') {
    const { requestId, timestamp } = params
    const r = pending.get(requestId)
    if (!r) return

    const t = r.timing
    const dns = getDuration(t, 'dns')
    const tcp = getDuration(t, 'tcp')
    const ssl = getDuration(t, 'ssl')
    const send = getDuration(t, 'send')
    const wait = getDuration(t, 'wait')

    const loadEndMs = timestamp * 1000
    const total = Math.max(0, loadEndMs - r.startTime)
    const accounted = dns + tcp + ssl + send + wait
    const download = Math.max(0, total - accounted)

    let responseBody: string | null = null
    try {
      const body = await chrome.debugger.sendCommand(
        { tabId },
        'Network.getResponseBody',
        { requestId },
      ) as { body: string; base64Encoded: boolean }
      responseBody = body.base64Encoded ? atob(body.body) : body.body
    } catch { /* body unavailable */ }

    const captured: CapturedRequest = {
      id: generateId(),
      tabId,
      url: r.url,
      domain: getDomain(r.url),
      method: r.method,
      statusCode: r.statusCode,
      statusText: r.statusText,
      requestHeaders: r.requestHeaders,
      responseHeaders: r.responseHeaders,
      requestBody: r.requestBody,
      responseBody,
      mimeType: r.mimeType,
      timing: { dnsLookup: dns, tcpConnect: tcp, tlsHandshake: ssl, requestSend: send, waiting: wait, contentDownload: download, total },
      startTime: r.startTime,
      endTime: timestamp * 1000,
      timestamp: r.wallTime,
    }

    await addRequest(captured)
    pending.delete(requestId)
  }
})

/* ---- message API ---- */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'start') {
    startRecording().then(() => sendResponse({ ok: true }))
    return true
  }
  if (msg.action === 'stop') {
    stopRecording().then(() => sendResponse({ ok: true }))
    return true
  }
  if (msg.action === 'status') {
    getCachedStorage().then(s => sendResponse({ isRecording: s.isRecording }))
    return true
  }
})
