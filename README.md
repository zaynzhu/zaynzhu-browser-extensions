<div align="center">

# ✦ Browser Search Extensions

**浏览器右键搜索扩展合集** · 选中文字，右键一搜，影视资源触手可及

[![GitHub Stars](https://img.shields.io/github/stars/zaynzhu/person-browser-extensions?style=flat&logo=github&color=yellow&label=Stars)](https://github.com/zaynzhu/person-browser-extensions/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/zaynzhu/person-browser-extensions?style=flat&logo=github&color=purple&label=Forks)](https://github.com/zaynzhu/person-browser-extensions/network)
[![Last Commit](https://img.shields.io/github/last-commit/zaynzhu/person-browser-extensions?logo=github&label=Last%20Commit)](https://github.com/zaynzhu/person-browser-extensions/commits/main)
[![Extensions](https://img.shields.io/badge/Extensions-6-6366f1?style=flat&logo=googlechrome&logoColor=white)](./extensions/)
[![Manifest](https://img.shields.io/badge/Manifest-V3-4EAA25?style=flat&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![License](https://img.shields.io/badge/License-MIT-0ea5e9?style=flat&logo=opensourceinitiative&logoColor=white)](./LICENSE)

</div>

---

## 扩展索引

| &nbsp; | 扩展 | 目标网站 | 简介 | 状态 |
|:------:|------|----------|------|:----:|
| 🐝 | [**HDHive Search**](./extensions/hdhive-search/) | [hdhive.com](https://hdhive.com) | 基于 TMDB 的影视资料聚合搜索（电影+剧集） | `stable` |
| 📖 | [**Douban Search**](./extensions/douban-search/) | [search.douban.com](https://search.douban.com) | 豆瓣影视评分搜索 | `stable` |
| ☁️ | [**123盘 Search**](./extensions/123pan-search/) | [us.pan1.me](https://us.pan1.me) | 123 云盘资源分享社区搜索 | `stable` |
| 🔍 | [**XCili Search**](./extensions/xcili-search/) | [xcili.com](https://xcili.com) | 磁力链接搜索，弹窗展示结果，支持一键复制磁力链接 | `stable` |
| 🔎 | [**Mukaku Search**](./extensions/mukaku-search/) | [web2.mukaku.com](https://web2.mukaku.com) | 不太灵磁力搜索，支持自定义搜索主页（域名经常变更） | `stable` |
| 🎬 | [**IMDB Search**](./extensions/imdb-search/) | [imdb.com](https://www.imdb.com) | 中文关键词通过 TMDB API 自动翻译后搜索 IMDB | `stable` |

---

## 使用方式

### 基础用法（所有扩展通用）

1. 在任意网页选中文字
2. 右键点击对应的搜索菜单项
3. 在新标签页查看搜索结果

### 手动输入搜索

XCili、Mukaku、IMDB 三个扩展支持点击扩展图标，在弹窗中手动输入关键词搜索。

### IMDB 翻译功能

IMDB 扩展通过 [TMDB API](https://www.themoviedb.org/) 将中文关键词翻译为英文后再搜索 IMDB。华语电影会跳过翻译直接搜索。翻译失败时自动降级为中文搜索。

**配置步骤：**
1. 在 [TMDB 官网](https://www.themoviedb.org/settings/api) 注册并获取 API Key
2. 右键点击扩展图标 → 选项 → 填入 API Key → 保存
3. 也可在弹窗中点击「配置 API Key」跳转

> 未配置 API Key 时，扩展仍可正常使用，只是用中文直接搜索 IMDB。

### 不太灵域名变更

不太灵的域名经常变更。点击扩展图标，在弹窗中修改搜索主页地址并保存即可，右键搜索将自动使用新域名。

---

## 安装

```bash
git clone https://github.com/zaynzhu/person-browser-extensions.git
```

1. 打开 Chrome，地址栏输入 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择对应的扩展目录：

| 扩展 | 目录路径 |
|------|----------|
| HDHive | `extensions/hdhive-search/` |
| 豆瓣 | `extensions/douban-search/` |
| 123盘 | `extensions/123pan-search/` |
| 无极磁力 | `extensions/xcili-search/` |
| 不太灵 | `extensions/mukaku-search/` |
| IMDB | `extensions/imdb-search/` |

> 六个扩展互相独立，可按需安装，也可以同时安装全部。

---

## 权限说明

| 扩展 | `contextMenus` | `storage` | `activeTab` | 说明 |
|------|:--------------:|:---------:|:-----------:|------|
| HDHive | ✅ | - | - | 纯右键跳转 |
| 豆瓣 | ✅ | - | - | 纯右键跳转 |
| 123盘 | ✅ | - | - | 纯右键跳转 |
| XCili | ✅ | ✅ | ✅ | 弹窗搜索 + 结果展示 |
| Mukaku | ✅ | ✅ | - | 弹窗 + 域名配置存储 |
| IMDB | ✅ | ✅ | - | 弹窗 + API Key 配置存储 |

所有扩展均不采集任何用户数据。

---

## 目录结构

```
person-browser-extensions/
├── README.md
├── CLAUDE.md
├── .gitignore
└── extensions/
    ├── hdhive-search/           # 聚合搜索 — manifest + background.js
    │   ├── manifest.json
    │   ├── background.js
    │   └── icons/
    ├── douban-search/           # 豆瓣搜索 — manifest + background.js
    │   ├── manifest.json
    │   ├── background.js
    │   └── icon.png
    ├── 123pan-search/           # 123盘搜索 — manifest + background.js
    │   ├── manifest.json
    │   ├── background.js
    │   └── icons/
    ├── xcili-search/            # 磁力搜索 — 弹窗 + 结果展示
    │   ├── manifest.json
    │   ├── background.js
    │   ├── popup.html / js / css
    │   └── icons/
    ├── mukaku-search/           # 不太灵 — 弹窗 + 域名配置
    │   ├── manifest.json
    │   ├── background.js
    │   ├── popup.html / js / css
    │   └── icons/
    └── imdb-search/             # IMDB — 弹窗 + API Key 配置
        ├── manifest.json
        ├── background.js
        ├── popup.html / js / css
        ├── options.html / js / css
        └── icons/
```

---

## 搜索 URL 格式

| 扩展 | URL 模板 |
|------|----------|
| HDHive | `hdhive.com/search?query={keyword}&type=multi&page=1` |
| 豆瓣 | `search.douban.com/movie/subject_search?search_text={keyword}` |
| 123盘 | `us.pan1.me/?search-{encoded}-1.htm`（`encodeURIComponent` 后 `%` → `_`） |
| XCili | `xcili.com/search?q={keyword}` |
| 不太灵 | `web2.mukaku.com/search?sb={keyword}`（域名可配置） |
| IMDB | `imdb.com/find/?q={keyword}`（中文通过 TMDB 翻译后搜索） |

---

## 技术细节

- **Manifest V3** — Service Worker 后台运行
- **极简权限** — 仅申请必要权限，不采集任何用户数据
- **零依赖** — 纯原生 JavaScript，无第三方库
- **新标签打开** — 搜索结果在独立标签页展示，不干扰当前浏览

---

## 添加新扩展

```bash
# 1. 新建目录（小写连字符命名）
mkdir extensions/my-new-search

# 2. 创建 manifest.json 和 background.js
# 3. 参照现有扩展的结构实现
# 4. 在本文件的扩展索引中补充一行记录
```

---

<div align="center">
<sub>持续更新中 · 欢迎 Fork 构建你自己的搜索扩展库</sub>
</div>
