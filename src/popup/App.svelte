<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import type { CapturedRequest } from '../lib/types'
  import { getStorage, clearRequests, getTheme, setTheme, updateIsRecording } from '../lib/storage'
  import type { ThemeMode } from '../lib/storage'
  import { exportCsv, exportXlsx, downloadBlob } from '../lib/exporter'
  import { formatTime, formatTimeFull, formatDuration, formatHeaders } from '../lib/utils'
  import CustomSelect from '../lib/CustomSelect.svelte'

  let requests: CapturedRequest[] = []
  let filtered: CapturedRequest[] = []
  let search = ''
  let methodFilter = ''
  let statusFilter = ''
  let sortKey: keyof CapturedRequest | 'total' | '' = ''
  let sortDir: 'asc' | 'desc' = 'desc'
  let selectedId: string | null = null
  let isRecording = false
  let loading = true
  let copyTip = ''
  let copyTipTimer: ReturnType<typeof setTimeout>
  let theme: ThemeMode = 'system'
  let toggling = false

  let scrollContainer: HTMLDivElement
  let scrollTop = 0
  let containerHeight = 400
  let ro: ResizeObserver | null = null
  const ROW_H = 30
  const BUFFER = 5

  $: totalHeight = filtered.length * ROW_H
  $: visibleStart = Math.max(0, Math.floor(scrollTop / ROW_H) - BUFFER)
  $: visibleEnd = Math.min(filtered.length, Math.ceil((scrollTop + containerHeight) / ROW_H) + BUFFER)
  $: visibleItems = filtered.slice(visibleStart, visibleEnd)

  function onScroll() {
    if (scrollContainer) scrollTop = scrollContainer.scrollTop
  }

  function updateContainerHeight() {
    if (scrollContainer) containerHeight = scrollContainer.clientHeight
  }

  $: selected = selectedId ? requests.find(r => r.id === selectedId) ?? null : null

  const methods = ['', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

  const methodOptions = methods.map(m => ({ label: m || '全部方法', value: m }))
  const statusOptions = [
    { label: '全部状态', value: '' },
    { label: '2xx 成功', value: '2xx' },
    { label: '3xx 重定向', value: '3xx' },
    { label: '4xx 客户端错误', value: '4xx' },
    { label: '5xx 服务端错误', value: '5xx' },
    { label: '错误 (>=400)', value: 'error' },
  ]

  function handleSort(key: typeof sortKey) {
    if (sortKey === key) { sortDir = sortDir === 'asc' ? 'desc' : 'asc'; return }
    sortKey = key
    sortDir = 'desc'
  }

  $: {
    let list = requests
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(r => r.url.toLowerCase().includes(q) || r.domain.toLowerCase().includes(q))
    }
    if (methodFilter) list = list.filter(r => r.method === methodFilter)
    if (statusFilter === '2xx') list = list.filter(r => r.statusCode >= 200 && r.statusCode < 300)
    else if (statusFilter === '3xx') list = list.filter(r => r.statusCode >= 300 && r.statusCode < 400)
    else if (statusFilter === '4xx') list = list.filter(r => r.statusCode >= 400 && r.statusCode < 500)
    else if (statusFilter === '5xx') list = list.filter(r => r.statusCode >= 500)
    else if (statusFilter === 'error') list = list.filter(r => r.statusCode >= 400)
    filtered = list
    if (sortKey) {
      filtered = [...filtered].sort((a, b) => {
        let va: number | string = 0
        let vb: number | string = 0
        if (sortKey === 'total') { va = a.timing.total; vb = b.timing.total }
        else if (sortKey === 'timestamp') { va = a.timestamp; vb = b.timestamp }
        else if (sortKey === 'domain') { va = a.domain; vb = b.domain }
        else if (sortKey === 'method') { va = a.method; vb = b.method }
        else if (sortKey === 'statusCode') { va = a.statusCode; vb = b.statusCode }
        else if (sortKey === 'url') { va = a.url; vb = b.url }
        if (typeof va === 'string') return sortDir === 'asc' ? (vb as string).localeCompare(va) : va.localeCompare(vb as string)
        return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
      })
    }
  }

  function applyTheme(t: ThemeMode) {
    const root = document.documentElement
    if (t === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', t)
    }
  }

  function cycleTheme() {
    const next: Record<ThemeMode, ThemeMode> = { dark: 'light', light: 'system', system: 'dark' }
    theme = next[theme]
    applyTheme(theme)
    setTheme(theme)
  }

  const themeIcons: Record<ThemeMode, string> = {
    dark: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    light: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    system: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  }

  const svg = {
    clipboard: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="2" width="8" height="14" rx="2" ry="2"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>',
    download: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    stop: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>',
    play: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
    spinner: '<svg class="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/></svg>',
  }

  onMount(async () => {
    try {
      const data = await getStorage()
      requests = data.requests
      isRecording = data.isRecording
      theme = await getTheme()
      applyTheme(theme)
    } catch (e) {
      console.error('[API Analyzer] load error:', e)
    }
    loading = false
    updateContainerHeight()
    ro = new ResizeObserver(updateContainerHeight)
    if (scrollContainer) ro.observe(scrollContainer)
    try {
      const status = await chrome.runtime.sendMessage({ action: 'status' })
      if (status && typeof status.isRecording === 'boolean') {
        isRecording = status.isRecording
      }
    } catch { /* bg may be unavailable */ }
  })

  onDestroy(() => { if (ro) ro.disconnect() })

  chrome.storage.onChanged.addListener((changes) => {
    const data = changes['apiAnalyzer']
    if (data) {
      requests = data.newValue?.requests ?? requests
      isRecording = data.newValue?.isRecording ?? isRecording
    }
  })

  async function toggleRecording() {
    if (toggling) return
    const recording = !isRecording
    toggling = true
    // 同步更新 state（popup 关闭前一定执行）
    isRecording = recording
    // fire-and-forget Chrome API（dispatched to browser，popup 关闭后仍然生效）
    chrome.action.setBadgeText({ text: recording ? ' ' : '' })
    if (recording) chrome.action.setBadgeBackgroundColor({ color: '#ef4444' })
    chrome.runtime.sendMessage({ action: recording ? 'start' : 'stop' }).catch(() => {})
    // 异步持久化 storage（可能被 popup 关闭打断，但 badge 已更新）
    updateIsRecording(recording).catch(() => {})
    // 短暂 spinner 反馈
    await new Promise(r => setTimeout(r, 600))
    toggling = false
  }

  async function handleClear() {
    if (!confirm('确定清空所有请求数据？')) return
    try {
      await clearRequests()
      requests = []
      selectedId = null
    } catch (e) {
      console.error('[API Analyzer] clear error:', e)
    }
  }

  async function handleExportCsv() {
    try {
      const blob = exportCsv(selected ? [selected] : filtered)
      downloadBlob(blob, `api-requests-${Date.now()}.csv`)
    } catch (e) {
      console.error('[API Analyzer] csv export error:', e)
    }
  }

  async function handleExportXlsx() {
    try {
      const blob = await exportXlsx(selected ? [selected] : filtered)
      downloadBlob(blob, `api-requests-${Date.now()}.xlsx`)
    } catch (e) {
      console.error('[API Analyzer] xlsx export error:', e)
    }
  }

  function barWidth(total: number, val: number): string {
    if (total <= 0 || val <= 0) return '0%'
    return Math.max(2, (val / total) * 100) + '%'
  }

  const phaseColors: Record<string, string> = {
    dnsLookup: 'bg-blue-400',
    tcpConnect: 'bg-cyan-400',
    tlsHandshake: 'bg-purple-400',
    requestSend: 'bg-green-400',
    waiting: 'bg-yellow-400',
    contentDownload: 'bg-orange-400',
  }

  function statusColor(code: number): string {
    if (code >= 200 && code < 300) return 'text-green-400'
    if (code >= 300 && code < 400) return 'text-yellow-400'
    if (code >= 400 && code < 500) return 'text-orange-400'
    if (code >= 500) return 'text-red-400'
    return 'text-gray-400'
  }

  const phaseLabels: [string, keyof CapturedRequest['timing']][] = [
    ['DNS', 'dnsLookup'],
    ['TCP', 'tcpConnect'],
    ['TLS', 'tlsHandshake'],
    ['发送', 'requestSend'],
    ['等待', 'waiting'],
    ['下载', 'contentDownload'],
  ]

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      copyTip = '已复制'
      clearTimeout(copyTipTimer)
      copyTipTimer = setTimeout(() => { copyTip = '' }, 1500)
    }).catch(() => {})
  }
