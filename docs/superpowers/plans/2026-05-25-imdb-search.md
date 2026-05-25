# IMDB 搜索扩展实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建一个支持中文搜索的 IMDB 搜索扩展，通过 TMDB API 将中文翻译为英文后跳转 IMDB

**Architecture:** 使用 background.js 处理右键菜单和 TMDB API 调用，popup.html 提供手动搜索界面，options.html 配置 API key。TMDB API 失败时降级为直接中文搜索。

**Tech Stack:** Chrome Manifest V3, Service Worker, TMDB API, chrome.storage

---

## 文件结构

```
extensions/imdb-search/
├── manifest.json        # 扩展配置
├── background.js        # 后台服务：右键菜单、TMDB API 调用
├── popup.html          # Popup 搜索界面
├── popup.js            # Popup 逻辑
├── popup.css           # Popup 样式
├── options.html        # 配置页面：API key 设置
├── options.js          # 配置页面逻辑
├── options.css         # 配置页面样式
└── icons/              # 扩展图标
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

### Task 1: 创建 manifest.json 和基础结构

**Files:**
- Create: `extensions/imdb-search/manifest.json`
- Create: `extensions/imdb-search/icons/` (目录)

- [ ] **Step 1: 创建 manifest.json**

```json
{
  "manifest_version": 3,
  "name": "IMDB Search",
  "version": "1.0.0",
  "description": "右键选中中文文字，在 IMDB 搜索电影（通过 TMDB API 翻译）",
  "permissions": ["contextMenus", "storage", "activeTab"],
  "host_permissions": ["https://api.themoviedb.org/*"],
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
  },
  "options_ui": {
    "page": "options.html",
    "open_in_tab": false
  }
}
```

- [ ] **Step 2: 创建 icons 目录**

```bash
mkdir -p extensions/imdb-search/icons
```

- [ ] **Step 3: 复制图标文件**

从现有扩展复制图标文件，或者创建占位图标：

```bash
# 如果有现成图标，复制过来
# 如果没有，创建占位文件（后续替换）
touch extensions/imdb-search/icons/icon16.png
touch extensions/imdb-search/icons/icon48.png
touch extensions/imdb-search/icons/icon128.png
```

- [ ] **Step 4: 提交**

```bash
cd "/Users/zaynzhu/code/claude code/project/zaynzhu-browser-extensions"
git add extensions/imdb-search/manifest.json extensions/imdb-search/icons/
git commit -m "feat: 创建 IMDB 搜索扩展基础结构"
```

---

### Task 2: 实现 background.js 核心逻辑

**Files:**
- Create: `extensions/imdb-search/background.js`

- [ ] **Step 1: 创建 background.js 基础框架**

```javascript
// imdb-search/background.js — 右键搜索 IMDB，通过 TMDB API 翻译中文

const TMDB_API_BASE = 'https://api.themoviedb.org/3'
const IMDB_SEARCH_URL = 'https://www.imdb.com/find/'
const REQUEST_TIMEOUT = 10000

// ========== 右键菜单 ==========
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'search-imdb',
    title: '在 IMDB 搜索"%s"',
    contexts: ['selection'],
  })
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'search-imdb' && info.selectionText) {
    const keyword = info.selectionText.trim()
    await searchIMDB(keyword)
  }
})

// ========== 消息处理（来自 popup） ==========
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SEARCH') {
    searchIMDB(message.keyword).then((result) => {
      sendResponse(result)
    })
    return true
  }
})

// ========== 搜索主流程 ==========
async function searchIMDB(keyword) {
  try {
    // 获取 API key
    const { tmdbApiKey } = await chrome.storage.local.get('tmdbApiKey')
    
    if (!tmdbApiKey) {
      // API key 未配置，直接用中文搜索
      const url = `${IMDB_SEARCH_URL}?q=${encodeURIComponent(keyword)}`
      chrome.tabs.create({ url })
      return { status: 'no_api_key', keyword }
    }
    
    // 调用 TMDB API 翻译
    const translated = await translateWithTMDB(keyword, tmdbApiKey)
    
    if (translated) {
      // 翻译成功，用英文搜索
      const url = `${IMDB_SEARCH_URL}?q=${encodeURIComponent(translated)}`
      chrome.tabs.create({ url })
      return { status: 'translated', keyword, translated }
    } else {
      // 翻译失败，用中文搜索
      const url = `${IMDB_SEARCH_URL}?q=${encodeURIComponent(keyword)}`
      chrome.tabs.create({ url })
      return { status: 'fallback', keyword }
    }
  } catch (error) {
    console.error('[imdb] 搜索失败:', error)
    // 出错时用中文搜索
    const url = `${IMDB_SEARCH_URL}?q=${encodeURIComponent(keyword)}`
    chrome.tabs.create({ url })
    return { status: 'error', keyword, error: error.message }
  }
}

