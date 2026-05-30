<script lang="ts">
  import { onMount, tick, createEventDispatcher } from 'svelte'

  export let value: string = ''
  export let options: { label: string; value: string }[] = []
  export let placeholder: string = ''
  export let cls: string = ''

  const dispatch = createEventDispatcher<{ value: string }>()

  let open = false
  let rootEl: HTMLDivElement
  let dropdownEl: HTMLDivElement

  async function toggle() {
    open = !open
    if (open) {
      await tick()
      positionDropdown()
    }
  }

  function select(val: string) {
    value = val
    dispatch('value', val)
    open = false
  }

  function positionDropdown() {
    if (!rootEl || !dropdownEl) return
    const rect = rootEl.getBoundingClientRect()
    const MARGIN = 6
    const dh = Math.min(dropdownEl.scrollHeight, 240)
    const spaceBelow = window.innerHeight - rect.bottom - MARGIN
    const spaceAbove = rect.top - MARGIN
    let top: number
    let maxH: number
    if (spaceBelow < dh && spaceAbove >= dh) {
      top = Math.max(MARGIN, rect.top - dh - MARGIN)
      maxH = Math.min(dh, rect.top - MARGIN * 2)
    } else {
      top = rect.bottom + MARGIN
      maxH = Math.min(dh, window.innerHeight - top - MARGIN)
    }
    dropdownEl.style.position = 'fixed'
    dropdownEl.style.left = rect.left + 'px'
    dropdownEl.style.width = rect.width + 'px'
    dropdownEl.style.top = top + 'px'
    dropdownEl.style.maxHeight = Math.max(40, maxH) + 'px'
  }

  function handleFocusOut(e: FocusEvent) {
    if (rootEl && !rootEl.contains(e.relatedTarget as Node)) {
      open = false
    }
  }

  onMount(() => {
    document.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Escape') open = false })
    rootEl?.addEventListener('focusout', handleFocusOut)
    return () => {
      rootEl?.removeEventListener('focusout', handleFocusOut)
    }
  })
</script>

<div bind:this={rootEl} class="relative {cls}" role="presentation" on:click|stopPropagation>
  <button
    class="trigger"
    class:open
    on:click={toggle}
    type="button">
    <span>{options.find(o => o.value === value)?.label || placeholder}</span>
    <span class="arrow">{open ? '▲' : '▼'}</span>
  </button>
  {#if open}
    <div bind:this={dropdownEl} class="dropdown">
      {#each options as opt}
        <button
          class="option"
          class:selected={opt.value === value}
          on:click={() => select(opt.value)}
          type="button">
          {opt.label}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 13px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    cursor: pointer;
    outline: none;
    transition: border-color 0.15s;
  }
  .trigger:hover,
  .trigger.open {
    border-color: var(--accent);
  }
  .arrow {
    font-size: 10px;
    margin-left: 6px;
    color: var(--text-dim);
  }
  .dropdown {
    position: fixed;
    z-index: 9999;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg-card);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    overflow-y: auto;
  }
  .option {
    display: block;
    width: 100%;
    padding: 6px 8px;
    font-size: 13px;
    text-align: left;
    background: transparent;
    color: var(--text);
    border: none;
    cursor: pointer;
  }
  .option:hover {
    background: var(--hover);
  }
  .option.selected {
    background: var(--selected);
    color: var(--accent);
  }
  .option.selected:hover {
    opacity: 0.85;
  }
</style>