</script>

<div class="flex flex-col h-screen bg-[var(--bg)] text-[var(--text)] text-sm overflow-hidden relative rounded-xl border-1 border-[var(--border)]">
  <!-- header -->
  <div class="flex items-center justify-between px-3 py-2 bg-[var(--bg-card)] border-b-1 border-[var(--border)] shrink-0">
    <div class="flex items-center gap-2">
      <span class="font-bold text-base text-[var(--accent)]">API Analyzer</span>
      {#if !loading}
        <span class="text-xs text-[var(--text-dim)]">({requests.length})</span>
      {/if}
    </div>
    <div class="flex items-center gap-2">
      <button class="btn-ghost text-xs flex items-center {toggling ? 'text-[var(--text-dim)]' : isRecording ? 'text-red-400 animate-pulse' : 'text-green-400'}"
        on:click={toggleRecording} disabled={toggling}>
        {#if toggling}
          {@html svg.spinner} {isRecording ? '停止中...' : '启动中...'}
        {:else}
          {@html isRecording ? svg.stop : svg.play} {isRecording ? '停止' : '录制'}
        {/if}
      </button>
      <button class="btn-ghost text-xs flex items-center text-red-400 hover:bg-red-500/10" on:click={handleClear} title="清空">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
      <button class="btn-ghost text-xs flex items-center" on:click={cycleTheme} title="主题切换">{@html themeIcons[theme]}</button>
      <a href="/src/options/index.html" target="_blank" class="btn-ghost text-xs no-underline flex items-center" title="规则设置">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      </a>
    </div>
  </div>

  {#if copyTip}
    <div class="absolute top-10 right-3 text-[var(--text)] text-xs font-medium px-3 py-1.5 rounded-lg z-50 animate-fade-in shadow-lg" style="background: color-mix(in srgb, var(--accent) 8%, var(--bg-card)); border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent)">{copyTip}</div>
  {/if}

  {#if loading}
    <div class="flex-1 flex items-center justify-center text-[var(--text-dim)]">加载中...</div>
  {:else if selected}
    <!-- detail view -->
    <div class="flex-1 overflow-y-auto p-3 space-y-3">
      <button class="btn-ghost text-xs text-[var(--accent)] mb-1 flex items-center gap-1" on:click={() => { selectedId = null }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        返回列表
      </button>

      <div class="card">
        <div class="flex items-center justify-between mb-1">
          <div class="text-xs text-[var(--text-muted)] truncate flex-1 mr-2">{selected.url}</div>
          <button class="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-[var(--hover)] text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors outline-none border-0 bg-transparent cursor-pointer shrink-0" on:click={() => copyToClipboard(selected?.url ?? '')} title="复制URL">{@html svg.clipboard}</button>
        </div>
        <div class="flex items-center gap-3 text-xs">
          <span class="font-mono font-bold {statusColor(selected.statusCode)}">{selected.method}</span>
          <span class="font-mono {statusColor(selected.statusCode)}">{selected.statusCode} {selected.statusText}</span>
          <span class="text-[var(--text-muted)]">{selected.mimeType}</span>
          <span class="text-[var(--text-muted)]">{formatTime(selected.timestamp)}</span>
        </div>
      </div>

      <!-- timing bar chart -->
      <div class="card">
        <div class="text-xs font-bold mb-2 text-[var(--text-secondary)]">耗时分解 ({formatDuration(selected.timing.total)})</div>
        <div class="space-y-1.5">
          {#each phaseLabels as [label, key]}
            <div class="flex items-center gap-2 text-xs">
              <span class="w-6 text-right text-[var(--text-dim)] shrink-0">{label}</span>
              <div class="flex-1 h-4 bg-[var(--bar-bg)] rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all {phaseColors[key]}"
                  style="width: {barWidth(selected.timing.total, selected.timing[key])}">
                </div>
              </div>
              <span class="w-14 text-right font-mono text-[var(--text-secondary)] shrink-0">{formatDuration(selected.timing[key])}</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- headers & body -->
      <div class="card">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-bold text-[var(--text-secondary)]">请求头</span>
          <button class="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-[var(--hover)] text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors outline-none border-0 bg-transparent cursor-pointer" on:click={() => copyToClipboard(formatHeaders(selected?.requestHeaders))} title="复制请求头">{@html svg.clipboard}</button>
        </div>
        <pre class="text-xs text-[var(--text-muted)] overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">{formatHeaders(selected.requestHeaders)}</pre>
      </div>

      <div class="card">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-bold text-[var(--text-secondary)]">响应头</span>
           <button class="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-[var(--hover)] text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors outline-none border-0 bg-transparent cursor-pointer" on:click={() => copyToClipboard(formatHeaders(selected?.responseHeaders))} title="复制响应头">{@html svg.clipboard}</button>
        </div>
        <pre class="text-xs text-[var(--text-muted)] overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">{formatHeaders(selected.responseHeaders)}</pre>
      </div>

      <div class="card">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-bold text-[var(--text-secondary)]">请求体</span>
           <button class="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-[var(--hover)] text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors outline-none border-0 bg-transparent cursor-pointer" on:click={() => copyToClipboard(selected?.requestBody ?? '')} title="复制请求体">{@html svg.clipboard}</button>
        </div>
        <pre class="text-xs text-[var(--text-muted)] overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">{selected.requestBody || '无'}</pre>
      </div>

      <div class="card">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-bold text-[var(--text-secondary)]">响应体</span>
           <button class="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-[var(--hover)] text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors outline-none border-0 bg-transparent cursor-pointer" on:click={() => copyToClipboard(selected?.responseBody ?? '')} title="复制响应体">{@html svg.clipboard}</button>
        </div>
        <pre class="text-xs text-[var(--text-muted)] overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">{selected.responseBody || '无'}</pre>
      </div>
    </div>
  {:else}
    <!-- filters -->
    <div class="flex items-center gap-2 px-3 py-2 bg-[var(--bg-card)] border-b-1 border-[var(--border)] shrink-0">
      <input class="input flex-1" placeholder="搜索域名或URL..." bind:value={search} />
      <CustomSelect options={methodOptions} bind:value={methodFilter} cls="w-24" />
      <CustomSelect options={statusOptions} bind:value={statusFilter} cls="w-28" />
    </div>

    <!-- table -->
    <div class="flex-1 overflow-y-auto" bind:this={scrollContainer} on:scroll={onScroll}>
      {#if filtered.length === 0}
        <div class="flex items-center justify-center h-full text-[var(--text-dim)] text-xs">
          {requests.length === 0 ? '暂无请求数据，请开始录制' : '未匹配到请求'}
        </div>
      {:else}
        <div class="sticky top-0 bg-[var(--bg)] z-10 border-b-1 border-[var(--border)]">
          <div class="grid grid-cols-[64px_56px_1fr_56px_64px] text-xs leading-[30px] select-none">
            <div role="button" tabindex="0" class="px-2 cursor-pointer hover:text-[var(--text-secondary)] {sortKey === 'timestamp' ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'}"
              on:click={() => handleSort('timestamp')} on:keydown={(e) => e.key === 'Enter' && handleSort('timestamp')}>
              时间{sortKey === 'timestamp' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
            </div>
            <div role="button" tabindex="0" class="px-2 cursor-pointer hover:text-[var(--text-secondary)] {sortKey === 'method' ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'}"
              on:click={() => handleSort('method')} on:keydown={(e) => e.key === 'Enter' && handleSort('method')}>
              方法{sortKey === 'method' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
            </div>
            <div role="button" tabindex="0" class="px-2 cursor-pointer hover:text-[var(--text-secondary)] {sortKey === 'url' ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'}"
              on:click={() => handleSort('url')} on:keydown={(e) => e.key === 'Enter' && handleSort('url')}>
              URL{sortKey === 'url' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
            </div>
            <div role="button" tabindex="0" class="px-2 text-center cursor-pointer hover:text-[var(--text-secondary)] {sortKey === 'statusCode' ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'}"
              on:click={() => handleSort('statusCode')} on:keydown={(e) => e.key === 'Enter' && handleSort('statusCode')}>
              状态{sortKey === 'statusCode' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
            </div>
            <div role="button" tabindex="0" class="px-2 text-right cursor-pointer hover:text-[var(--text-secondary)] {sortKey === 'total' ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'}"
              on:click={() => handleSort('total')} on:keydown={(e) => e.key === 'Enter' && handleSort('total')}>
              耗时{sortKey === 'total' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
            </div>
          </div>
        </div>
        <div style="height:{totalHeight}px;position:relative;">
          {#each visibleItems as req, i (req.id)}
            {@const idx = visibleStart + i}
            <div role="button" tabindex="0" class="grid grid-cols-[64px_56px_1fr_56px_64px] text-xs leading-[30px] border-t-1 border-[var(--border)] cursor-pointer hover:bg-[var(--hover)]"
              class:bg-[var(--selected)]={selectedId === req.id}
              style="position:absolute;top:{idx * ROW_H}px;left:0;right:0;"
              on:click={() => { selectedId = req.id }} on:keydown={(e) => e.key === 'Enter' && (selectedId = req.id)}>
              <div class="px-2 text-[var(--text-muted)] truncate" title={formatTimeFull(req.timestamp)}>{formatTime(req.timestamp)}</div>
              <div class="px-2 font-mono font-bold {statusColor(req.statusCode)} truncate">{req.method}</div>
              <div class="px-2 text-[var(--text-secondary)] truncate group relative" title={req.url}>
                <span class="truncate block">{req.url}</span>
                <button class="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 inline-flex items-center justify-center w-5 h-5 rounded hover:bg-[var(--hover)] text-[var(--text-dim)] hover:text-[var(--accent)] transition-all outline-none border-0 bg-transparent cursor-pointer"
                  on:click|stopPropagation={() => copyToClipboard(req.url)} title="复制URL">{@html svg.clipboard}</button>
              </div>
              <div class="px-2 text-center font-mono {statusColor(req.statusCode)} truncate">{req.statusCode}</div>
              <div class="px-2 text-right font-mono text-[var(--text-secondary)] truncate" title={req.timing.total.toFixed(2) + 'ms'}>{formatDuration(req.timing.total)}</div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- footer -->
    <div class="flex items-center justify-between px-3 py-1.5 bg-[var(--bg-card)] border-t-1 border-[var(--border)] shrink-0">
      <span class="text-xs text-[var(--text-dim)]">
        {#if filtered.length < requests.length}
          {filtered.length}/{requests.length}
        {:else}
          {requests.length} 条
        {/if}
      </span>
      <div class="flex items-center gap-1">
        <button class="btn-ghost text-xs flex items-center gap-1" on:click={handleExportCsv} disabled={filtered.length === 0}>{@html svg.download} CSV</button>
        <button class="btn-ghost text-xs flex items-center gap-1" on:click={handleExportXlsx} disabled={filtered.length === 0}>{@html svg.download} Excel</button>
      </div>
    </div>
  {/if}
</div>