// ========== TMDB API 调用 ==========
async function translateWithTMDB(keyword, apiKey) {
  try {
    const url = `${TMDB_API_BASE}/search/movie?query=${encodeURIComponent(keyword)}&language=zh-CN&api_key=${apiKey}`
    const response = await fetchWithTimeout(url)
    const data = await response.json()
    
    if (data.results && data.results.length > 0) {
      // 返回第一个结果的英文名
      return data.results[0].original_title
    }
    return null
  } catch (error) {
    console.error('[imdb] TMDB API 调用失败:', error)
    return null
  }
}

// ========== 网络请求 ==========
async function fetchWithTimeout(url, timeoutMs = REQUEST_TIMEOUT) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response
  } finally {
    clearTimeout(timer)
  }
}
```

- [ ] **Step 2: 验证代码语法**

```bash
cd "/Users/zaynzhu/code/claude code/project/zaynzhu-browser-extensions"
node -c extensions/imdb-search/background.js
```

Expected: 无输出（语法正确）

- [ ] **Step 3: 提交**

```bash
git add extensions/imdb-search/background.js
git commit -m "feat: 实现 background.js 核心逻辑"
```

---

### Task 3: 实现 Popup 搜索界面

**Files:**
- Create: `extensions/imdb-search/popup.html`
- Create: `extensions/imdb-search/popup.js`
- Create: `extensions/imdb-search/popup.css`

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
    <h3>IMDB 搜索</h3>
    <p class="hint">输入中文关键词，自动翻译后搜索 IMDB</p>
    <div class="search-bar">
      <input type="text" id="keywordInput" placeholder="输入电影名（中文）" autofocus>
      <button id="searchBtn">搜索</button>
    </div>
    <div id="status" class="status hidden"></div>
    <div class="actions">
      <a href="#" id="settingsLink">配置 API Key</a>
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
  width: 320px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  color: #333;
}

.container {
  padding: 16px;
}

h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
}

.hint {
  font-size: 12px;
  color: #666;
  margin-bottom: 12px;
}

.search-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.search-bar input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.search-bar input:focus {
  outline: none;
  border-color: #4a90d9;
}

.search-bar button {
  padding: 8px 16px;
  background: #4a90d9;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}

.search-bar button:hover {
  background: #357abd;
}

.search-bar button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.status {
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  margin-bottom: 12px;
}

.status.hidden {
  display: none;
}

.status.info {
  background: #e8f4fd;
  color: #1a73e8;
}

.status.success {
  background: #e8f5e9;
  color: #2e7d32;
}

.status.error {
  background: #fce4ec;
  color: #c62828;
}

.status.warning {
  background: #fff3e0;
  color: #ef6c00;
}

.actions {
  text-align: center;
}

.actions a {
  color: #4a90d9;
  text-decoration: none;
  font-size: 13px;
}

.actions a:hover {
  text-decoration: underline;
}
```

- [ ] **Step 3: 创建 popup.js**

```javascript
const keywordInput = document.getElementById('keywordInput')
const searchBtn = document.getElementById('searchBtn')
const statusEl = document.getElementById('status')
const settingsLink = document.getElementById('settingsLink')

// 搜索按钮
searchBtn.addEventListener('click', doSearch)
keywordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSearch()
})

// 配置链接
settingsLink.addEventListener('click', (e) => {
  e.preventDefault()
  chrome.runtime.openOptionsPage()
})

// 检查 API key 配置状态
chrome.storage.local.get('tmdbApiKey', (data) => {
  if (!data.tmdbApiKey) {
    showStatus('warning', '请先配置 TMDB API Key')
  }
})

async function doSearch() {
  const keyword = keywordInput.value.trim()
  if (!keyword) return
  
  searchBtn.disabled = true
  showStatus('info', '搜索中...')
  
  chrome.runtime.sendMessage({ type: 'SEARCH', keyword }, (result) => {
    searchBtn.disabled = false
    
    if (result.status === 'no_api_key') {
      showStatus('warning', '未配置 API Key，已用中文搜索')
    } else if (result.status === 'translated') {
      showStatus('success', `已翻译: ${result.translated}`)
    } else if (result.status === 'fallback') {
      showStatus('warning', '翻译失败，已用中文搜索')
    } else if (result.status === 'error') {
      showStatus('error', `搜索失败: ${result.error}`)
    }
  })
}

function showStatus(type, text) {
  statusEl.textContent = text
  statusEl.className = `status ${type}`
  statusEl.classList.remove('hidden')
}
```

