# TgtoDrive 搜索扩展 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `extensions/tgtodrive-search/`：右键选中文本，在 NAS 上 TgtoDrive 管理台的"影视探索"页自动填词并触发搜索。TTD 搜索不走 URL 参数（侦察实测结论），故采用项目首个注入式架构：定位/新开标签页 → `chrome.scripting.executeScript` 轮询等搜索框 → native setter 填值 + 合成 Enter。

**Architecture:** `search-url.js` IIFE 挂 `globalThis.TtdSearch`（含自包含注入函数 `injectSearch`），background.js `importScripts` 引入；popup 沿用 mukaku 模板仅改文案。`<all_urls>` host 权限同时解决可配置地址的注入授权与 `tabs.query({url})` 匹配。

**Tech Stack:** Chrome Manifest V3、纯原生 JS（零依赖）、chrome.storage.local、chrome.contextMenus、chrome.scripting、Node（仅验证纯函数）、Pillow（生成图标）

## Global Constraints

- Chrome Manifest V3，零依赖纯原生 JS
- 代码风格：JS 不用分号、2 空格缩进、camelCase、常量 UPPER_SNAKE_CASE、注释中文
- `search-url.js` IIFE 挂 `globalThis.TtdSearch`，兼容 `module.exports`（与 mukaku/subhd/jiaofu/hdhive 一致）
- `injectSearch(keyword)` 必须自包含：executeScript 的 func 序列化后不带闭包，所有常量内联在函数体内
- `DEFAULT_BASE_URL = 'http://192.168.50.233:12366'`、`STORAGE_KEY = 'ttdBaseUrl'`
- `normalizeBaseUrl` 补 `http://`（NAS 局域网场景），不是 https
- 注入等待搜索框上限 15s，`onUpdated` 等待上限 20s
- 合成 Enter 事件必须 `bubbles: true`（监听器委托在容器上）
- manifest `version` `1.0.0`；`permissions: ["contextMenus", "storage", "scripting"]`；`host_permissions: ["<all_urls>"]`；无 `tabs` 权限
- commit 格式：`type: 中文描述`（type ∈ feat/docs）
- Node 验证：临时脚本 `extensions/tgtodrive-search/_verify.js`，验证后删除，不提交

---

### Task 1: search-url.js（纯函数 + 自包含注入器）

**Files:**
- Create: `extensions/tgtodrive-search/search-url.js`
- Test（临时，验证后删除）: `extensions/tgtodrive-search/_verify.js`

**Interfaces:**
- Produces: `globalThis.TtdSearch` / `module.exports`：`DEFAULT_BASE_URL`、`STORAGE_KEY`、`normalizeBaseUrl(baseUrl) => string`、`INPUT_SELECTOR`、`INPUT_WAIT_MS`、`injectSearch(keyword) => Promise<'ok'|'timeout'>`

- [ ] **Step 1: 实现 search-url.js**（IIFE；`injectSearch` 函数体内联 `INPUT_SELECTOR`/`INPUT_WAIT_MS`/toast 样式，不引用外部变量）
- [ ] **Step 2: Node 验证 normalizeBaseUrl**：空/undefined → 默认；尾斜杠去除；无协议补 `http://`；已有协议保留
- [ ] **Step 3: 删除 _verify.js**

### Task 2: manifest.json + 图标

**Files:**
- Create: `extensions/tgtodrive-search/manifest.json`、`icons/icon{16,48,128}.png`

- [ ] **Step 1: manifest.json**（MV3；name "TTD Search"；description 含"右键搜索 NAS 上 TgtoDrive 影视探索，支持自定义地址"；permissions/host_permissions/version/action/icons 按约束）
- [ ] **Step 2: Pillow 生成图标**：圆角方块 TTG 品牌蓝 `#2da7ea` 底 + 白色放大镜图形（影视探索语义），三尺寸，参照现有扩展 PNG 格式
- [ ] **Step 3: JSON 语法校验（python json.load）+ PNG 尺寸校验**

### Task 3: background.js（菜单 + 标签页编排 + 注入）

**Files:**
- Create: `extensions/tgtodrive-search/background.js`

**Interfaces:**
- Consumes: `globalThis.TtdSearch`
- Uses: `chrome.contextMenus` / `chrome.storage` / `chrome.tabs` / `chrome.scripting` / `chrome.windows`

- [ ] **Step 1: 菜单注册**（`MENU_ID = 'search-tgtodrive'`，title `在 TTD 中搜索"%s"`，contexts selection；onInstalled + storage onChanged 触发 updateContextMenu，沿 mukaku 模式）
- [ ] **Step 2: onClicked 编排**：读 storage → normalize → `tabs.query({url: `${base}/*`})` → 复用（优先 active；非首页 pathname 先 `tabs.update` 导航回 base）或 `tabs.create({url: base})` → 等 complete（onUpdated promise 化 + 20s 超时兜底）→ `executeScript({target:{tabId}, func: TtdSearch.injectSearch, args:[keyword]})`
- [ ] **Step 3: `node --check` 语法校验**

### Task 4: popup（base URL 配置）

**Files:**
- Create: `popup.html` / `popup.js` / `popup.css`（照抄 mukaku 三件套，仅改文案与提示）

- [ ] **Step 1: popup.html**：标题「TTD - 搜索地址设置」、提示「NAS 上 TgtoDrive 管理台地址（含端口），修改后右键搜索自动使用新地址」、placeholder `http://192.168.50.233:12366`
- [ ] **Step 2: popup.js / popup.css**：逻辑同 mukaku（加载回填/保存 normalize/恢复默认/状态提示）
- [ ] **Step 3: `node --check popup.js`**

### Task 5: 文档同步 + 收尾

- [ ] **Step 1: AGENTS.md**：目录树加 `tgtodrive-search/`；技术栈权限说明补一条；搜索 URL 表加 TTD 行（注明"不走 URL，注入式搜索"）
- [ ] **Step 2: CLAUDE.md**：与 AGENTS.md 同步（保持仅目录树自引用行不同）
- [ ] **Step 3: README.md**：扩展索引行（🔢 或 📡 图标、`stable`）、使用方式、安装表、权限表、目录树、搜索 URL 表、Extensions 徽章 9 → 10
- [ ] **Step 4: 全目录 `node --check` 终检 + git status 确认无临时文件混入**
