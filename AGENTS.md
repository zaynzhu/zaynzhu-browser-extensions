# zaynzhu-browser-extensions 开发规范

## 项目概述

轻量级 Chrome 浏览器右键搜索扩展合集，选中文字即可跳转影视网站搜索。

## 目录结构

```
zaynzhu-browser-extensions/
├── extensions/                # 所有扩展的汇总目录
│   ├── hdhive-search/         # HDHive 搜索扩展（右键搜索，支持自定义搜索主页）
│   │   ├── manifest.json
│   │   ├── background.js
│   │   ├── search-url.js
│   │   ├── popup.html/js/css
│   │   └── icons/             # icon16/48/128.png
│   ├── douban-search/          # 豆瓣搜索扩展
│   │   ├── manifest.json
│   │   ├── background.js
│   │   └── icon.png
│   ├── 123pan-search/          # 123盘搜索扩展
│   │   ├── manifest.json
│   │   ├── background.js
│   │   └── icons/              # icon16/48/128.png
│   ├── xcili-search/           # 无极磁力搜索扩展（右键/手动输入关键词搜磁力）
│   │   ├── manifest.json
│   │   ├── background.js
│   │   ├── popup.html/js/css
│   │   └── icons/
│   ├── mukaku-search/           # 不太灵搜索扩展（右键搜索，支持自定义搜索主页）
│   │   ├── manifest.json
│   │   ├── background.js
│   │   ├── search-url.js
│   │   ├── popup.html/js/css
│   │   └── icons/
│   ├── kuakeq-search/            # 夸克圈搜索扩展（右键搜索磁力链接，支持自定义搜索主页）
│   │   ├── manifest.json
│   │   ├── background.js
│   │   ├── popup.html/js/css
│   │   └── icons/
│   ├── jiaofu-search/            # 观影搜索扩展（右键搜索影视资源，支持自定义搜索主页）
│   │   ├── manifest.json
│   │   ├── background.js
│   │   ├── search-url.js
│   │   ├── popup.html/js/css
│   │   └── icons/
│   ├── subhd-search/             # SubHD 字幕搜索扩展（右键搜索字幕，支持自定义搜索主页）
│   │   ├── manifest.json
│   │   ├── background.js
│   │   ├── search-url.js
│   │   ├── popup.html/js/css
│   │   └── icons/
│   ├── tgtodrive-search/         # TTD 搜索扩展（右键搜索 NAS 上 TgtoDrive 影视探索，注入式，支持自定义地址）
│   │   ├── manifest.json
│   │   ├── background.js
│   │   ├── search-url.js
│   │   ├── popup.html/js/css
│   │   └── icons/
│   ├── imdb-search/             # IMDB 搜索扩展（右键搜索，通过 TMDB API 翻译中文）
│       ├── manifest.json
│       ├── background.js
│       ├── popup.html/js/css
│       ├── options.html/js/css
│       └── icons/
│   ├── enhance-pansou/          # 盘搜～观影增强扩展（影片详情页拼接 PanSou 盘搜结果，双地址可配置）
│       ├── manifest.json
│       ├── background.js        # PanSou API 客户端 + 缓存 + 频率限制
│       ├── shared.js            # 地址归一化 + 标题提取（popup/options/content 共用）
│       ├── content.js/css       # 详情页图标 + 表格拼接
│       ├── popup.html/js/css
│       ├── options.html/js/css
│       └── icons/
│   ├── pansou-search/           # PanSou 盘搜扩展（右键/弹窗注入式搜索盘搜，支持自定义地址）
│       ├── manifest.json
│       ├── background.js
│       ├── search-url.js
│       ├── popup.html/js/css
│       └── icons/
│   ├── juying-search/           # JuYing 聚影搜索扩展（右键/弹窗注入式，站内影片 + 聚合网盘双入口，支持自定义地址）
│       ├── manifest.json
│       ├── background.js
│       ├── search-url.js
│       ├── popup.html/js/css
│       └── icons/
│   ├── dianying-search/         # DianYing 癫影搜索扩展（右键/弹窗直开搜索 URL，电影/剧集/动漫三分类，支持自定义搜索主页）
│       ├── manifest.json
│       ├── background.js
│       ├── search-url.js
│       ├── popup.html/js/css
│       └── icons/
│   ├── panlian-search/         # PanLian 盘链搜索扩展（右键/弹窗直开搜索 URL，支持自定义搜索主页）
│       ├── manifest.json
│       ├── background.js
│       ├── search-url.js
│       ├── popup.html/js/css
│       └── icons/
│   ├── zhenying-search/         # ZhenYing 帧影搜索扩展（右键/弹窗直开搜索 URL，支持自定义搜索主页）
│       ├── manifest.json
│       ├── background.js
│       ├── search-url.js
│       ├── popup.html/js/css
│       └── icons/
│   └── cloud-drive-helper/     # 云盘助手（三云盘连接、分享转存与磁力下载）
│       ├── manifest.json
│       ├── background.js
│       ├── directory-cache.js   # 隔离的根目录缓存
│       ├── transfer-panel.html/js/css # 原生任务侧栏
│       ├── guangya-api.js       # 开发者签名 / 网页 Bearer、目录列表、跨后台休眠限流
│       ├── guangya-auth.js     # 手机验证码登录与本机持久会话续期
│       ├── web-session.js       # 按需读取指定光鸭官网登录项
│       ├── pan115-api.js        # 分客户端二维码 / 会话交换 / 只读目录接口
│       ├── pan115-background.js # 持久会话、类型和账号隔离、受限请求头规则
│       ├── pan123-api.js        # 账号密码登录、签名、只读根目录分页
│       ├── pan123-background.js # 本机令牌、账号隔离与目标保存
│       ├── magnet-link.js       # 单条 BTIH 磁力解析，不处理种子
│       ├── magnet-api.js        # 指定目录离线提交、状态与完成核验
│       ├── share-link.js        # 官方分享地址与提取码解析
│       ├── share-transfer.js    # 三云盘转存、任务状态与目录回读核验
│       ├── transfer-background.js # 账号目标绑定、临时会话规则和结果状态
│       ├── transfer.html/js     # 独立转存结果页
│       ├── popup.html/js/css
│       └── tests/               # 合成测试与界面预览
├── AGENTS.md
├── README.md
└── .gitignore
```

