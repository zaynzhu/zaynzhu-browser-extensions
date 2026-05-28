# KuakeQ Search 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 KuakeQ Search 右键搜索扩展，支持自定义搜索主页

**Architecture:** 仿照 mukaku-search 模式——background.js 处理右键菜单和搜索逻辑，popup 提供域名配置界面，chrome.storage.local 存储用户自定义域名。核心区别在搜索 URL 编码规则：encodeURIComponent 后将 `%` 替换为 `_`，拼接到 `/search-{encoded}-1-1.htm`。

**Tech Stack:** Chrome Manifest V3, 纯原生 JS，零依赖

---

### Task 1: 创建 manifest.json

**Files:**
- Create: `extensions/kuakeq-search/manifest.json`

- [ ] **Step 1: 创建目录和 manifest.json**

```json
{
  "manifest_version": 3,
  "name": "KuakeQ Search",
  "version": "1.0.0",
  "description": "右键选中文字，在夸客网搜索磁力链接，支持自定义搜索主页",
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

- [ ] **Step 2: Commit**

```bash
git add extensions/kuakeq-search/manifest.json
git commit -m "feat: 添加 kuakeq-search manifest.json"
```

---

### Task 2: 创建 background.js

**Files:**
- Create: `extensions/kuakeq-search/background.js`

- [ ] **Step 1: 编写 background.js**

```javascript
const DEFAULT_BASE_URL = 'https://www.kuakeq.com'

// ========== 右键菜单 ==========
chrome.runtime.onInstalled.addListener(async () => {
  const { kuakeqBaseUrl } = await chrome.storage.local.get('kuakeqBaseUrl')
  const baseUrl = kuakeqBaseUrl || DEFAULT_BASE_URL
  updateContextMenu(baseUrl)
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.kuakeqBaseUrl) {
    updateContextMenu(changes.kuakeqBaseUrl.newValue || DEFAULT_BASE_URL)
  }
})

function updateContextMenu(baseUrl) {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'search-kuakeq',
      title: '在KuakeQ搜索"%s"',
      contexts: ['selection'],
    })
  })
}

// ========== 搜索逻辑 ==========
function encodeQuery(keyword) {
  return encodeURIComponent(keyword).replace(/%/g, '_')
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'search-kuakeq' && info.selectionText) {
    const { kuakeqBaseUrl } = await chrome.storage.local.get('kuakeqBaseUrl')
    const baseUrl = kuakeqBaseUrl || DEFAULT_BASE_URL
    const encoded = encodeQuery(info.selectionText.trim())
    const url = `${baseUrl}/search-${encoded}-1-1.htm`
    chrome.tabs.create({ url })
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add extensions/kuakeq-search/background.js
git commit -m "feat: 添加 kuakeq-search 右键菜单和搜索逻辑"
```

---

### Task 3: 创建 popup 界面

**Files:**
- Create: `extensions/kuakeq-search/popup.html`
- Create: `extensions/kuakeq-search/popup.js`
- Create: `extensions/kuakeq-search/popup.css`

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
    <h3>KuakeQ - 搜索主页设置</h3>
    <p class="hint">KuakeQ 域名可能变更，在此修改搜索主页地址</p>
    <div class="form-row">
      <input type="text" id="baseUrlInput" placeholder="https://www.kuakeq.com">
      <button id="saveBtn">保存</button>
    </div>
    <div id="status" class="status hidden"></div>
    <div class="actions">
      <button id="resetBtn" class="link-btn">恢复默认</button>
    </div>
  </div>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: 创建 popup.js**

```javascript
const DEFAULT_BASE_URL = 'https://www.kuakeq.com'

const baseUrlInput = document.getElementById('baseUrlInput')
const saveBtn = document.getElementById('saveBtn')
const resetBtn = document.getElementById('resetBtn')
const statusEl = document.getElementById('status')

// 加载当前设置
chrome.storage.local.get('kuakeqBaseUrl', (data) => {
  baseUrlInput.value = data.kuakeqBaseUrl || DEFAULT_BASE_URL
})

// 保存
saveBtn.addEventListener('click', () => {
  let url = baseUrlInput.value.trim().replace(/\/+$/, '')
  if (!url) {
    showStatus('请输入搜索主页地址', 'error')
    return
  }
  if (!/^https?:\/\//.test(url)) {
    url = 'https://' + url
    baseUrlInput.value = url
  }
  chrome.storage.local.set({ kuakeqBaseUrl: url }, () => {
    showStatus('已保存', 'success')
  })
})

// 恢复默认
resetBtn.addEventListener('click', () => {
  baseUrlInput.value = DEFAULT_BASE_URL
  chrome.storage.local.set({ kuakeqBaseUrl: DEFAULT_BASE_URL }, () => {
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

- [ ] **Step 3: 创建 popup.css**

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  width: 320px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  color: #333;
  background: #f8f9fa;
}

.container {
  padding: 16px;
}

h3 {
  font-size: 14px;
  margin-bottom: 4px;
}

.hint {
  font-size: 11px;
  color: #888;
  margin-bottom: 10px;
}

.form-row {
  display: flex;
  gap: 8px;
}

#baseUrlInput {
  flex: 1;
  padding: 7px 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 12px;
  font-family: monospace;
  outline: none;
  transition: border-color 0.2s;
}

#baseUrlInput:focus {
  border-color: #4a90d9;
}

#saveBtn {
  padding: 7px 14px;
  background: #4a90d9;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
}

#saveBtn:hover {
  background: #3a7bc8;
}

