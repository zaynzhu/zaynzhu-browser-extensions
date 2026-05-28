# KuakeQ Search 扩展设计

## 概述

新增一个 Chrome 右键搜索扩展，选中文字后可通过右键菜单在 KuakeQ 网站（夸客网）搜索磁力链接。支持自定义搜索主页地址。

## 搜索 URL 编码规则

输入关键词 → `encodeURIComponent(keyword)` → 将 `%` 替换为 `_` → 拼接 URL。

示例：`杀木地` → `_E6_9D_80_E6_9C_A8_E5_9C_B0` → `https://www.kuakeq.com/search-_E6_9D_80_E6_9C_A8_E5_9C_B0-1-1.htm`

URL 模板：`{baseUrl}/search-{encoded}-1-1.htm`

页码和分类固定为 1-1。

## 文件结构

```
extensions/kuakeq-search/
├── manifest.json
├── background.js
├── popup.html
├── popup.js
├── popup.css
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 各文件设计

### manifest.json

- `name`: "KuakeQ Search"
- `version`: "1.0.0"
- `description`: "右键选中文字，在夸客网搜索磁力链接，支持自定义搜索主页"
- `permissions`: `["contextMenus", "storage"]`
- 默认 popup 和 icons 配置

### background.js

- 默认域名：`https://www.kuakeq.com`
- 存储键：`kuakeqBaseUrl`
- `onInstalled` 时创建右键菜单
- `storage.onChanged` 监听域名变更，重建菜单
- 右键菜单文案：`在KuakeQ搜索"%s"`
- 点击时读取存储域名，编码关键词（encodeURIComponent + %替_），拼接搜索 URL 并打开新标签页

### popup.html / popup.js / popup.css

- 完全参照 mukaku-search 的 popup 实现
- 标题改为"KuakeQ - 搜索主页设置"
- 提示文案改为"KuakeQ 域名可能变更，在此修改搜索主页地址"
- 输入框 placeholder 改为 `https://www.kuakeq.com`
- 存储键改为 `kuakeqBaseUrl`
- 默认值改为 `https://www.kuakeq.com`

### 图标

- 需要提供 16/48/128 三种尺寸的 PNG 图标
- 初始版本可使用占位图标

## 与现有扩展的关系

独立扩展，与 mukaku-search 模式相同但域名和 URL 编码规则不同。不依赖其他扩展。