# Mukaku 重构为成熟模式 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 mukaku-search 从早期模式（DEFAULT_BASE_URL 重复、background 直接拼接无 normalize）重构为成熟模式（独立 search-url.js + importScripts + popup 复用），与 jiaofu/subhd/hdhive 一致。

**Architecture:** 新增独立 `search-url.js`（IIFE 挂 `globalThis.MukakuSearch`，兼容 `module.exports`），`background.js` 用 `importScripts` 引入并改用 `buildSearchUrl`（修复直接拼接隐患），`popup.js` 复用同一套 api，`popup.html` 在 `popup.js` 前加载 `search-url.js`。`STORAGE_KEY` 保持 `mukakuBaseUrl` 不变，兼容现有用户 storage 数据。

**Tech Stack:** Chrome Manifest V3、纯原生 JS（零依赖）、chrome.storage.local、chrome.contextMenus、Node（仅用于验证 search-url.js 纯函数）

## Global Constraints

- Chrome Manifest V3，零依赖纯原生 JS
- 代码风格：JS 不用分号、2 空格缩进、camelCase、常量 UPPER_SNAKE_CASE、注释中文
- `search-url.js` 用 IIFE 挂 `globalThis.MukakuSearch`，并兼容 `module.exports`（与 subhd/jiaofu/hdhive 完全一致）
- `background.js` 用 `importScripts('search-url.js')` 引入
- `STORAGE_KEY = 'mukakuBaseUrl'`（**保持不变**，兼容现有用户 storage 数据）
- `DEFAULT_BASE_URL = 'https://web2.mukaku.com'`
- 搜索路径固定：`/search?sb=${encodeURIComponent(keyword.trim())}`
- manifest `version`：`1.0.0` → `1.1.0`，其余字段不变（权限、action 已具备）
- commit 格式：`type: 中文描述`（type ∈ feat/docs/refactor）
- 浏览器验证：`chrome://extensions` 加载未打包扩展 `extensions/mukaku-search/`
- Node 验证 `search-url.js`：临时脚本 `extensions/mukaku-search/_verify.js`，验证后删除，不提交、不引入测试框架

---

### Task 1: search-url.js（核心纯函数，Node TDD 验证）

**Files:**
- Create: `extensions/mukaku-search/search-url.js`
- Test（临时，验证后删除，不提交）: `extensions/mukaku-search/_verify.js`

**Interfaces:**
- Produces: `globalThis.MukakuSearch` 与 `module.exports`，包含 `DEFAULT_BASE_URL`（string）、`STORAGE_KEY`（string）、`normalizeBaseUrl(baseUrl: string) => string`、`buildSearchUrl(baseUrl: string, keyword: string) => string`

- [ ] **Step 1: 写临时验证脚本（期望值先行）**

创建 `extensions/mukaku-search/_verify.js`：

```js
const assert = require('assert')
const api = require('./search-url.js')

assert.strictEqual(api.DEFAULT_BASE_URL, 'https://web2.mukaku.com')
assert.strictEqual(api.STORAGE_KEY, 'mukakuBaseUrl')

// normalizeBaseUrl：去尾斜杠
assert.strictEqual(api.normalizeBaseUrl('https://web2.mukaku.com/'), 'https://web2.mukaku.com')
assert.strictEqual(api.normalizeBaseUrl('https://web2.mukaku.com//'), 'https://web2.mukaku.com')

// normalizeBaseUrl：无协议自动补 https://
assert.strictEqual(api.normalizeBaseUrl('web2.mukaku.com'), 'https://web2.mukaku.com')
assert.strictEqual(api.normalizeBaseUrl('  web2.mukaku.com  '), 'https://web2.mukaku.com')

// normalizeBaseUrl：保留已有的 http/https
assert.strictEqual(api.normalizeBaseUrl('http://web2.mukaku.com'), 'http://web2.mukaku.com')

// normalizeBaseUrl：空值回退默认
assert.strictEqual(api.normalizeBaseUrl(''), 'https://web2.mukaku.com')

// buildSearchUrl：中文编码 + 路径固定
assert.strictEqual(
  api.buildSearchUrl('https://web2.mukaku.com', '三体'),
  'https://web2.mukaku.com/search?sb=%E4%B8%89%E4%BD%93'
)

// buildSearchUrl：keyword 去空格 + baseUrl 经 normalize
assert.strictEqual(
  api.buildSearchUrl('web2.mukaku.com/', ' 三体 '),
  'https://web2.mukaku.com/search?sb=%E4%B8%89%E4%BD%93'
)

console.log('all passed')
```

