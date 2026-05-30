<script lang="ts">
  import { onMount } from 'svelte'
  import type { DomainRule } from '../lib/types'
  import { getStorage, updateRules, updateIsRecording, clearRequests, getTheme, setTheme } from '../lib/storage'
  import type { ThemeMode } from '../lib/storage'
  import { matchUrlDirect } from '../lib/ruleMatcher'
  import { generateId } from '../lib/utils'
  import CustomSelect from '../lib/CustomSelect.svelte'

  let rules: DomainRule[] = []
  let isRecording = false
  let newPattern = ''
  let newType: 'wildcard' | 'regex' = 'wildcard'
  let editingId: string | null = null
  let editPattern = ''
  let editType: 'wildcard' | 'regex' = 'wildcard'
  let saving = false
  let testUrl = ''
  let testResult = ''
  let theme: ThemeMode = 'system'

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
    stop: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>',
    play: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
    x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    pencil: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
  }

  const typeOptions = [
    { label: '通配符', value: 'wildcard' },
    { label: '正则', value: 'regex' },
  ]

  const presets = [
    { label: 'API 子域名', pattern: '*.api.*', type: 'wildcard' as const },
    { label: '本地 API', pattern: '*/api/*', type: 'wildcard' as const },
    { label: 'localhost', pattern: 'localhost:*', type: 'wildcard' as const },
    { label: 'JSON API', pattern: '*.json', type: 'wildcard' as const },
    { label: 'GraphQL', pattern: '*/graphql', type: 'wildcard' as const },
  ]

  onMount(async () => {
    const data = await getStorage()
    rules = data.rules
    isRecording = data.isRecording
    theme = await getTheme()
    applyTheme(theme)
  })

  chrome.storage.onChanged.addListener((changes) => {
    const data = changes['apiAnalyzer']
    if (data) {
      isRecording = data.newValue?.isRecording ?? isRecording
    }
  })

  async function save() {
    saving = true
    await updateRules(rules)
    saving = false
  }

  async function addRule() {
    if (!newPattern.trim()) return
    rules = [...rules, {
      id: generateId(),
      pattern: newPattern.trim(),
      type: newType,
      enabled: true,
    }]
    newPattern = ''
    await save()
  }

  async function removeRule(id: string) {
    rules = rules.filter(r => r.id !== id)
    await save()
  }

  function startEdit(rule: DomainRule) {
    editingId = rule.id
    editPattern = rule.pattern
    editType = rule.type
  }

  async function confirmEdit() {
    if (!editingId || !editPattern.trim()) return
    rules = rules.map(r => r.id === editingId ? { ...r, pattern: editPattern.trim(), type: editType } : r)
    editingId = null
    await save()
  }

  function cancelEdit() {
    editingId = null
  }

  async function toggleRule(id: string) {
    rules = rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r)
    await save()
  }

  async function toggleRecording() {
    const recording = !isRecording
    isRecording = recording
    chrome.action.setBadgeText({ text: recording ? ' ' : '' })
    if (recording) chrome.action.setBadgeBackgroundColor({ color: '#ef4444' })
    chrome.runtime.sendMessage({ action: recording ? 'start' : 'stop' }).catch(() => {})
    updateIsRecording(recording).catch(() => {})
  }

  function applyPreset(preset: typeof presets[number]) {
    newPattern = preset.pattern
    newType = preset.type
  }

  function testRule() {
    if (!testUrl.trim()) { testResult = ''; return }
    const matched = matchUrlDirect(testUrl, rules)
    testResult = matched ? '✅ 匹配' : '❌ 不匹配'
  }

  function clearAll() {
    if (confirm('确定清空所有请求数据？')) {
      clearRequests()
    }
  }
</script>

