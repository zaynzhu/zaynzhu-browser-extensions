# HDHive 搜索扩展：支持自定义搜索主页 设计

## 背景

zaynzhu-browser-extensions 是一个轻量级 Chrome 右键搜索扩展合集。其中 `hdhive-search` 目前将搜索地址硬编码为 `https://hdhive.com`，无法配置。合集里的其他几个扩展（不太灵、夸克圈、教父、SubHD）已支持自定义搜索主页。

本次改动让 `hdhive-search` 也支持自定义搜索主页，与项目现有可配置扩展保持一致。

## 目标

- 用户可在扩展 popup 中修改 HDHive 的站点主地址
- 右键搜索使用用户配置的地址，默认 `https://hdhive.com`
- 实现方式与项目最新的可配置扩展（`jiaofu-search`、`subhd-search`）保持一致

## 非目标

- 不改动搜索路径 `/search?query=…&type=multi&page=1` 及其参数（只配站点主地址）
- 不改动其他扩展
- 不引入整条 URL 模板可配的能力（YAGNI）

## 现状

### HDHive（待改造）

- `manifest.json`：仅 `contextMenus` 权限，无 popup，无 storage
- `background.js`：`const HDHIVE_URL = "https://hdhive.com"`，直接拼接 URL

### 参照：成熟模式（jiaofu / subhd）

- 独立 `search-url.js`（IIFE 挂 `globalThis`），导出 `DEFAULT_BASE_URL`、`STORAGE_KEY`、`normalizeBaseUrl`、`buildSearchUrl`
- `background.js`：`importScripts('search-url.js')`，读 `chrome.storage.local`，监听 `onChanged`
- `popup.js` 复用同一套 api
- `manifest.json`：`contextMenus` + `storage` 权限，有 `action.default_popup`

## 设计

### 文件改动

| 文件 | 操作 | 说明 |
|------|------|------|
| `extensions/hdhive-search/search-url.js` | 新增 | URL 构建 api |
| `extensions/hdhive-search/background.js` | 改写 | 引入 storage 读取 |
| `extensions/hdhive-search/popup.html` | 新增 | 设置页 |
| `extensions/hdhive-search/popup.js` | 新增 | 设置页逻辑 |
| `extensions/hdhive-search/popup.css` | 新增 | 设置页样式 |
| `extensions/hdhive-search/manifest.json` | 修改 | 加 storage/popup，升 version |
| `README.md` | 修改 | 同步 HDHive 描述 |
| `CLAUDE.md` | 修改 | 同步搜索 URL 表 |

### search-url.js

IIFE 挂到 `globalThis.HdhiveSearch`，导出：

- `DEFAULT_BASE_URL = 'https://hdhive.com'`
- `STORAGE_KEY = 'hdhiveBaseUrl'`（与 `mukakuBaseUrl`/`jiaofuBaseUrl`/`subhdBaseUrl` 命名一致）
- `normalizeBaseUrl(baseUrl)`：trim、去尾部 `/`、无 `https?://` 前缀自动补 `https://`、空值回退默认
- `buildSearchUrl(baseUrl, keyword)`：`${normalizeBaseUrl(baseUrl)}/search?query=${encodeURIComponent(keyword.trim())}&type=multi&page=1`

同时兼容 `module.exports`（与 subhd/jiaofu 一致）。

### background.js

- `importScripts('search-url.js')`
- `onInstalled`：调用 `updateContextMenu()`
- `chrome.storage.onChanged`：监听 `STORAGE_KEY` 变化 → `updateContextMenu()`
- `updateContextMenu()`：`removeAll` 后重建菜单（title 固定 `在 HDHive 搜索"%s"`，不依赖 baseUrl；监听仅为与现有扩展保持一致）
- `onClicked`：读 `chrome.storage.local.get(STORAGE_KEY)` → `baseUrl = data[STORAGE_KEY] || DEFAULT_BASE_URL` → `buildSearchUrl` → `chrome.tabs.create`

### popup

- `popup.html`：标题"HDHive - 搜索主页设置"，提示"在此修改 HDHive 搜索主页地址"，输入框（placeholder `https://hdhive.com`）、保存按钮、状态区、恢复默认按钮
- `popup.js`：加载时读 storage 填充输入框；保存时经 `normalizeBaseUrl` 校验后写 storage；恢复默认写 `DEFAULT_BASE_URL`；空输入提示错误
- `popup.css`：复用 subhd/jiaofu 现有样式

### manifest.json

- `permissions`：`["contextMenus", "storage"]`
- 新增 `action.default_popup = "popup.html"` 及 `default_icon`
- `version`：`1.0.0` → `1.1.0`

## 错误处理

- 空输入：popup 提示"请输入搜索主页地址"，不写入 storage
- 无协议：`normalizeBaseUrl` 自动补 `https://`
- 尾部斜杠：`normalizeBaseUrl` 去除
- storage 无值：回退 `DEFAULT_BASE_URL`

## 验证

1. `chrome://extensions` 加载未打包扩展
2. 右键选中文字 → "在 HDHive 搜索" → 跳转 `https://hdhive.com/search?query=…&type=multi&page=1`
3. 点扩展图标 → 改地址（如 `https://hdhive2.com`）保存 → 右键搜索使用新地址
4. 恢复默认 → 右键搜索回到 `https://hdhive.com`
5. 空输入保存 → 提示错误
6. 输入 `hdhive.com`（无协议）→ 自动补成 `https://hdhive.com`

## 风险

- 无破坏性变更：新增功能，已安装用户 storage 无值时自动用默认值，行为与现状一致
- 文档同步：README、CLAUDE.md 需一并更新，否则描述与实现不符