# xcili-search 扩展设计

## 概述

独立的 Chrome 扩展，用于在 xcili.com 搜索番号的磁力链接。支持右键选中番号搜索和 popup 手动输入，展示过滤后的最优 1 条结果。

## 架构

```
xcili-search/
├── manifest.json          # MV3, permissions: contextMenus + activeTab
├── background.js          # Service Worker: 右键菜单 + 搜索 + HTML解析 + 过滤
├── popup.html             # 弹窗 UI
├── popup.js               # 弹窗逻辑
├── popup.css              # 样式
└── icons/                 # 16/48/128
```

## 功能

### 右键搜索
- 选中文本 → 右键菜单"在无极磁力搜索"
- 发消息给 background → 搜索 xcili.com → 结果存 storage → popup 读取展示

### Popup 手动输入
- 点击扩展图标打开 popup
- 输入框 + 搜索按钮
- 结果卡片展示

### 搜索逻辑（复用 av-pipeline）
1. fetch `https://xcili.com/search?q=<code>` 获取 HTML
2. 正则解析搜索结果列表（标题、文件名、大小、详情页 URL）
3. 过滤合集（关键词排除 + 大小排除）
4. 按番号匹配度 + 文件大小排序，取最优 1 条
5. 请求详情页获取磁力链接、日期、hash

### 结果展示字段
- 标题（title）
- 文件大小（size）
- 磁力链接（magnet，可一键复制）
- 发布日期（date）
- 种子特征码（hash）

## 过滤逻辑

复用 av-pipeline 的 filter.js 逻辑：
- 一级排除：合集关键词、日期开头模式、数量标记、网站标记
- 二级标记：疑似合集（part N、>=50GB、文件数>5）
- 候选排序：番号匹配度 * 10 + 中文版/无码版/高清标记 + 文件大小
- 取最优 1 条展示

## 权限

- `contextMenus`: 右键菜单
- `activeTab`: 访问当前标签页获取选中文本

## 与 av-pipeline 的区别

- 独立扩展，零依赖
- 单个番号搜索，不做批量
- 只展示最优 1 条
- Popup 内展示，不走 Side Panel
