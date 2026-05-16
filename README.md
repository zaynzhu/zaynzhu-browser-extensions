# 🎬 Browser Search Extensions

> 选中文字，右键一搜，影视信息触手可及。

一组轻量级 Chrome 浏览器扩展，让你在任意网页选中文本后，通过右键菜单快速跳转到影视网站搜索。无需切换标签、无需复制粘贴——选中即搜。

---

## ✨ 扩展一览

### 🐝 HDHive Search

| 项目 | 说明 |
|------|------|
| 目标网站 | [HDHive](https://hdhive.com) — 基于 TMDB 的影视资料聚合站 |
| 搜索模式 | 聚合搜索（电影 + 剧集） |
| 搜索 URL | `hdhive.com/search?query=关键词&type=multi&page=1` |
| 版本 | 1.0.0 |
| Manifest | V3 |

**使用方式：** 在任意网页选中影视名称（如「星际穿越」），右键点击 **「在 HDHive 搜索"星际穿越"」**，即可在新标签页打开 HDHive 的搜索结果页面。网站需要已登录，搜索结果将自动携带登录态。

### 📖 豆瓣搜索

| 项目 | 说明 |
|------|------|
| 目标网站 | [豆瓣](https://search.douban.com) — 影视/图书/音乐评分与评论 |
| 搜索模式 | 影视搜索 |
| 搜索 URL | `search.douban.com/movie/subject_search?search_text=关键词` |
| 版本 | 1.0 |
| Manifest | V3 |

**使用方式：** 在任意网页选中影视名称，右键点击 **「在豆瓣搜索"关键词"」**，即可在新标签页打开豆瓣的影视搜索结果。

### ☁️ 123盘搜索

| 项目 | 说明 |
|------|------|
| 目标网站 | [123分享社区](https://us.pan1.me) — 123云盘资源分享社区 |
| 搜索模式 | 关键词搜索（主题贴） |
| 搜索 URL | `us.pan1.me/?search-编码关键词-1.htm` |
| 版本 | 1.0 |
| Manifest | V3 |

**使用方式：** 在任意网页选中资源名称（如「星球大战」），右键点击 **「在123盘搜索"星球大战"」**，即可在新标签页打开123分享社区的搜索结果页面。

> **编码说明：** 123盘搜索URL使用自定义编码——先 `encodeURIComponent`，再将 `%` 替换为 `_`。例如「星球大战」编码为 `_E6_98_9F_E7_90_83_E5_A4_A7_E6_88_98`。

### 🔍 XCili Search

| 项目 | 说明 |
|------|------|
| 目标网站 | [xcili.com](https://xcili.com) — 磁力链接搜索引擎 |
| 搜索模式 | 关键词搜索，智能过滤，展示最优结果 |
| 搜索 URL | `xcili.com/search?q=关键词` |
| 版本 | 1.0.0 |
| Manifest | V3 |

**使用方式：** 两种方式——
1. **右键搜索：** 在任意网页选中关键词，右键点击 **「在无极磁力搜索"关键词"」**
2. **手动输入：** 点击扩展图标，在弹窗中输入关键词搜索

搜索结果展示在弹窗中：标题、大小、磁力链接（可一键复制）、发布日期、种子特征码。

---

## 🚀 安装方法

1. 将本仓库克隆到本地：
   ```bash
   git clone https://github.com/zaynzhu/person-browser-extensions.git
   ```
2. 打开 Chrome，地址栏输入 `chrome://extensions/`
3. 开启右上角 **「开发者模式」**
4. 点击 **「加载已解压的扩展程序」**
5. 选择对应的扩展目录：
   - HDHive → `person-browser-extensions/hdhive-search/`
   - 豆瓣  → `person-browser-extensions/douban-search/`
   - 123盘 → `person-browser-extensions/123pan-search/`
   - 无极磁力 → `person-browser-extensions/xcili-search/`
6. 安装完成，右键菜单即可使用

> 💡 **提示：** 四个扩展互相独立，可以只安装其中一个，也可以同时安装。

---

## 📂 项目结构

```
person-browser-extensions/
├── hdhive-search/            # HDHive 搜索扩展
│   ├── manifest.json
│   ├── background.js
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── douban-search/            # 豆瓣搜索扩展
│   ├── manifest.json
│   ├── background.js
│   └── icon.png
├── 123pan-search/            # 123盘搜索扩展
│   ├── manifest.json
│   ├── background.js
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── xcili-search/             # 无极磁力搜索扩展
│   ├── manifest.json
│   ├── background.js
│   ├── popup.html
│   ├── popup.js
│   ├── popup.css
│   └── icons/
├── .gitignore
└── README.md
```

---

## 🔧 技术细节

- **Manifest V3** — 使用最新 Chrome 扩展标准，Service Worker 后台运行
- **极简权限** — 仅申请 `contextMenus` 权限，不读取网页内容、不追踪用户行为
- **零依赖** — 无需任何第三方库，代码总量不足 30 行
- **新标签打开** — 搜索结果在独立标签页展示，不干扰当前浏览

---

## 📄 许可证

MIT License