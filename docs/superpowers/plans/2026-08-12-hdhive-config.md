# HDHive 自定义搜索主页 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 hdhive-search 支持自定义搜索主页地址，与 jiaofu/subhd 等扩展保持一致。

**Architecture:** 照搬 subhd-search/jiaofu-search 的成熟模式——新增独立 `search-url.js`（IIFE 挂 `globalThis.HdhiveSearch`，兼容 `module.exports`），`background.js` 用 `importScripts` 引入并读 `chrome.storage.local`，新增 popup 设置页复用同一套 api。只配置站点主地址，搜索路径 `/search?query=…&type=multi&page=1` 固定。

**Tech Stack:** Chrome Manifest V3、纯原生 JS（零依赖）、chrome.storage.local、chrome.contextMenus、Node（仅用于验证 search-url.js 纯函数）

## Global Constraints

- Chrome Manifest V3，零依赖纯原生 JS
- 代码风格：JS 不用分号、2 空格缩进、camelCase、常量 UPPER_SNAKE_CASE、注释中文
- `search-url.js` 用 IIFE 挂 `globalThis.HdhiveSearch`，并兼容 `module.exports`（与 subhd-search/jiaofu-search 完全一致）
- `background.js` 用 `importScripts('search-url.js')` 引入
- `STORAGE_KEY = 'hdhiveBaseUrl'`，`DEFAULT_BASE_URL = 'https://hdhive.com'`
- 搜索路径固定：`/search?query=${encodeURIComponent(keyword.trim())}&type=multi&page=1`
- manifest `version` 最终升到 `1.1.0`
- commit 格式：`type: 中文描述`（type ∈ feat/docs）
- 浏览器验证：`chrome://extensions` 加载未打包扩展 `extensions/hdhive-search/`
- Node 验证 `search-url.js`：用临时脚本 `extensions/hdhive-search/_verify.js`，验证通过后删除，不提交、不引入测试框架

---

### Task 1: search-url.js（核心纯函数，Node TDD 验证）

**Files:**
- Create: `extensions/hdhive-search/search-url.js`
- Test（临时，验证后删除，不提交）: `extensions/hdhive-search/_verify.js`

**Interfaces:**
- Produces: `globalThis.HdhiveSearch` 与 `module.exports`，包含 `DEFAULT_BASE_URL`（string）、`STORAGE_KEY`（string）、`normalizeBaseUrl(baseUrl: string) => string`、`buildSearchUrl(baseUrl: string, keyword: string) => string`

- [ ] **Step 1: 写临时验证脚本（期望值先行）**

创建 `extensions/hdhive-search/_verify.js`：

```js
const assert = require('assert')
const api = require('./search-url.js')

assert.strictEqual(api.DEFAULT_BASE_URL, 'https://hdhive.com')
assert.strictEqual(api.STORAGE_KEY, 'hdhiveBaseUrl')

// normalizeBaseUrl：去尾斜杠
assert.strictEqual(api.normalizeBaseUrl('https://hdhive.com/'), 'https://hdhive.com')
assert.strictEqual(api.normalizeBaseUrl('https://hdhive.com//'), 'https://hdhive.com')

// normalizeBaseUrl：无协议自动补 https://
assert.strictEqual(api.normalizeBaseUrl('hdhive.com'), 'https://hdhive.com')
assert.strictEqual(api.normalizeBaseUrl('  hdhive.com  '), 'https://hdhive.com')

// normalizeBaseUrl：保留已有的 http/https
assert.strictEqual(api.normalizeBaseUrl('http://hdhive.com'), 'http://hdhive.com')

// normalizeBaseUrl：空值回退默认
assert.strictEqual(api.normalizeBaseUrl(''), 'https://hdhive.com')

// buildSearchUrl：中文编码 + 路径固定
assert.strictEqual(
  api.buildSearchUrl('https://hdhive.com', '三体'),
  'https://hdhive.com/search?query=%E4%B8%89%E4%BD%93&type=multi&page=1'
)

// buildSearchUrl：keyword 去空格 + baseUrl 经 normalize
assert.strictEqual(
  api.buildSearchUrl('hdhive.com/', ' 三体 '),
  'https://hdhive.com/search?query=%E4%B8%89%E4%BD%93&type=multi&page=1'
)

console.log('all passed')
```

- [ ] **Step 2: 运行验证脚本，确认失败（search-url.js 尚不存在）**

Run: `node extensions/hdhive-search/_verify.js`
Expected: 报错 `Cannot find module './search-url.js'`

