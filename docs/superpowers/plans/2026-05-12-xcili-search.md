# xcili-search 扩展实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建独立的 Chrome 扩展，支持右键/手动输入番号搜索 xcili.com 磁力链接，展示过滤后的最优 1 条结果。

**Architecture:** MV3 扩展，background.js 包含搜索、HTML 解析、过滤逻辑（从 av-pipeline 移植），popup 弹窗展示结果。右键菜单发消息给 background，background 搜索后存 storage，popup 读取展示。

**Tech Stack:** Chrome MV3, Service Worker, 原生 JS, chrome.storage API

---

## 文件结构

```
xcili-search/
├── manifest.json      # MV3 扩展清单
├── background.js      # Service Worker: 右键菜单 + 搜索 + 解析 + 过滤
├── popup.html         # 弹窗 UI 结构
├── popup.js           # 弹窗逻辑：输入 + 搜索 + 展示
├── popup.css          # 弹窗样式
└── icons/             # icon16.png, icon48.png, icon128.png
```

---

### Task 1: 创建目录和 manifest.json

**Files:**
- Create: `xcili-search/manifest.json`

- [ ] **Step 1: 创建扩展目录**

```bash
mkdir -p xcili-search/icons
```

- [ ] **Step 2: 创建 manifest.json**

```json
{
  "manifest_version": 3,
  "name": "XCili Search",
  "version": "1.0.0",
  "description": "右键选中番号或手动输入，在无极磁力搜索磁力链接",
  "permissions": ["contextMenus", "activeTab"],
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

- [ ] **Step 3: 复制图标**

从 hdhive-search 复制图标作为占位（后续可替换）：

```bash
cp hdhive-search/icons/icon16.png xcili-search/icons/
cp hdhive-search/icons/icon48.png xcili-search/icons/
cp hdhive-search/icons/icon128.png xcili-search/icons/
```

- [ ] **Step 4: Commit**

```bash
git add xcili-search/
git commit -m "feat: xcili-search 扩展目录和 manifest.json"
```

---

### Task 2: 创建 background.js — 搜索核心

**Files:**
- Create: `xcili-search/background.js`

从 av-pipeline 移植搜索逻辑，内联 HtmlParser、SizeParser、Filter，简化为单文件。新增右键菜单和消息处理。

- [ ] **Step 1: 创建 background.js**

```javascript
// xcili-search/background.js — 搜索 xcili.com，解析 HTML，过滤合集，取最优结果

const XCILI_BASE = 'https://xcili.com'
const REQUEST_TIMEOUT = 10000

// ========== 右键菜单 ==========
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'search-xcili',
    title: '在无极磁力搜索"%s"',
    contexts: ['selection'],
  })
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'search-xcili' && info.selectionText) {
    const code = info.selectionText.trim()
    doSearch(code).then((result) => {
      chrome.storage.local.set({ lastSearch: { code, result } })
    })
  }
})

// ========== 消息处理（来自 popup） ==========
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SEARCH') {
    doSearch(message.code).then((result) => {
      chrome.storage.local.set({ lastSearch: { code: message.code, result } })
      sendResponse(result)
    })
    return true
  }
  if (message.type === 'GET_LAST') {
    chrome.storage.local.get('lastSearch').then((data) => {
      sendResponse(data.lastSearch || null)
    })
    return true
  }
})

// ========== 搜索主流程 ==========
async function doSearch(code) {
  try {
    const searchUrl = `${XCILI_BASE}/search?q=${encodeURIComponent(code)}`
    const html = await fetchWithTimeout(searchUrl)
    const results = parseSearchResults(html)

    if (results.length === 0) {
      return { status: 'not_found', code }
    }

    const filterResult = filterResults(results, code)
    const best = filterResult.best

    if (!best) {
      return { status: 'not_found', code, excluded: filterResult.excluded.length }
    }

    // 获取详情页磁力链接
    const detail = await fetchMagnetDetail(best.detailUrl)

    return {
      status: 'confirmed',
      code,
      title: detail.title || best.title || best.fileName,
      size: detail.size || best.size,
      sizeBytes: parseSize(detail.size || best.size),
      magnet: detail.magnet,
      date: detail.date,
      hash: detail.hash,
      detailUrl: best.detailUrl,
    }
  } catch (error) {
    return { status: 'error', code, error: error.message }
  }
}

// ========== 网络请求 ==========
async function fetchWithTimeout(url, timeoutMs = REQUEST_TIMEOUT) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.text()
  } finally {
    clearTimeout(timer)
  }
}

