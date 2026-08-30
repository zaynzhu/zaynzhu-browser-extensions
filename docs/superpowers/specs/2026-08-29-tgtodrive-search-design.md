# TgtoDrive（TTD）搜索扩展 设计

## 背景

TgtoDrive 是用户 NAS 上部署的 Docker 应用（Web 管理台，Flask 服务端渲染，需登录），其首页即"影视探索"页：搜索框 `#md-library-query` 输入影视名称后按 Enter，前端调用 `GET /api/media/search?q=...&media_type=movie&page=1` 渲染结果。

**关键侦察结论（2026-08-29 实测验证）：**

1. 搜索完全不走 URL 参数，地址栏搜索前后无变化 —— 项目现有 9 个扩展的"拼 URL 直达"模式不适用
2. TTD 登录后是**单页多 section** 结构：左侧 `.nav-item[data-target=...]` 切换同一 `/` 页内的显示区块（URL 不变，且会用 `persistRememberedActiveNav` 记住上次停留的 section，刷新后恢复）。搜索框 `#md-library-query` 所在的 `media-library-section` 不在前台时仍可填词触发搜索，但用户看不到结果 —— 注入前必须先点 nav 项切到影视探索（`switchTab` 会调 `window.MediaDiscovery.activate` 加载区块数据；TTD 内部深链接也用 `navItem.click()`，程序化点击是应用自身支持的路径）
3. 搜索框由 JS 动态渲染（`static/media_discovery.js`），Enter 监听委托在 sections 容器上，事件需 `bubbles: true`
4. 合成事件实测可用：通过 native value setter 填值 + 派发 `input` 事件 + 派发合成 `keydown`（key=Enter, keyCode=13, bubbles），页面发出真实搜索请求并正常渲染结果（TTD 不校验 `event.isTrusted`）
5. 页面较重（xterm、几十个配置区块），每次搜索新开标签页体验差 → 复用优先

## 目标

- 任意页面选中文本 → 右键「在 TTD 中搜索」→ 在 TTD 影视探索页自动填入关键词并触发搜索
- TTD 地址可配置（默认 `http://192.168.50.233:12366`，NAS IP/端口可变）
- 已打开 TTD 标签页时复用（激活 + 原页搜索），否则新开标签页
- 找不到搜索框（未登录 / 地址错误 / 页面异常）时在页面注入 toast 提示，不弹窗打扰

## 非目标

- 不做剪贴板读取（用选中文本，与其他 9 个扩展一致）
- 不存 TTD 登录账密（依赖浏览器已有登录态）
- 不做"搜电影 / 搜剧集"分类菜单（v1 单菜单，TTD 页内可一键切类别）
- 不做可选运行时授权（自用扩展，直接声明 `<all_urls>`）

## 设计

### 与现有扩展的差异

现有扩展：`拼 URL → chrome.tabs.create`。本扩展是项目首个**注入式**搜索扩展：

```
右键选中 → 定位/打开 TTD 标签页 → chrome.scripting.executeScript
  → 轮询等待 #md-library-query（最长 15s）
  → native setter 填值 + input 事件 + focus + 合成 Enter keydown
  → 超时则注入 toast 提示
```

### 文件结构

```
extensions/tgtodrive-search/
├── manifest.json       # MV3，permissions: contextMenus/storage/scripting，host_permissions: <all_urls>
├── background.js       # 菜单注册 + 标签页定位/打开 + 注入编排
├── search-url.js       # 共享模块：DEFAULT_BASE_URL / STORAGE_KEY / normalizeBaseUrl / injectSearch
├── popup.html/js/css   # base URL 配置弹窗（沿用 mukaku 模板）
└── icons/              # icon16/48/128.png（TTD 品牌蓝 #2da7ea + 白色放大镜/播放图形）
```

### manifest.json

- `permissions`: `["contextMenus", "storage", "scripting"]`
  - 不需要 `tabs` 权限：`<all_urls>` host 权限已覆盖 `tabs.query({url})` 读取 tab.url 的能力
- `host_permissions`: `["<all_urls>"]`（NAS 地址可配置，无法预知注入目标；自用扩展接受安装时的宽权限提示）
- version `1.0.0`，`action.default_popup` 指向 popup.html

### search-url.js（沿用项目成熟 IIFE 模式）

挂 `globalThis.TtdSearch`，兼容 `module.exports`：

- `DEFAULT_BASE_URL = 'http://192.168.50.233:12366'`
- `STORAGE_KEY = 'ttdBaseUrl'`
- `normalizeBaseUrl(baseUrl)`：trim / 去尾斜杠 / 补 `http://`（NAS 局域网默认 http，区别于 mukaku 的 https）/ 空值回退默认
- `INPUT_SELECTOR = '#md-library-query'`、`INPUT_WAIT_MS = 15000`
- `injectSearch(keyword)`：**自包含**（executeScript func 序列化不携带闭包），在页面 ISOLATED world 执行：
  - 先切区块：轮询等 `.nav-item[data-target="media-library-section"]` 出现（nav 本身异步渲染），若 `media-library-section` 未 active 则点击一次（等 section 激活后才继续；nav 始终等不到则退化为直接找输入框）
  - 每 300ms 轮询 `#md-library-query`（最长 15s）
  - 命中：`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set` 填值 → 派发 `input`（bubbles）→ `focus()` → 派发合成 `keydown`（`key/code/keyCode/which=13, bubbles, cancelable`）
  - 超时：页面底部注入 toast「未找到 TTD 搜索框，请确认已登录且地址配置正确」，4s 后淡出移除

### background.js

- `importScripts('search-url.js')`
- `onInstalled` → 注册菜单 `在 TTD 中搜索 "%s"`（contexts: selection）
- `onClicked` 流程：
  1. 读 storage → `normalizeBaseUrl` 得 base
  2. `chrome.tabs.query({ url: `${base}/*` })`：
     - 无匹配 → `tabs.create({ url: base, active: true })`，等 `onUpdated` status=complete 后注入
     - 有匹配 → 优先取 active 的，`windows.update` 聚焦所在窗口；若 pathname 不是 `/`（用户停在管理台子页）则 `tabs.update` 导航到 base 后等 complete 注入，否则直接注入（轮询兜底 SPA 渲染）
  3. `chrome.scripting.executeScript({ target: { tabId }, func: TtdSearch.injectSearch, args: [keyword] })`
- `onUpdated` 等待带 20s 超时兜底，防止页面卡在 loading 导致注入永不执行

### popup

照抄 mukaku 模板（320px 宽、base URL 输入 + 保存 + 恢复默认），仅文案改为 TTD：
标题「TTD - 搜索地址设置」，提示「NAS 上 TgtoDrive 管理台地址，含端口」，占位符 `http://192.168.50.233:12366`。

### 行为边界

- TTD 登录过期：复用/新开标签页都会落在 `/login`，注入器 15s 超时出 toast，用户登录后重试即可
- 用户停留在 TTD 其他 section（如日志中心、榜单推荐）：`injectSearch` 先点 nav 切到影视探索再搜（见上）；background 里 pathname 非 `/` 时导航回首页的逻辑保留作为多页路由的兜底
- 关键词超长/含特殊字符：`native setter` 直接赋值，无 URL 编码需求

## 权限说明（README 同步）

| 权限 | 用途 |
|------|------|
| `contextMenus` | 右键菜单 |
| `storage` | 保存自定义 TTD 地址 |
| `scripting` | 向 TTD 页面注入填词脚本 |
| `<all_urls>` host | 地址可配置 → 无法限定固定域名；仅用于 `tabs.query` 匹配与注入 TTD 页面 |