- [ ] **Step 4: 验证代码语法**

```bash
cd "/Users/zaynzhu/code/claude code/project/zaynzhu-browser-extensions"
node -c extensions/imdb-search/popup.js
```

Expected: 无输出（语法正确）

- [ ] **Step 5: 提交**

```bash
git add extensions/imdb-search/popup.html extensions/imdb-search/popup.js extensions/imdb-search/popup.css
git commit -m "feat: 实现 Popup 搜索界面"
```

---

### Task 4: 实现 Options 配置页面

**Files:**
- Create: `extensions/imdb-search/options.html`
- Create: `extensions/imdb-search/options.js`
- Create: `extensions/imdb-search/options.css`

- [ ] **Step 1: 创建 options.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="options.css">
</head>
<body>
  <div class="container">
    <h3>IMDB 搜索设置</h3>
    <p class="hint">配置 TMDB API Key 以启用中文翻译功能</p>
    
    <div class="form-group">
      <label for="apiKeyInput">TMDB API Key</label>
      <div class="input-row">
        <input type="text" id="apiKeyInput" placeholder="输入你的 TMDB API Key">
        <button id="saveBtn">保存</button>
      </div>
      <p class="help-text">
        从 <a href="https://www.themoviedb.org/settings/api" target="_blank">TMDB 官网</a> 获取 API Key
      </p>
    </div>
    
    <div class="form-group">
      <button id="testBtn" class="secondary">测试 API Key</button>
      <div id="testResult" class="status hidden"></div>
    </div>
    
    <div id="status" class="status hidden"></div>
  </div>
  <script src="options.js"></script>
</body>
</html>
```

- [ ] **Step 2: 创建 options.css**

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  width: 400px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  color: #333;
}

.container {
  padding: 20px;
}

h3 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}

.hint {
  font-size: 13px;
  color: #666;
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 20px;
}

label {
  display: block;
  font-weight: 500;
  margin-bottom: 8px;
}

.input-row {
  display: flex;
  gap: 8px;
}

.input-row input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.input-row input:focus {
  outline: none;
  border-color: #4a90d9;
}

.input-row button {
  padding: 10px 20px;
  background: #4a90d9;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}

.input-row button:hover {
  background: #357abd;
}

.help-text {
  font-size: 12px;
  color: #888;
  margin-top: 8px;
}

.help-text a {
  color: #4a90d9;
  text-decoration: none;
}

.help-text a:hover {
  text-decoration: underline;
}

button.secondary {
  padding: 10px 20px;
  background: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}

button.secondary:hover {
  background: #e8e8e8;
}

button.secondary:disabled {
  background: #f5f5f5;
  color: #999;
  cursor: not-allowed;
}

.status {
  padding: 10px 12px;
  border-radius: 4px;
  font-size: 13px;
  margin-top: 12px;
}

.status.hidden {
  display: none;
}

.status.success {
  background: #e8f5e9;
  color: #2e7d32;
}

.status.error {
  background: #fce4ec;
  color: #c62828;
}

.status.info {
  background: #e8f4fd;
  color: #1a73e8;
}
```

- [ ] **Step 3: 创建 options.js**