- [ ] **Step 3: 写 search-url.js**

创建 `extensions/hdhive-search/search-url.js`：

```js
(function () {
  const DEFAULT_BASE_URL = 'https://hdhive.com'
  const STORAGE_KEY = 'hdhiveBaseUrl'

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

    return `${normalizedBaseUrl}/search?query=${query}&type=multi&page=1`
  }

  const api = {
    DEFAULT_BASE_URL,
    STORAGE_KEY,
    normalizeBaseUrl,
    buildSearchUrl,
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.HdhiveSearch = api
  }

  if (typeof module !== 'undefined') {
    module.exports = api
  }
})()
```

- [ ] **Step 4: 运行验证脚本，确认通过**

Run: `node extensions/hdhive-search/_verify.js`
Expected: 输出 `all passed`

- [ ] **Step 5: 删除临时验证脚本**

Run: `rm extensions/hdhive-search/_verify.js`

- [ ] **Step 6: 提交**

```bash
git add extensions/hdhive-search/search-url.js
git commit -m "feat: 添加 hdhive-search 的 search-url 模块"
```

---

### Task 2: background.js 改写 + manifest 加 storage 权限

**Files:**
- Modify: `extensions/hdhive-search/background.js`（全量改写）
- Modify: `extensions/hdhive-search/manifest.json`（加 `storage` 权限；此阶段不加 `action`，popup 尚未创建）

**Interfaces:**
- Consumes: `globalThis.HdhiveSearch`（由 `importScripts('search-url.js')` 注入）

- [ ] **Step 1: 全量改写 background.js**

将 `extensions/hdhive-search/background.js` 整体替换为：

```js
importScripts('search-url.js')

const MENU_ID = 'search-hdhive'

// ========== 右键菜单 ==========
chrome.runtime.onInstalled.addListener(() => {
  updateContextMenu()
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[globalThis.HdhiveSearch.STORAGE_KEY]) {
    updateContextMenu()
  }
})

function updateContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: '在 HDHive 搜索"%s"',
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

  const data = await chrome.storage.local.get(globalThis.HdhiveSearch.STORAGE_KEY)
  const baseUrl = data[globalThis.HdhiveSearch.STORAGE_KEY] || globalThis.HdhiveSearch.DEFAULT_BASE_URL
  const url = globalThis.HdhiveSearch.buildSearchUrl(baseUrl, keyword)

  chrome.tabs.create({ url })
})
```

- [ ] **Step 2: 改 manifest.json 加 storage 权限**

将 `extensions/hdhive-search/manifest.json` 整体替换为（仅新增 `storage` 权限，version 暂不升）：

```json
{
  "manifest_version": 3,
  "name": "HDHive Search",
  "version": "1.0.0",
  "description": "右键选中文字，在 HDHive 中搜索影视资料",
  "permissions": ["contextMenus", "storage"],
  "background": {
    "service_worker": "background.js"
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 3: 浏览器验证右键搜索（用默认地址）**

1. 打开 `chrome://extensions/`，找到 HDHive Search，点击刷新按钮（新增 storage 权限需在扩展详情页确认授权）
2. 在任意网页选中文字（如"三体"），右键 → "在 HDHive 搜索"
3. 确认新标签打开 `https://hdhive.com/search?query=三体&type=multi&page=1`，页面正常
4. 打开扩展的 Service Worker 控制台（扩展详情页 → "检查视图：service worker"），确认无报错

- [ ] **Step 4: 提交**

```bash
git add extensions/hdhive-search/background.js extensions/hdhive-search/manifest.json
git commit -m "feat: hdhive-search 后台读取可配置搜索地址"
```

---

### Task 3: popup 三件套 + manifest action + version 1.1.0

**Files:**
- Create: `extensions/hdhive-search/popup.html`
- Create: `extensions/hdhive-search/popup.js`
- Create: `extensions/hdhive-search/popup.css`
- Modify: `extensions/hdhive-search/manifest.json`（加 `action.default_popup` + `default_icon`，改 description，version 升 `1.1.0`）

**Interfaces:**
- Consumes: `globalThis.HdhiveSearch`（popup.html 必须先加载 `search-url.js` 再加载 `popup.js`，顺序错误会导致 `globalThis.HdhiveSearch` 为 undefined）

- [ ] **Step 1: 创建 popup.html**

