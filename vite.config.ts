import { crx, defineManifest } from '@crxjs/vite-plugin'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vite'

const manifest = defineManifest({
  manifest_version: 3,
  name: 'API Request Analyzer',
  version: '1.0.0',
  description: '接口请求耗时分析工具 - 记录和分析所有HTTP请求的详细耗时',
  permissions: ['debugger', 'storage', 'tabs'],
  host_permissions: ['<all_urls>'],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      16: 'icon16.png',
      32: 'icon32.png',
      48: 'icon48.png',
      128: 'icon128.png',
    },
  },
  options_page: 'src/options/index.html',
})

export default defineConfig({
  plugins: [
    UnoCSS(),
    svelte(),
    {
      name: 'no-crossorigin',
      transformIndexHtml: {
        order: 'post',
        handler(html: string) {
          return html.replace(/\s+crossorigin(=["\'][^"\']*["\'])?/g, '')
        },
      },
    },
    crx({ manifest }),
  ],
  build: {
    outDir: 'dist',
    modulePreload: false,
    cssCodeSplit: false,
  },
})
