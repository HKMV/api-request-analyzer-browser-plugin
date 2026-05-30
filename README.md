# API Request Analyzer

> 基于 Chrome Debugger API 的 HTTP 请求耗时分析工具，捕获并可视化每个请求的 DNS、TCP、TLS、发送、等待、下载各阶段耗时。

## 功能

- **实时录制** — 通过 `chrome.debugger` API 捕获所有网络请求（可过滤图片/媒体/字体等）
- **耗时分解** — 每个请求拆分为 DNS、TCP、TLS、发送、等待、下载 6 个阶段，彩色柱状图展示
- **域名规则** — 支持通配符/正则表达式过滤，只录制感兴趣的请求
- **请求详情** — 查看/复制请求头、响应头、请求体、响应体
- **导出** — CSV / Excel 导出，支持导出全部或单条请求
- **暗色/亮色主题** — 支持手动切换或跟随系统
- **虚拟滚动** — 数千条请求流畅渲染

## 安装

### 从源码构建

```bash
git clone https://github.com/your-username/api-request-analyzer.git
cd api-request-analyzer
npm install
npm run build
```

在 `chrome://extensions` 开启"开发者模式"，点击"加载已解压的扩展"，选择 `dist/` 目录。

### 从 Chrome 应用商店

_即将上架_

## 使用

1. 点击工具栏图标打开弹出面板
2. 点击 **录制** 按钮开始捕获请求
3. 浏览网页，请求会自动出现在列表中
4. 点击任意请求查看各阶段耗时详情
5. 使用搜索框、方法/状态筛选器快速定位
6. 点击表头可按时间、方法、URL、状态、耗时排序
7. 可设置域名规则仅录制指定请求

## 设置页面

右键扩展图标 → "选项" 进入设置，或从弹出面板点击齿轮图标：

- 管理域名过滤规则（通配符 / 正则）
- URL 匹配测试
- 清空历史数据
- 开始/停止录制

## 技术栈

| 技术 | 用途 |
|------|------|
| [Svelte 4](https://svelte.dev/) | UI 框架 |
| [TypeScript](https://www.typescriptlang.org/) | 语言 |
| [Vite 5](https://vitejs.dev/) | 构建工具 |
| [UnoCSS](https://unocss.dev/) | 原子化 CSS |
| [@crxjs/vite-plugin](https://crxjs.dev/) | Chrome 扩展构建 |
| [chrome.debugger](https://developer.chrome.com/docs/extensions/reference/api/debugger) | 网络请求捕获 |
| [xlsx](https://sheetjs.com/) | Excel 导出 |

## License

MIT