注意 script 顺序：`search-url.js` 在 `popup.js` 之前。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="container">
    <h3>HDHive - 搜索主页设置</h3>
    <p class="hint">在此修改 HDHive 搜索主页地址</p>
    <div class="form-row">
      <input type="text" id="baseUrlInput" placeholder="https://hdhive.com">
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

- [ ] **Step 2: 创建 popup.css**

主题色用琥珀金 `#f5a623`（呼应 HDHive 蜜蜂图标），其余与 subhd-search 一致。

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
  background: #f5f7fb;
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
  border-color: #f5a623;
}

#saveBtn {
  padding: 7px 14px;
  background: #f5a623;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
}

#saveBtn:hover {
  background: #d68910;
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
  color: #f5a623;
  cursor: pointer;
  font-size: 11px;
  padding: 2px 4px;
}

.link-btn:hover {
  text-decoration: underline;
}
```

- [ ] **Step 3: 创建 popup.js**

```js
const hdhiveSearch = globalThis.HdhiveSearch
const baseUrlInput = document.getElementById('baseUrlInput')
const saveBtn = document.getElementById('saveBtn')
const resetBtn = document.getElementById('resetBtn')
const statusEl = document.getElementById('status')

// 加载当前设置
chrome.storage.local.get(hdhiveSearch.STORAGE_KEY, (data) => {
  baseUrlInput.value = data[hdhiveSearch.STORAGE_KEY] || hdhiveSearch.DEFAULT_BASE_URL
})

// 保存
saveBtn.addEventListener('click', () => {
  const inputUrl = baseUrlInput.value.trim()

  if (!inputUrl) {
    showStatus('请输入搜索主页地址', 'error')
    return
  }

  const url = hdhiveSearch.normalizeBaseUrl(inputUrl)
  baseUrlInput.value = url

  chrome.storage.local.set({ [hdhiveSearch.STORAGE_KEY]: url }, () => {
    showStatus('已保存', 'success')
  })
})

