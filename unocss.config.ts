import {
  defineConfig,
  presetAttributify,
  presetUno,
  transformerDirectives,
} from 'unocss'

export default defineConfig({
  presets: [presetUno(), presetAttributify()],
  transformers: [transformerDirectives()],
  shortcuts: {
    'btn': 'px-3 py-1 rounded-md text-sm cursor-pointer border-none transition-all duration-150',
    'btn-primary': 'btn bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700',
    'btn-danger': 'btn bg-red-500 text-white hover:bg-red-600 active:bg-red-700',
    'btn-success': 'btn bg-green-500 text-white hover:bg-green-600 active:bg-green-700',
    'btn-ghost': 'btn bg-transparent text-[var(--text-secondary)] hover:bg-[var(--hover)] active:bg-[var(--selected)]',
    'card': 'bg-[var(--bg-card)] rounded-lg border-1 border-[var(--border)] p-3',
    'input': 'w-full px-2 py-1 rounded-md text-sm bg-[var(--bg)] border-1 border-[var(--border)] text-[var(--text)] outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-dim)]',
  },
})