- [ ] **Step 2: 运行验证脚本，确认失败（search-url.js 尚不存在）**

Run: `node extensions/mukaku-search/_verify.js`
Expected: 报错 `Cannot find module './search-url.js'`

- [ ] **Step 3: 写 search-url.js**

创建 `extensions/mukaku-search/search-url.js`：

```js
(function () {
  const DEFAULT_BASE_URL = 'https://web2.mukaku.com'
  const STORAGE_KEY = 'mukakuBaseUrl'

  function normalizeBaseUrl(baseUrl) {
    let url = (baseUrl || DEFAULT_BASE_URL).trim().replace(/\/+$/, '')

    if (!url) {
      return DEFAULT_BASE_URL
    }

    if (!/^https?:\/\//.test(url)) {
      url = `https://${url}`
    }

    return url.replace(/\/+$/, '')
  }

  function buildSearchUrl(baseUrl, keyword) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
    const query = encodeURIComponent(keyword.trim())

    return `${normalizedBaseUrl}/search?sb=${query}`
  }

  const api = {
    DEFAULT_BASE_URL,
    STORAGE_KEY,
    normalizeBaseUrl,
    buildSearchUrl,
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.MukakuSearch = api
  }

  if (typeof module !== 'undefined') {
    module.exports = api
  }
})()
```

- [ ] **Step 4: 运行验证脚本，确认通过**

Run: `node extensions/mukaku-search/_verify.js`
Expected: 输出 `all passed`

- [ ] **Step 5: 删除临时验证脚本**

Run: `rm extensions/mukaku-search/_verify.js`

- [ ] **Step 6: 提交**

```bash
git add extensions/mukaku-search/search-url.js
git commit -m "refactor: 提取 mukaku-search 的 search-url 模块"
```

---

### Task 2: background.js / popup.js / popup.html / manifest 接入 search-url.js

**Files:**
- Modify: `extensions/mukaku-search/background.js`（改写）
- Modify: `extensions/mukaku-search/popup.js`（改写）
- Modify: `extensions/mukaku-search/popup.html`（加 search-url.js script）
- Modify: `extensions/mukaku-search/manifest.json`（仅升 version）

**Interfaces:**
- Consumes: `globalThis.MukakuSearch`（`background.js` 经 `importScripts` 注入；`popup.js` 经 `popup.html` 先加载 `search-url.js` 获得）

- [ ] **Step 1: 改写 background.js**

将 `extensions/mukaku-search/background.js` 整体替换为：

```js
importScripts('search-url.js')

const MENU_ID = 'search-mukaku'

// ========== 右键菜单 ==========
chrome.runtime.onInstalled.addListener(() => {
  updateContextMenu()
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[globalThis.MukakuSearch.STORAGE_KEY]) {
    updateContextMenu()
  }
})

function updateContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: '在不太灵搜索"%s"',
      contexts: ['selection'],
    })
  })
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText) {
    return
  }

  const keyword = info.selectionText.trim()

  if (!keyword) {
    return
  }

  const data = await chrome.storage.local.get(globalThis.MukakuSearch.STORAGE_KEY)
  const baseUrl = data[globalThis.MukakuSearch.STORAGE_KEY] || globalThis.MukakuSearch.DEFAULT_BASE_URL
  const url = globalThis.MukakuSearch.buildSearchUrl(baseUrl, keyword)

  chrome.tabs.create({ url })
})
```

- [ ] **Step 2: 改写 popup.js**

将 `extensions/mukaku-search/popup.js` 整体替换为：

```js
const mukakuSearch = globalThis.MukakuSearch
const baseUrlInput = document.getElementById('baseUrlInput')
const saveBtn = document.getElementById('saveBtn')
const resetBtn = document.getElementById('resetBtn')
const statusEl = document.getElementById('status')

// 加载当前设置
chrome.storage.local.get(mukakuSearch.STORAGE_KEY, (data) => {
  baseUrlInput.value = data[mukakuSearch.STORAGE_KEY] || mukakuSearch.DEFAULT_BASE_URL
})

// 保存
saveBtn.addEventListener('click', () => {
  const inputUrl = baseUrlInput.value.trim()

  if (!inputUrl) {
    showStatus('请输入搜索主页地址', 'error')
    return
  }

  const url = mukakuSearch.normalizeBaseUrl(inputUrl)
  baseUrlInput.value = url

  chrome.storage.local.set({ [mukakuSearch.STORAGE_KEY]: url }, () => {
    showStatus('已保存', 'success')
  })
})