## 技术栈

- Chrome Manifest V3
- Service Worker（后台运行）
- 简单搜索扩展仅申请 `contextMenus` 权限；hdhive-search 额外申请 `storage`；xcili-search 额外申请 `activeTab` 和 `storage`；mukaku-search 额外申请 `storage`；kuakeq-search 额外申请 `storage`；jiaofu-search 额外申请 `storage`；subhd-search 额外申请 `storage`；imdb-search 申请 `storage`；tgtodrive-search 额外申请 `storage` 和 `scripting`（注入填词脚本），host 权限 `<all_urls>`（目标为自建 NAS，地址可配置无法预先限定）；enhance-pansou 申请 `storage` 和 `scripting`（content script 注入详情页），host 权限 `<all_urls>`（观影站与盘搜地址均可配置）；pansou-search 额外申请 `storage` 和 `scripting`（注入填词脚本），host 权限 `<all_urls>`（盘搜地址可配置）；juying-search 额外申请 `storage` 和 `scripting`（注入填词脚本），host 权限 `<all_urls>`（聚影地址可配置）；dianying-search 仅申请 `contextMenus` 和 `storage`（直开搜索 URL，无注入）；panlian-search 仅申请 `contextMenus` 和 `storage`（直开搜索 URL，无注入）；zhenying-search 仅申请 `contextMenus` 和 `storage`（直开搜索 URL，无注入）
- 零依赖，纯原生 JS
### 云盘助手开发边界

使用、权限、验收与测试入口见 [云盘助手使用与维护](docs/cloud-drive-helper.md)。修改时保留以下约束：

