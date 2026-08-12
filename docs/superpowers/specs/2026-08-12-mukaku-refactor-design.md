# Mukaku 搜索扩展：重构为成熟模式 设计

## 背景

`mukaku-search` 是项目里最早实现"自定义搜索主页"的扩展，采用早期模式：`DEFAULT_BASE_URL` 在 `background.js` 和 `popup.js` 各写一份，`background.js` 的 `onClicked` 直接拼接 URL 未走 normalize。后续的 `jiaofu-search`/`subhd-search`/`hdhive-search` 已升级为成熟模式（独立 `search-url.js` + `importScripts` + popup 复用）。本次将 `mukaku-search` 对齐到成熟模式，与 `hdhive-search` 2026-08-12 的实现完全同构。

## 目标

- 消除 `DEFAULT_BASE_URL` 重复，URL 构建逻辑只写一遍
- `background.js` 搜索时统一走 `normalizeBaseUrl`（修复老版直接拼接的隐患）
- 与项目其他可配置扩展（jiaofu/subhd/hdhive）实现方式一致

## 非目标

- 不改 UI（`popup.css` 不动）
- 不改搜索路径 `/search?sb=`
- 不改 `STORAGE_KEY`（保持 `mukakuBaseUrl`，兼容现有用户 storage 数据）
- 不改默认地址 `https://web2.mukaku.com`

## 现状（老版）

- `manifest.json`：`contextMenus` + `storage` + `action.default_popup`，version `1.0.0`
- `background.js`：`DEFAULT_BASE_URL` 硬编码；`onClicked` 直接 `${baseUrl}/search?sb=${encodeURIComponent(query)}`，无 normalize
- `popup.js`：自有 `DEFAULT_BASE_URL` + inline normalize（trim/去尾斜杠/补 https）
- `popup.html`：仅加载 `popup.js`

## 设计

### 文件改动

| 文件 | 操作 |
|------|------|
| `extensions/mukaku-search/search-url.js` | 新增，`MukakuSearch` api |
| `extensions/mukaku-search/background.js` | 改写，`importScripts` + `buildSearchUrl` |
| `extensions/mukaku-search/popup.js` | 改写，用 `globalThis.MukakuSearch` |
| `extensions/mukaku-search/popup.html` | 加载 `search-url.js`（在 `popup.js` 前）|
| `extensions/mukaku-search/manifest.json` | version `1.0.0` → `1.1.0` |
| `README.md` | mukaku 目录结构加 `search-url.js` |
| `CLAUDE.md` | mukaku 目录结构加 `search-url.js` |

### search-url.js

IIFE 挂 `globalThis.MukakuSearch`，兼容 `module.exports`：

- `DEFAULT_BASE_URL = 'https://web2.mukaku.com'`
- `STORAGE_KEY = 'mukakuBaseUrl'`
- `normalizeBaseUrl(baseUrl)`：trim / 去尾斜杠 / 补 `https://` / 空值回退默认
- `buildSearchUrl(baseUrl, keyword)`：`${normalizeBaseUrl(baseUrl)}/search?sb=${encodeURIComponent(keyword.trim())}`

### background.js

- `importScripts('search-url.js')`
- `onInstalled` → `updateContextMenu()`
- `onChanged` 监听 `STORAGE_KEY` → `updateContextMenu()`
- `onClicked` → 读 storage → `buildSearchUrl`（现在走 normalize）→ `chrome.tabs.create`

### popup.js

- `const mukakuSearch = globalThis.MukakuSearch`
- 加载时读 storage 填充输入框
- 保存：经 `normalizeBaseUrl` 校验后写 storage
- 恢复默认：写 `DEFAULT_BASE_URL`

### popup.html

在 `<script src="popup.js"></script>` 前加 `<script src="search-url.js"></script>`

### manifest.json

version `1.0.0` → `1.1.0`，其余字段不变

## 错误处理

- 空输入：popup 提示"请输入搜索主页地址"
- 无协议：`normalizeBaseUrl` 自动补 `https://`
- 尾部斜杠：`normalizeBaseUrl` 去除
- storage 无值：回退 `DEFAULT_BASE_URL`

## 验证

1. Node 验证 `search-url.js` 纯函数（临时脚本，验证后删，不引入测试框架）
2. `chrome://extensions` 刷新 mukaku-search
3. 右键搜索"三体" → 跳转 `https://web2.mukaku.com/search?sb=三体`
4. 设置页改地址保存 → 右键用新地址 → 恢复默认 → 回到 `https://web2.mukaku.com`
5. 空输入校验、无协议补全
6. 现有用户：storage 里的 `mukakuBaseUrl` 保持生效（`STORAGE_KEY` 不变）

## 风险

- `STORAGE_KEY` 不变，现有用户配置不丢失
- 行为基本不变，唯一变化是 `background.js` 走 normalize——对已规范化数据无影响（popup 保存时本就规范化）