// ========== HTML 解析（移植自 av-pipeline html-parser.js） ==========
function parseSearchResults(html) {
  const results = []
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const row = rowMatch[1]

    const linkMatch = row.match(/<a[^>]+href="(\/![^"]+)"/)
    if (!linkMatch) continue
    const detailUrl = linkMatch[1]

    let fileName = ''
    const sampleMatch = row.match(/<p[^>]+class="sample"[^>]*>([\s\S]*?)<\/p>/)
    if (sampleMatch) {
      fileName = sampleMatch[1]
        .replace(/<[^>]+>/g, '')
        .replace(/\[email\]/g, '')
        .replace(/^\S+@/, '')
        .trim()
    }

    let linkText = ''
    const linkInnerMatch = row.match(/<a[^>]+href="\/![^"]*"([\s\S]*?)<\/a>/)
    if (linkInnerMatch) {
      linkText = linkInnerMatch[1]
        .replace(/<p[\s\S]*?<\/p>/g, '')
        .replace(/<[^>]+>/g, '')
        .trim()
    }

    let title = ''
    const titleMatch = row.match(/<b[^>]*>([\s\S]*?)<\/b>/)
    if (titleMatch) {
      title = titleMatch[1].replace(/<[^>]+>/g, '').trim()
    }

    let size = ''
    const sizeMatch = row.match(/<td[^>]+class="[^"]*td-size[^"]*"[^>]*>([\s\S]*?)<\/td>/)
    if (sizeMatch) {
      size = sizeMatch[1].replace(/<[^>]+>/g, '').trim()
    }

    results.push({ title, fileName, linkText, size, detailUrl })
  }

  return results
}

function parseDetailPage(html) {
  let magnet = null
  const magnetInputMatch = html.match(/<input[^>]+id="input-magnet"[^>]*value="([^"]+)"/)
  if (magnetInputMatch) {
    magnet = magnetInputMatch[1]
  }
  if (!magnet) {
    const magnetLinkMatch = html.match(/href="(magnet:[^"]+)"/)
    if (magnetLinkMatch) magnet = magnetLinkMatch[1]
  }

  let title = ''
  const titleMatch = html.match(/<h2[^>]+class="magnet-title"[^>]*>([\s\S]*?)<\/h2>/)
  if (titleMatch) title = titleMatch[1].replace(/<[^>]+>/g, '').trim()

  let size = '', date = '', hash = ''
  const dtRegex = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi
  let dtMatch
  while ((dtMatch = dtRegex.exec(html)) !== null) {
    const label = dtMatch[1].replace(/<[^>]+>/g, '').trim()
    const value = dtMatch[2].replace(/<[^>]+>/g, '').trim()
    if (label.includes('文件大小')) size = value
    else if (label.includes('发布日期')) date = value
    else if (label.includes('种子特征码') || label.includes('特征码')) hash = value
  }

  return { magnet, title, size, date, hash }
}

async function fetchMagnetDetail(detailUrl) {
  const url = detailUrl.startsWith('http') ? detailUrl : `${XCILI_BASE}${detailUrl}`
  const html = await fetchWithTimeout(url)
  return parseDetailPage(html)
}

// ========== 大小解析（移植自 av-pipeline size-parser.js） ==========
const SIZE_UNITS = { 'B': 1, 'KB': 1024, 'MB': 1024 ** 2, 'GB': 1024 ** 3, 'TB': 1024 ** 4 }

function parseSize(sizeStr) {
  if (!sizeStr || typeof sizeStr !== 'string') return null
  const match = sizeStr.trim().match(/^([\d.]+)\s*(B|KB|MB|GB|TB)$/i)
  if (!match) return null
  const value = parseFloat(match[1])
  const unit = match[2].toUpperCase()
  if (isNaN(value) || !SIZE_UNITS[unit]) return null
  return Math.round(value * SIZE_UNITS[unit])
}

// ========== 过滤逻辑（移植自 av-pipeline filter.js） ==========
const EXCLUDE_KEYWORDS = /合集|精選|精选|部合集|pack|专辑|連發|连发|纯净|完整版|特供|解说|破坏版/i
const EXCLUDE_DATE_PATTERN = /^\d{1,2}月\d{1,2}日[-—]/
const EXCLUDE_COUNT_PATTERN = /x\d+部?/i
const EXCLUDE_COUNT_DESC = /[一二三四五六七八九十百]+部/
const EXCLUDE_SITE_PATTERN = /\[.*\]|BT-|\.com@|wi92|btt\.com/i
const SUSPECT_KEYWORDS = /part\s*\d+|第\d+部/i
const SUSPECT_SIZE_BYTES = 50 * 1024 * 1024 * 1024
const HD_MARKERS = /4K|FHD|60fps/i
const CN_MARKERS = /[-_]C$|[-_]ch$|[-_]CH$/i
const UC_MARKERS = /[-_]UC$|uncensored/i