// 恢复默认
resetBtn.addEventListener('click', () => {
  baseUrlInput.value = mukakuSearch.DEFAULT_BASE_URL
  chrome.storage.local.set({ [mukakuSearch.STORAGE_KEY]: mukakuSearch.DEFAULT_BASE_URL }, () => {
    showStatus('已恢复默认', 'success')
  })
})

function showStatus(text, type) {
  statusEl.textContent = text
  statusEl.className = `status ${type}`
  statusEl.classList.remove('hidden')
  setTimeout(() => statusEl.classList.add('hidden'), 2000)
}
```

- [ ] **Step 3: 改 popup.html 加载 search-url.js**

在 `<script src="popup.js"></script>` 前加 `<script src="search-url.js"></script>`。整体替换为：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="container">
    <h3>不太灵 - 搜索主页设置</h3>
    <p class="hint">不太灵域名经常变更，在此修改搜索主页地址</p>
    <div class="form-row">
      <input type="text" id="baseUrlInput" placeholder="https://web2.mukaku.com">
      <button id="saveBtn">保存</button>
    </div>
    <div id="status" class="status hidden"></div>
    <div class="actions">
      <button id="resetBtn" class="link-btn">恢复默认</button>
    </div>
  </div>
  <script src="search-url.js"></script>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 4: 升 manifest version**

将 `extensions/mukaku-search/manifest.json` 整体替换为（仅 `version` 改 `1.1.0`，其余不变）：

```json
{
  "manifest_version": 3,
  "name": "Mukaku Search",
  "version": "1.1.0",
  "description": "右键选中文字，在不太灵搜索磁力链接，支持自定义搜索主页",
  "permissions": ["contextMenus", "storage"],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 5: 浏览器验证端到端**

1. `chrome://extensions/` 刷新 Mukaku Search
2. 右键选中文字（如"三体"）→ "在不太灵搜索" → 确认跳转 `https://web2.mukaku.com/search?sb=三体`
3. 点扩展图标 → 设置页，输入框默认显示 `https://web2.mukaku.com`
4. 改成 `https://web2.mukaku2.com` → 保存 → "已保存" → 右键搜索用新地址 → 恢复默认 → 回到 `https://web2.mukaku.com`
5. 输入框清空 → 保存 → 确认"请输入搜索主页地址"错误，不写入
6. 输入 `web2.mukaku.com`（无协议）→ 保存 → 确认输入框自动变成 `https://web2.mukaku.com`
7. 现有用户验证：若之前配过自定义地址，刷新后设置页应显示已配地址且右键搜索仍用它（STORAGE_KEY 不变）
8. Service Worker 控制台与 popup 控制台均无报错

- [ ] **Step 6: 提交**

```bash
git add extensions/mukaku-search/background.js extensions/mukaku-search/popup.js extensions/mukaku-search/popup.html extensions/mukaku-search/manifest.json
git commit -m "refactor: mukaku-search 接入 search-url 模块"
```

---

### Task 3: 同步 README.md 与 CLAUDE.md 目录结构

**Files:**
- Modify: `README.md`（1 处：mukaku 目录结构加 search-url.js）
- Modify: `CLAUDE.md`（1 处：mukaku 目录结构加 search-url.js）

**说明：** mukaku 在搜索 URL 表、权限表、可配置章节均已正确列出，内容不变，仅目录结构需补 `search-url.js`。

- [ ] **Step 1: README.md mukaku 目录结构块**

old:
```
    ├── mukaku-search/           # 不太灵 — 弹窗 + 域名配置
    │   ├── manifest.json
    │   ├── background.js
    │   ├── popup.html / js / css
    │   └── icons/
```
new:
```
    ├── mukaku-search/           # 不太灵 — 弹窗 + 域名配置
    │   ├── manifest.json
    │   ├── background.js
    │   ├── search-url.js
    │   ├── popup.html / js / css
    │   └── icons/
```

- [ ] **Step 2: CLAUDE.md mukaku 目录结构块**

old:
```
│   ├── mukaku-search/           # 不太灵搜索扩展（右键搜索，支持自定义搜索主页）
│   │   ├── manifest.json
│   │   ├── background.js
│   │   ├── popup.html/js/css
│   │   └── icons/
```
new:
```
│   ├── mukaku-search/           # 不太灵搜索扩展（右键搜索，支持自定义搜索主页）
│   │   ├── manifest.json
│   │   ├── background.js
│   │   ├── search-url.js
│   │   ├── popup.html/js/css
│   │   └── icons/
```

- [ ] **Step 3: 提交**

```bash
git add README.md CLAUDE.md
git commit -m "docs: 同步 mukaku-search 目录结构"
```