- 图标通过 `openOptionsPage` 打开独立配置页，任务使用窗口级原生 `sidePanel`；右键回调在任何异步等待前调用 `sidePanel.open({ windowId })`。配置页打开侧栏消息不排进下载队列。不设置 `default_popup`，不注入任务 iframe、不申请 `activeTab`、不公开任务页为网页资源；仅可信扩展页面可读取任务。
- 外部 API 固定主机，各服务请求间隔至少 2 秒；限流时间跨后台休眠保存。账号、授权方式、115 客户端与目标隔离，旧连接 ID 不得覆盖新目标。网络错误保留会话，明确认证失败标记未连接。测试、日志和 fixtures 仅用合成数据。
- 光鸭普通账号支持短信登录及官网备用；短信仅登录已有账号、不注册，发送至少间隔 60 秒，遇人机验证停止。短信访问／刷新令牌只存本机 `TRUSTED_CONTEXTS`，手机号与验证码不持久保存；官网备用只主动读取本扩展打开的指定标签登录项，访问令牌存 `storage.session`，不读取官网刷新令牌。仅实际操作时续期，读取状态及入队不联网；续期保持账号、连接身份与目标。开发者凭证目标独立，仅用于目录浏览。成功响应可省略 `code`，需校验 `msg` 和结构。短信测试模拟 `fetch`，不发送真实验证码。
- 115 按所选客户端扫码并保存本机会话，Cookie 不返回配置页、不改变浏览器 Cookie。临时请求头规则仅匹配本扩展当前接口，结束移除；分享规则 ID 为 116。扫码总期限两分钟，长轮询超时不突破总期限。首次或同账号先保存会话以便刷新；切换不同账号等目录成功后替换。网页目录错误 230012 仅沿用同一会话尝试一次所选客户端目录接口，不换类型。ID 保持字符串，客户端字段为 `fid/fc/fn/fs`，默认仅展示根目录第一层文件夹，完整扫描经显式开关开启。
- 123 固定 `https://api.123278.com/b/api/`，账号密码登录只持久保存令牌，不保存密码、不自动重登，暂不支持验证码。根目录分页只展示文件夹；切换不同账号失败保留旧状态。
- 全目录扫描由配置页显式开启，默认关闭、不持久保存开关或全目录结果；每次消息只推进一页，页面间隔至少 5 秒并沿用服务限流。关闭、换连接或异常停止，不自动重试；结果按页面与账号范围隔离，子目录目标保存完整路径，转存核验实际父目录。后台重启后要求重新开启，不能静默从头扫描。
- 根目录缓存按提供方、授权方式和客户端隔离，连接变化、退出或会话过期失效。打开页面先读状态和缓存，无缓存才请求目录；刷新和测试连接强制读取。
- 分享和磁力提交队列与执行队列分离；入队绑定账号目录，执行及写入前复核 ID 与名称。不默认根目录、不覆盖、不自动重试写入。任务完成后必须回读原目标才显示成功，不确定结果单独标记。分享只接受单个官方分享链接及提取码，不执行任意 URL。
- 磁力为独立菜单，由用户选择云盘，不换盘、不上传种子、不修改默认目录。显式传 `wp_path_id`／`parentId`／`upload_dir`；提交后释放队列，`alarms` 约每分钟只读查询。换账号或目录停止旧查询，不移动任务；记录在 `storage.session`，重载后不恢复写入。123 离线状态 1=失败、2=完成、3=服务端重试；光鸭首项省略 `fileIndex` 视为 0，但拒绝重复编号。
- 115 磁力校验账号目录后直接提交一次，由创建接口判断已存在或失败。不得添加提交前历史扫描或页数前置条件；提交后仅从最近任务页定位本次哈希，不扫描历史或移动旧任务。磁力改动必须回归分享转存与配置链路。

## 开发约定

- 每个扩展独立，互不依赖，可单独安装和发布
- 新增搜索扩展时在 `extensions/` 下创建独立子目录，结构参照现有扩展
- `background.js` 统一使用 `const` 声明常量，模板字符串拼接 URL
- 搜索 URL 中的查询参数必须 `encodeURIComponent` 编码
- 图标推荐提供 16/48/128 三种尺寸（多尺寸放 `icons/` 目录，单文件也可）

## 搜索 URL 格式