// 恢复默认
resetBtn.addEventListener('click', () => {
  baseUrlInput.value = hdhiveSearch.DEFAULT_BASE_URL
  chrome.storage.local.set({ [hdhiveSearch.STORAGE_KEY]: hdhiveSearch.DEFAULT_BASE_URL }, () => {
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

- [ ] **Step 4: 改 manifest.json（加 action + description + version 1.1.0）**

将 `extensions/hdhive-search/manifest.json` 整体替换为：

```json
{
  "manifest_version": 3,
  "name": "HDHive Search",
  "version": "1.1.0",
  "description": "右键选中文字，在 HDHive 中搜索影视资料，支持自定义搜索主页",
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

- [ ] **Step 5: 浏览器验证设置页与端到端流程**

1. `chrome://extensions/` 刷新 HDHive Search
2. 点击扩展图标 → 弹出设置页，输入框默认显示 `https://hdhive.com`
3. 改成 `https://hdhive2.com` → 保存 → 状态显示"已保存"
4. 关闭弹窗，选中文字右键搜索 → 确认跳转 `https://hdhive2.com/search?query=…&type=multi&page=1`
5. 点开弹窗 → 恢复默认 → 右键搜索 → 确认回到 `https://hdhive.com`
6. 输入框清空 → 保存 → 确认显示"请输入搜索主页地址"错误，不写入
7. 输入 `hdhive.com`（无协议）→ 保存 → 确认输入框自动变成 `https://hdhive.com`
8. Service Worker 控制台与 popup 控制台均无报错

- [ ] **Step 6: 提交**

```bash
git add extensions/hdhive-search/popup.html extensions/hdhive-search/popup.js extensions/hdhive-search/popup.css extensions/hdhive-search/manifest.json
git commit -m "feat: hdhive-search 支持自定义搜索主页"
```

---

### Task 4: 同步 README.md 与 CLAUDE.md 文档

**Files:**
- Modify: `README.md`（6 处）
- Modify: `CLAUDE.md`（3 处）

**说明：** 文档改动无运行验证，改完后整体回归一次（右键搜索 + 设置页）确认与文档一致。

- [ ] **Step 1: README.md 第 22 行——简介加"支持自定义搜索主页"**

old:
```
| 🐝 | [**HDHive Search**](./extensions/hdhive-search/) | [hdhive.com](https://hdhive.com) | 基于 TMDB 的影视资料聚合搜索（电影+剧集） | `stable` |
```
new:
```
| 🐝 | [**HDHive Search**](./extensions/hdhive-search/) | [hdhive.com](https://hdhive.com) | 基于 TMDB 的影视资料聚合搜索（电影+剧集），支持自定义搜索主页 | `stable` |
```

- [ ] **Step 2: README.md 第 44 行——手动输入/配置说明加 HDHive**

old:
```
XCili、IMDB 支持点击扩展图标手动输入关键词；Mukaku、KuakeQ、Jiaofu、SubHD 支持在弹窗中配置搜索主页地址。
```
new:
```
XCili、IMDB 支持点击扩展图标手动输入关键词；HDHive、Mukaku、KuakeQ、Jiaofu、SubHD 支持在弹窗中配置搜索主页地址。
```

- [ ] **Step 3: README.md 第 57-59 行——可配置搜索主页章节加 HDHive**

old:
```
### 可配置搜索主页

不太灵、夸克圈、教父、SubHD 的域名可能变更。点击对应扩展图标，在弹窗中修改搜索主页地址并保存即可，右键搜索将自动使用新域名。
```
new:
```
### 可配置搜索主页

HDHive、不太灵、夸克圈、教父、SubHD 支持自定义搜索主页地址。点击对应扩展图标，在弹窗中修改并保存即可，右键搜索将自动使用新地址。
```

- [ ] **Step 4: README.md 第 94 行——权限表 HDHive 加 storage**

old:
```
| HDHive | ✅ | - | - | 纯右键跳转 |
```
new:
```
| HDHive | ✅ | ✅ | - | 弹窗 + 域名配置存储 |
```

- [ ] **Step 5: README.md 第 116-119 行——目录结构补 search-url.js / popup**

old:
```
    ├── hdhive-search/           # 聚合搜索 — manifest + background.js
    │   ├── manifest.json
    │   ├── background.js
    │   └── icons/
```
new:
```
    ├── hdhive-search/           # 聚合搜索 — 弹窗 + 域名配置
    │   ├── manifest.json
    │   ├── background.js
    │   ├── search-url.js
    │   ├── popup.html / js / css
    │   └── icons/
```

- [ ] **Step 6: README.md 第 169 行——搜索 URL 表加"域名可配置"**

old:
```
| HDHive | `hdhive.com/search?query={keyword}&type=multi&page=1` |
```
new:
```
| HDHive | `hdhive.com/search?query={keyword}&type=multi&page=1`（域名可配置） |
```

- [ ] **Step 7: CLAUDE.md 技术栈段——hdhive-search 额外申请 storage**

old:
```
简单搜索扩展仅申请 `contextMenus` 权限；xcili-search 额外申请 `activeTab` 和 `storage`；mukaku-search 额外申请 `storage`；kuakeq-search 额外申请 `storage`；jiaofu-search 额外申请 `storage`；subhd-search 额外申请 `storage`；imdb-search 申请 `storage`
```
new:
```
简单搜索扩展仅申请 `contextMenus` 权限；hdhive-search 额外申请 `storage`；xcili-search 额外申请 `activeTab` 和 `storage`；mukaku-search 额外申请 `storage`；kuakeq-search 额外申请 `storage`；jiaofu-search 额外申请 `storage`；subhd-search 额外申请 `storage`；imdb-search 申请 `storage`
```

- [ ] **Step 8: CLAUDE.md 搜索 URL 格式表——HDHive 加"域名可配置"**

old:
```
| HDHive | `https://hdhive.com/search?query={keyword}&type=multi&page=1` |
```
new:
```
| HDHive | `https://hdhive.com/search?query={keyword}&type=multi&page=1`（域名可配置） |
```

- [ ] **Step 9: CLAUDE.md 目录结构——hdhive-search 补 search-url.js / popup**

old:
```
│   ├── hdhive-search/         # HDHive 搜索扩展
│   │   ├── manifest.json
│   │   ├── background.js
│   │   └── icons/             # icon16/48/128.png
```
new:
```
│   ├── hdhive-search/         # HDHive 搜索扩展（右键搜索，支持自定义搜索主页）
│   │   ├── manifest.json
│   │   ├── background.js
│   │   ├── search-url.js
│   │   ├── popup.html/js/css
│   │   └── icons/             # icon16/48/128.png
```

- [ ] **Step 10: 整体回归验证**

重复 Task 3 Step 5 的浏览器验证（默认地址右键搜索、改地址、恢复默认、空输入、无协议补全），确认文档与实际行为一致。

- [ ] **Step 11: 提交**

```bash
git add README.md CLAUDE.md
git commit -m "docs: 同步文档，补充 hdhive-search 自定义搜索主页信息"
```