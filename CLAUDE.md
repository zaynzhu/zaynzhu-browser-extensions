# person-browser-extensions 开发规范

## 项目概述

轻量级 Chrome 浏览器右键搜索扩展合集，选中文字即可跳转影视网站搜索。

## 目录结构

```
person-browser-extensions/
├── extensions/                # 所有扩展的汇总目录
│   ├── hdhive-search/         # HDHive 搜索扩展
│   │   ├── manifest.json
│   │   ├── background.js
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
│   └── mukaku-search/           # 不太灵搜索扩展（右键搜索，支持自定义搜索主页）
│       ├── manifest.json
│       ├── background.js
│       ├── popup.html/js/css
│       └── icons/
├── CLAUDE.md
├── README.md
└── .gitignore
```

## 技术栈

- Chrome Manifest V3
- Service Worker（后台运行）
- 简单搜索扩展仅申请 `contextMenus` 权限；xcili-search 额外申请 `activeTab` 和 `storage`；mukaku-search 额外申请 `storage`
- 零依赖，纯原生 JS

## 开发约定

- 每个扩展独立，互不依赖，可单独安装和发布
- 新增搜索扩展时在 `extensions/` 下创建独立子目录，结构参照现有扩展
- `background.js` 统一使用 `const` 声明常量，模板字符串拼接 URL
- 搜索 URL 中的查询参数必须 `encodeURIComponent` 编码
- 图标推荐提供 16/48/128 三种尺寸（多尺寸放 `icons/` 目录，单文件也可）

## 搜索 URL 格式

| 扩展 | URL 模板 |
|------|----------|
| HDHive | `https://hdhive.com/search?query={keyword}&type=multi&page=1` |
| 豆瓣 | `https://search.douban.com/movie/subject_search?search_text={keyword}` |
| 123盘 | `https://us.pan1.me/?search-{encoded}-1.htm`（编码规则：`encodeURIComponent` 后 `%` → `_`） |
| XCili | `https://xcili.com/search?q={keyword}` |
| 不太灵 | `https://web2.mukaku.com/search?sb={keyword}`（域名可配置，存储在 `chrome.storage`） |

## 发布流程

1. 修改代码
2. `chrome://extensions` 刷新扩展并测试
3. 升级 `manifest.json` 中的 `version`
4. 提交并推送到 GitHub