function shouldExclude(text) {
  return EXCLUDE_KEYWORDS.test(text) ||
    EXCLUDE_DATE_PATTERN.test(text) ||
    EXCLUDE_COUNT_PATTERN.test(text) ||
    EXCLUDE_COUNT_DESC.test(text) ||
    EXCLUDE_SITE_PATTERN.test(text)
}

function shouldMarkSuspect(text, sizeBytes) {
  return SUSPECT_KEYWORDS.test(text) || sizeBytes >= SUSPECT_SIZE_BYTES
}

function getCodeMatchScore(result, searchCode) {
  if (!searchCode) return 0
  const text = ((result.title || '') + (result.fileName || '')).toUpperCase()
  const code = searchCode.toUpperCase()
  if (text.includes(code)) return 100
  const codeParts = code.split('-')
  if (codeParts.length === 2 && text.includes(codeParts[1])) return 50
  return 0
}

function filterResults(results, searchCode) {
  const excluded = []
  const candidates = []

  for (const result of results) {
    const fullText = (result.title || '') + ' ' + (result.fileName || '') + ' ' + (result.linkText || '')
    const sizeBytes = parseSize(result.size) || 0

    if (shouldExclude(fullText)) {
      excluded.push({ ...result, reason: '合集/打包' })
      continue
    }
    if (shouldMarkSuspect(fullText, sizeBytes)) {
      excluded.push({ ...result, reason: '疑似合集' })
      continue
    }
    candidates.push({ ...result, sizeBytes })
  }

  candidates.sort((a, b) => {
    const aMatch = getCodeMatchScore(a, searchCode)
    const bMatch = getCodeMatchScore(b, searchCode)
    if (aMatch !== bMatch) return bMatch - aMatch
    return (b.sizeBytes || 0) - (a.sizeBytes || 0)
  })

  // 选择最优
  let best = null
  let bestScore = -1
  for (const c of candidates.slice(0, 3)) {
    let score = getCodeMatchScore(c, searchCode) * 10
    const text = (c.title || '') + (c.fileName || '')
    if (CN_MARKERS.test(text)) score += 100
    if (UC_MARKERS.test(text)) score += 50
    if (HD_MARKERS.test(text)) score += 20
    score += (c.sizeBytes || 0) / (1024 ** 3)
    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }

  return { best, excluded, candidates }
}
```

- [ ] **Step 2: 验证语法**

```bash
node -c xcili-search/background.js
```

Expected: 无输出（语法正确）

- [ ] **Step 3: Commit**

```bash
git add xcili-search/background.js
git commit -m "feat: background.js 搜索核心逻辑（移植自 av-pipeline）"
```

---

### Task 3: 创建 popup UI

**Files:**
- Create: `xcili-search/popup.html`
- Create: `xcili-search/popup.css`
- Create: `xcili-search/popup.js`

- [ ] **Step 1: 创建 popup.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="container">
    <div class="search-bar">
      <input type="text" id="codeInput" placeholder="输入番号，如 ABP-123" autofocus>
      <button id="searchBtn">搜索</button>
    </div>

    <div id="status" class="status hidden"></div>

    <div id="result" class="result hidden">
      <div class="result-header">
        <span class="result-title" id="resultTitle"></span>
        <span class="result-size" id="resultSize"></span>
      </div>
      <div class="result-meta">
        <span id="resultDate"></span>
        <span id="resultHash"></span>
      </div>
      <div class="magnet-box">
        <input type="text" id="magnetInput" readonly>
        <button id="copyBtn" title="复制磁力链接">复制</button>
      </div>
    </div>
  </div>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: 创建 popup.css**

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  width: 400px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  color: #333;
  background: #f8f9fa;
}

.container {
  padding: 12px;
}

.search-bar {
  display: flex;
  gap: 8px;
}

#codeInput {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}

#codeInput:focus {
  border-color: #4a90d9;
}

#searchBtn {
  padding: 8px 16px;
  background: #4a90d9;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
}

#searchBtn:hover {
  background: #3a7bc8;
}

#searchBtn:disabled {
  background: #aaa;
  cursor: not-allowed;
}

.status {
  margin-top: 10px;
  padding: 8px;
  border-radius: 6px;
  text-align: center;
}

.status.loading {
  background: #e8f0fe;
  color: #4a90d9;
}

.status.error {
  background: #fce8e6;
  color: #c5221f;
}

.status.empty {
  background: #fef7e0;
  color: #b06000;
}

.hidden {
  display: none;
}

.result {
  margin-top: 12px;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 12px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.result-title {
  font-weight: 600;
  font-size: 13px;
  word-break: break-all;
  flex: 1;
}

.result-size {
  background: #e8f0fe;
  color: #4a90d9;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
}

.result-meta {
  margin-top: 8px;
  font-size: 11px;
  color: #888;
  display: flex;
  gap: 12px;
}

.magnet-box {
  margin-top: 10px;
  display: flex;
  gap: 6px;
}

#magnetInput {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 11px;
  font-family: monospace;
  background: #f5f5f5;
  color: #555;
}

#copyBtn {
  padding: 6px 12px;
  background: #34a853;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
}

#copyBtn:hover {
  background: #2d8e47;
}

#copyBtn.copied {
  background: #888;
}
```