```javascript
const apiKeyInput = document.getElementById('apiKeyInput')
const saveBtn = document.getElementById('saveBtn')
const testBtn = document.getElementById('testBtn')
const testResult = document.getElementById('testResult')
const statusEl = document.getElementById('status')

const TMDB_API_BASE = 'https://api.themoviedb.org/3'

// 加载已保存的 API key
chrome.storage.local.get('tmdbApiKey', (data) => {
  if (data.tmdbApiKey) {
    apiKeyInput.value = data.tmdbApiKey
  }
})

// 保存按钮
saveBtn.addEventListener('click', () => {
  const apiKey = apiKeyInput.value.trim()
  if (!apiKey) {
    showStatus('error', '请输入 API Key')
    return
  }
  
  chrome.storage.local.set({ tmdbApiKey: apiKey }, () => {
    showStatus('success', '已保存')
  })
})

// 测试按钮
testBtn.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim()
  if (!apiKey) {
    showTestResult('error', '请先输入 API Key')
    return
  }
  
  testBtn.disabled = true
  testBtn.textContent = '测试中...'
  showTestResult('info', '正在测试...')
  
  try {
    const url = `${TMDB_API_BASE}/configuration?api_key=${apiKey}`
    const response = await fetch(url)
    
    if (response.ok) {
      showTestResult('success', 'API Key 有效')
    } else {
      const data = await response.json()
      showTestResult('error', `API Key 无效: ${data.status_message || '未知错误'}`)
    }
  } catch (error) {
    showTestResult('error', `测试失败: ${error.message}`)
  } finally {
    testBtn.disabled = false
    testBtn.textContent = '测试 API Key'
  }
})

function showStatus(type, text) {
  statusEl.textContent = text
  statusEl.className = `status ${type}`
  statusEl.classList.remove('hidden')
  setTimeout(() => statusEl.classList.add('hidden'), 3000)
}

function showTestResult(type, text) {
  testResult.textContent = text
  testResult.className = `status ${type}`
  testResult.classList.remove('hidden')
}
```

- [ ] **Step 4: 验证代码语法**

```bash
cd "/Users/zaynzhu/code/claude code/project/zaynzhu-browser-extensions"
node -c extensions/imdb-search/options.js
```

Expected: 无输出（语法正确）

- [ ] **Step 5: 提交**

```bash
git add extensions/imdb-search/options.html extensions/imdb-search/options.js extensions/imdb-search/options.css
git commit -m "feat: 实现 Options 配置页面"
```

---

### Task 5: 图标处理和最终提交

**Files:**
- Modify: `extensions/imdb-search/icons/icon16.png`
- Modify: `extensions/imdb-search/icons/icon48.png`
- Modify: `extensions/imdb-search/icons/icon128.png`

- [ ] **Step 1: 准备图标文件**

从现有扩展复制图标，或者使用 ImageMagick 创建简单图标：

```bash
# 方法 1: 从现有扩展复制
cp extensions/xcili-search/icons/icon16.png extensions/imdb-search/icons/
cp extensions/xcili-search/icons/icon48.png extensions/imdb-search/icons/
cp extensions/xcili-search/icons/icon128.png extensions/imdb-search/icons/

# 方法 2: 使用 ImageMagick 创建（如果安装了）
# convert -size 16x16 xc:skyblue -font Helvetica -pointsize 12 -fill white -gravity center -annotate 0 "IM" extensions/imdb-search/icons/icon16.png
# convert -size 48x48 xc:skyblue -font Helvetica -pointsize 36 -fill white -gravity center -annotate 0 "IM" extensions/imdb-search/icons/icon48.png
# convert -size 128x128 xc:skyblue -font Helvetica -pointsize 96 -fill white -gravity center -annotate 0 "IM" extensions/imdb-search/icons/icon128.png
```

- [ ] **Step 2: 验证所有文件存在**

```bash
cd "/Users/zaynzhu/code/claude code/project/zaynzhu-browser-extensions"
ls -la extensions/imdb-search/
ls -la extensions/imdb-search/icons/
```

Expected: 看到所有文件

- [ ] **Step 3: 最终提交**

```bash
cd "/Users/zaynzhu/code/claude code/project/zaynzhu-browser-extensions"
git add extensions/imdb-search/
git commit -m "feat: 完成 IMDB 搜索扩展"
```

---

## 自我审查

### 1. 规范覆盖检查

✅ 所有规范要求都已覆盖：
- 右键搜索：Task 2
- Popup 搜索：Task 3
- 中文转英文：Task 2 (translateWithTMDB)
- 直接跳转：Task 2 (searchIMDB)
- 配置存储：Task 4
- 错误处理：Task 2

### 2. 占位符扫描

✅ 无占位符：
- 无 "TBD"、"TODO"
- 所有代码完整
- 所有命令具体

### 3. 类型一致性检查

✅ 所有函数名、变量名一致：
- `searchIMDB` 在 Task 2 和 Task 3 中一致
- `translateWithTMDB` 在 Task 2 中定义
- `tmdbApiKey` 在所有任务中一致

---

## 执行选项

**计划完成并保存到 `docs/superpowers/plans/2026-05-25-imdb-search.md`。两种执行方式：**

**1. Subagent-Driven（推荐）** - 每个任务分发一个新子代理，任务间审查，快速迭代

**2. Inline Execution** - 在当前会话中使用 executing-plans 执行任务，批量执行带检查点

**选择哪种方式？**
