import type { CapturedRequest, DomainRule, StorageData } from './types'

const STORAGE_KEY = 'apiAnalyzer'

const DEFAULT_DATA: StorageData = {
  requests: [],
  rules: [],
  isRecording: false,
  maxRequests: 500,
}

export async function getStorage(): Promise<StorageData> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  return { ...DEFAULT_DATA, ...result[STORAGE_KEY] }
}

export async function saveStorage(data: StorageData): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: data })
}

export async function addRequest(request: CapturedRequest): Promise<void> {
  await chrome.storage.local.get(STORAGE_KEY).then(async (result) => {
    const data: StorageData = { ...DEFAULT_DATA, ...result[STORAGE_KEY] }
    data.requests.unshift(request)
    if (data.requests.length > data.maxRequests) {
      data.requests = data.requests.slice(0, data.maxRequests)
    }
    await chrome.storage.local.set({ [STORAGE_KEY]: data })
  })
}

export async function clearRequests(): Promise<void> {
  await chrome.storage.local.get(STORAGE_KEY).then(async (result) => {
    const data: StorageData = { ...DEFAULT_DATA, ...result[STORAGE_KEY] }
    data.requests = []
    await chrome.storage.local.set({ [STORAGE_KEY]: data })
  })
}

export async function updateIsRecording(recording: boolean): Promise<void> {
  await chrome.storage.local.get(STORAGE_KEY).then(async (result) => {
    const data: StorageData = { ...DEFAULT_DATA, ...result[STORAGE_KEY] }
    data.isRecording = recording
    await chrome.storage.local.set({ [STORAGE_KEY]: data })
  })
}

export async function updateRules(rules: DomainRule[]): Promise<void> {
  await chrome.storage.local.get(STORAGE_KEY).then(async (result) => {
    const data: StorageData = { ...DEFAULT_DATA, ...result[STORAGE_KEY] }
    data.rules = rules
    await chrome.storage.local.set({ [STORAGE_KEY]: data })
  })
}

export async function updateMaxRequests(max: number): Promise<void> {
  await chrome.storage.local.get(STORAGE_KEY).then(async (result) => {
    const data: StorageData = { ...DEFAULT_DATA, ...result[STORAGE_KEY] }
    data.maxRequests = max
    await chrome.storage.local.set({ [STORAGE_KEY]: data })
  })
}

const THEME_KEY = 'apiAnalyzerTheme'

export type ThemeMode = 'dark' | 'light' | 'system'

export async function getTheme(): Promise<ThemeMode> {
  const result = await chrome.storage.local.get(THEME_KEY)
  return (result[THEME_KEY] as ThemeMode) || 'system'
}

export async function setTheme(theme: ThemeMode): Promise<void> {
  await chrome.storage.local.set({ [THEME_KEY]: theme })
}