| 扩展 | URL 模板 |
|------|----------|
| HDHive | `https://hdhive.com/search?query={keyword}&type=multi&page=1`（域名可配置） |
| 豆瓣 | `https://search.douban.com/movie/subject_search?search_text={keyword}` |
| 123盘 | `https://us.pan1.me/?search-{encoded}-1.htm`（编码规则：`encodeURIComponent` 后 `%` → `_`） |
| XCili | `https://xcili.com/search?q={keyword}` |
| 不太灵 | `https://web2.mukaku.com/search?sb={keyword}`（域名可配置，存储在 `chrome.storage`） |
| KuakeQ | `https://www.kuakeq.com/search-{encoded}-1-1.htm`（编码规则：`encodeURIComponent` 后 `%` → `_`，域名可配置） |
| 观影 | `https://www.xn--wcv59z.com/search?q={keyword}&type=&mode=1`（域名可配置） |
| SubHD | `https://subhd.tv/search/{keyword}`（域名可配置） |
| IMDB | `https://www.imdb.com/find/?q={keyword}`（中文通过 TMDB API 翻译后搜索） |
| TTD | 不走 URL 参数（搜索为纯前端状态）：打开配置地址后注入脚本，先点击 `.nav-item[data-target="media-library-section"]` 切到影视探索区块（单页多 section，URL 不变），再向 `#md-library-query` 填词并模拟 Enter；复用已打开的 TTD 标签页（地址可配置，存储在 `chrome.storage`，需浏览器已登录 TgtoDrive） |
| 盘搜～观影增强 | 不跳转：影片详情页（如 `/tv/7yjx`）标题旁注入盘搜按钮，点击后 background 调 `GET {pansou}/api/search?kw={主标题}&res=merge`；仅取夸克/光鸭/115/123 四类云盘（`merged_by_type`）按类型拼进"网盘资源"对应 `bit_list` 表（类型名在各表的 `<caption>`，缺表则新建）+ 磁力/ed2k 拼进"磁力资源"表（名称列 `盘搜～{note}` + 复制按钮）；按链接 URL 与原生行去重，注入行标记 `data-pansou`；再次点击图标强制刷新（`refresh=1`），铅笔按钮可改词重搜；主标题从 h1 提取（去季/部标记与年份）；观影站与盘搜地址均可配置（存储在 `chrome.storage`） |
| PanSou Search | 不走 URL 参数（前端不读 query，搜索为纯前端状态）：打开配置地址后注入脚本，向 `input[placeholder^="搜索资源"]` 填词（native setter + input 事件）并模拟 Enter；复用已打开的盘搜标签页（地址可配置，存储在 `chrome.storage`，裸主机名默认补 `http://`）；popup 支持手动输入关键词搜索，复用同一条注入链路 |
| JuYing | 不走 URL 参数（站内/聚合搜索均为纯前端状态）：打开配置地址的 `/search` 后注入脚本，点击对应 `.n-tabs-tab`（站内搜索/聚合搜索）→ 向可见的 `input.n-input__input-el` 填词（native setter + input 事件）→ 点击 main 内文本为"搜索"的按钮；复用已打开的聚影标签页（地址可配置，存储在 `chrome.storage`，默认 `https://www.jying.top`）；popup 支持手动输入关键词，站内/聚合两个入口复用同一条注入链路 |
| DianYing | `https://m.dian115.com/discover?kind={movie|tv|anime}&q={keyword}`（三分类菜单，不带 kind 时站点默认电影，域名可配置） |
| 盘链 | `https://pinglian.lol/pages/search.php?q={keyword}`（域名可配置） |
| 帧影 | `https://framehdr.com/search.php?q={keyword}`（域名可配置） |

## 发布流程

云盘助手的合成测试：`fnm exec --using=22.22.2 node --test extensions/cloud-drive-helper/tests/*.test.js`。测试与预览只使用合成数据，不写入真实凭证或目录内容。

1. 修改代码
2. `chrome://extensions` 刷新扩展并测试
3. 升级 `manifest.json` 中的 `version`
4. 提交并推送到 GitHub