<div class="min-h-screen bg-[var(--bg)] text-[var(--text)]">
  <div class="max-w-3xl mx-auto p-6 space-y-6">
    <!-- header -->
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold text-[var(--accent)]">API Analyzer 设置</h1>
      <div class="flex items-center gap-2">
        <button class="btn-ghost text-sm flex items-center" on:click={cycleTheme} title="主题切换">{@html themeIcons[theme]}</button>
        <button class="{isRecording ? 'btn-danger' : 'btn-success'} flex items-center gap-1"
          on:click={toggleRecording}>
          {@html isRecording ? svg.stop : svg.play} {isRecording ? '停止录制' : '开始录制'}
        </button>
      </div>
    </div>

    <!-- recording status -->
    <div class="card">
      <div class="flex items-center justify-between">
        <span class="text-sm text-[var(--text-secondary)]">录制状态</span>
        <span class="text-sm {isRecording ? 'text-green-400' : 'text-[var(--text-dim)]'}">
          {isRecording ? '● 录制中' : '○ 已停止'}
        </span>
      </div>
    </div>

    <!-- add rule -->
    <div class="card space-y-3">
      <div class="text-sm font-bold text-[var(--text-secondary)]">添加域名规则</div>
      <div class="flex items-center gap-2 flex-wrap">
        <input class="input flex-1 min-w-0" placeholder="例: *.api.example.com 或 /api/.*"
          bind:value={newPattern} on:keydown={e => e.key === 'Enter' && addRule()} />
        <CustomSelect options={typeOptions} bind:value={newType} cls="w-24" />
        <button class="btn-primary" on:click={addRule}>添加</button>
      </div>
      <div class="flex flex-wrap gap-1">
        {#each presets as p}
          <button class="btn-ghost text-xs text-[var(--text-muted)] border-1 border-[var(--border)] rounded px-2 py-0.5"
            on:click={() => applyPreset(p)}>
            {p.label}
          </button>
        {/each}
      </div>
    </div>

    <!-- rule list -->
    <div class="card space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-sm font-bold text-[var(--text-secondary)]">域名规则 ({rules.length})</span>
        {#if saving}
          <span class="text-xs text-[var(--text-dim)]">保存中...</span>
        {/if}
      </div>

      {#if rules.length === 0}
        <div class="text-xs text-[var(--text-dim)] py-4 text-center">暂无规则，将捕获所有请求</div>
      {:else}
        {#each rules as rule (rule.id)}
          <div class="flex items-center gap-2 py-1.5 border-b-1 border-[var(--border)] last:border-none">
            {#if editingId === rule.id}
              <input class="input flex-1" bind:value={editPattern} on:keydown={e => e.key === 'Enter' && confirmEdit()} />
              <CustomSelect options={typeOptions} bind:value={editType} cls="w-20" />
              <button class="btn-primary text-xs px-2 py-0.5 flex items-center" on:click={confirmEdit}>{@html svg.check}</button>
              <button class="btn-ghost text-xs px-2 py-0.5 flex items-center" on:click={cancelEdit}>{@html svg.x}</button>
            {:else}
              <button class="w-4 h-4 rounded border-1 {rule.enabled ? 'bg-blue-500 border-blue-500' : 'border-[var(--text-dim)]'}"
                on:click={() => toggleRule(rule.id)}>
                {#if rule.enabled}<span class="text-white block leading-none">{@html svg.check}</span>{/if}
              </button>
              <span class="text-xs text-[var(--text-muted)] w-12 shrink-0">{rule.type === 'regex' ? '正则' : '通配'}</span>
              <code class="flex-1 text-xs text-[var(--text-secondary)] font-mono truncate">{rule.pattern}</code>
              <button class="btn-ghost text-xs px-1 py-0.5 flex items-center" on:click={() => startEdit(rule)} title="编辑">{@html svg.pencil}</button>
              <button class="btn-ghost text-xs px-1 py-0.5 text-red-400 flex items-center" on:click={() => removeRule(rule.id)} title="删除">{@html svg.x}</button>
            {/if}
          </div>
        {/each}
      {/if}
    </div>

    <!-- url test -->
    <div class="card space-y-2">
      <div class="text-sm font-bold text-[var(--text-secondary)]">URL 匹配测试</div>
      <div class="flex items-center gap-2">
        <input class="input flex-1" placeholder="输入 URL 测试当前规则是否匹配..." bind:value={testUrl}
          on:keydown={e => e.key === 'Enter' && testRule()} />
        <button class="btn-primary" on:click={testRule}>测试</button>
      </div>
      {#if testResult}
        <div class="text-xs {testResult.includes('✅') ? 'text-green-400' : 'text-red-400'}">{testResult}</div>
      {/if}
    </div>

    <!-- data management -->
    <div class="card space-y-2">
      <div class="text-sm font-bold text-[var(--text-secondary)]">数据管理</div>
      <button class="btn-danger text-xs" on:click={clearAll}>清空所有请求数据</button>
    </div>

    <!-- help -->
    <div class="card space-y-1">
      <div class="text-sm font-bold text-[var(--text-secondary)]">使用说明</div>
      <ul class="text-xs text-[var(--text-muted)] space-y-1 list-disc list-inside">
        <li>通配符模式：<code class="text-[var(--accent)]">*</code> 匹配任意字符，<code class="text-[var(--accent)]">?</code> 匹配单个字符</li>
        <li>正则模式：使用 JavaScript 正则表达式语法</li>
        <li>启用录制后，插件会通过 <code class="text-[var(--accent)]">chrome.debugger</code> API 捕获所有网络请求</li>
        <li>录制期间页面顶部会显示调试横幅，属于正常行为</li>
        <li>为空规则时，所有请求（除图片/媒体/字体外）都会被记录</li>
      </ul>
    </div>
  </div>
</div>