.status {
  margin-top: 8px;
  padding: 6px;
  border-radius: 4px;
  text-align: center;
  font-size: 12px;
}

.status.success {
  background: #e6f4ea;
  color: #137333;
}

.status.error {
  background: #fce8e6;
  color: #c5221f;
}

.hidden {
  display: none;
}

.actions {
  margin-top: 8px;
  text-align: right;
}

.link-btn {
  background: none;
  border: none;
  color: #4a90d9;
  cursor: pointer;
  font-size: 11px;
  padding: 2px 4px;
}

.link-btn:hover {
  text-decoration: underline;
}
```

- [ ] **Step 4: Commit**

```bash
git add extensions/kuakeq-search/popup.html extensions/kuakeq-search/popup.js extensions/kuakeq-search/popup.css
git commit -m "feat: 添加 kuakeq-search popup 域名配置界面"
```

---

### Task 4: 添加图标

**Files:**
- Create: `extensions/kuakeq-search/icons/icon16.png`
- Create: `extensions/kuakeq-search/icons/icon48.png`
- Create: `extensions/kuakeq-search/icons/icon128.png`

- [ ] **Step 1: 生成占位图标**

使用 mukaku-search 的图标作为临时占位，后续替换为正式图标。

```bash
mkdir -p extensions/kuakeq-search/icons
cp extensions/mukaku-search/icons/icon16.png extensions/kuakeq-search/icons/
cp extensions/mukaku-search/icons/icon48.png extensions/kuakeq-search/icons/
cp extensions/mukaku-search/icons/icon128.png extensions/kuakeq-search/icons/
```

- [ ] **Step 2: Commit**

```bash
git add extensions/kuakeq-search/icons/
git commit -m "feat: 添加 kuakeq-search 占位图标（复用 mukaku-search）"
```

---

### Task 5: 更新项目文档

**Files:**
- Modify: `CLAUDE.md` — 添加 kuakeq-search 到目录结构和搜索 URL 格式表
- Modify: `README.md` — 添加 kuakeq-search 说明

- [ ] **Step 1: 更新 CLAUDE.md**

在目录结构中 `imdb-search` 前添加：

```
│   ├── kuakeq-search/            # 夸客网搜索扩展（右键搜索磁力链接，支持自定义搜索主页）
│   │   ├── manifest.json
│   │   ├── background.js
│   │   ├── popup.html/js/css
│   │   └── icons/
```

在搜索 URL 格式表中添加：

```
| KuakeQ | `https://www.kuakeq.com/search-{encoded}-1-1.htm`（编码规则：`encodeURIComponent` 后 `%` → `_`） |
```

- [ ] **Step 2: 更新 README.md**

添加 kuakeq-search 扩展说明。

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: 更新项目文档，添加 kuakeq-search 扩展"
```