- [ ] **Step 3: 创建 popup.js**

```javascript
const codeInput = document.getElementById('codeInput')
const searchBtn = document.getElementById('searchBtn')
const statusEl = document.getElementById('status')
const resultEl = document.getElementById('result')
const resultTitle = document.getElementById('resultTitle')
const resultSize = document.getElementById('resultSize')
const resultDate = document.getElementById('resultDate')
const resultHash = document.getElementById('resultHash')
const magnetInput = document.getElementById('magnetInput')
const copyBtn = document.getElementById('copyBtn')

// 加载上次搜索结果
chrome.runtime.sendMessage({ type: 'GET_LAST' }, (data) => {
  if (data?.result?.status === 'confirmed') {
    codeInput.value = data.code
    showResult(data.result)
  }
})

// 搜索按钮
searchBtn.addEventListener('click', doSearch)
codeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSearch()
})

// 复制按钮
copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(magnetInput.value).then(() => {
    copyBtn.textContent = '已复制'
    copyBtn.classList.add('copied')
    setTimeout(() => {
      copyBtn.textContent = '复制'
      copyBtn.classList.remove('copied')
    }, 1500)
  })
})

function doSearch() {
  const code = codeInput.value.trim()
  if (!code) return

  showStatus('loading', '搜索中...')
  resultEl.classList.add('hidden')
  searchBtn.disabled = true

  chrome.runtime.sendMessage({ type: 'SEARCH', code }, (result) => {
    searchBtn.disabled = false

    if (result.status === 'confirmed') {
      showResult(result)
    } else if (result.status === 'not_found') {
      showStatus('empty', '未找到结果')
    } else {
      showStatus('error', result.error || '搜索失败')
    }
  })
}

function showResult(result) {
  statusEl.classList.add('hidden')
  resultEl.classList.remove('hidden')

  resultTitle.textContent = result.title || '—'
  resultSize.textContent = result.size || '—'
  resultDate.textContent = result.date ? `发布: ${result.date}` : ''
  resultHash.textContent = result.hash ? `Hash: ${result.hash}` : ''
  magnetInput.value = result.magnet || ''
}

function showStatus(type, text) {
  statusEl.className = `status ${type}`
  statusEl.textContent = text
  statusEl.classList.remove('hidden')
}
```

- [ ] **Step 4: 验证所有文件语法**

```bash
node -c xcili-search/background.js && node -c xcili-search/popup.js && echo "语法正确"
```

- [ ] **Step 5: Commit**

```bash
git add xcili-search/popup.html xcili-search/popup.css xcili-search/popup.js
git commit -m "feat: popup UI — 搜索输入框 + 结果展示 + 磁力复制"
```

---

### Task 4: 更新 CLAUDE.md 和 README

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: 更新 CLAUDE.md 目录结构**

在目录结构中添加 xcili-search：

```
├── xcili-search/         # 无极磁力搜索扩展（右键/手动输入番号搜磁力）
│   ├── manifest.json
│   ├── background.js
│   ├── popup.html/js/css
│   └── icons/
```

在搜索 URL 格式表中添加：

| XCili | `https://xcili.com/search?q={keyword}` |

- [ ] **Step 2: 更新 README.md**

在功能表格中添加 xcili-search 扩展说明。

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: 添加 xcili-search 扩展文档"
```

---

### Task 5: 端到端测试

- [ ] **Step 1: 加载扩展**

`chrome://extensions` → 开发者模式 → 加载已解压的扩展程序 → 选择 `xcili-search` 目录

- [ ] **Step 2: 测试右键搜索**

1. 在任意网页选中一个番号（如 `SSIS-001`）
2. 右键 → "在无极磁力搜索"
3. 点击扩展图标，确认 popup 显示搜索结果（标题、大小、磁力、日期、hash）

- [ ] **Step 3: 测试手动输入**

1. 点击扩展图标打开 popup
2. 输入番号 → 点击搜索或按回车
3. 确认结果展示正确
4. 点击"复制"按钮，确认磁力链接已复制到剪贴板

- [ ] **Step 4: 测试错误情况**

1. 输入不存在的番号（如 `TEST-999999`），确认显示"未找到结果"
2. 断网后搜索，确认显示错误信息

- [ ] **Step 5: Commit 测试通过后的版本**

确认无问题后，升级版本号并提交。
