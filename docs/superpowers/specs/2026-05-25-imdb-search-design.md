# IMDB 搜索扩展设计文档

## 概述

本扩展为用户提供右键搜索 IMDB 的功能，核心特点是支持中文搜索：用户选中中文文字后，扩展通过 TMDB API 将中文翻译为英文，然后跳转到 IMDB 搜索页面。

## 核心功能

1. **右键搜索**：选中中文文字，右键菜单选择"在 IMDB 搜索"
2. **Popup 搜索**：点击扩展图标，在弹出窗口中输入中文关键词搜索
3. **中文转英文**：通过 TMDB API 将中文电影名转换为英文名
4. **直接跳转**：获取英文名后直接跳转到 IMDB 搜索页面

## 技术架构

### 文件结构

```
imdb-search/
├── manifest.json        # 扩展配置
├── background.js        # 后台服务：右键菜单、TMDB API 调用
├── popup.html          # Popup 搜索界面
├── popup.js            # Popup 逻辑
├── popup.css           # Popup 样式
├── options.html        # 配置页面：API key 设置
├── options.js          # 配置页面逻辑
├── options.css         # 配置页面样式
└── icons/              # 扩展图标
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### 数据流

1. 用户右键选中中文文字
2. background.js 调用 TMDB API：
   ```
   GET https://api.themoviedb.org/3/search/movie?query={中文}&language=zh-CN&api_key={key}
   ```
3. 从响应中获取第一个结果的英文名（`original_title`）
4. 跳转到 IMDB 搜索页面：
   ```
   https://www.imdb.com/find/?q={英文名}
   ```

### 配置存储

- 使用 `chrome.storage.local` 存储 TMDB API key
- 提供 options.html 页面让用户配置 API key
- 页面包含：
  - API key 输入框
  - 保存按钮
  - 测试按钮（验证 API key 是否有效）

### 错误处理

1. **API key 未配置**：提示用户配置 API key，提供跳转到 options 页面的链接
2. **API key 无效**：提示用户 API key 无效，请重新配置
3. **TMDB API 调用失败**（网络错误、超时等）：直接用中文跳转 IMDB 搜索，不显示额外提示
4. **TMDB 搜索无结果**：直接用中文跳转 IMDB 搜索

## 权限配置

### manifest.json 权限

```json
{
  "permissions": ["contextMenus", "storage", "activeTab"],
  "host_permissions": ["https://api.themoviedb.org/*"]
}
```

- `contextMenus`：右键菜单功能
- `storage`：存储 API key
- `activeTab`：访问当前标签页
- `host_permissions`：允许访问 TMDB API

## 用户界面

### Popup 界面

- 搜索输入框：输入中文关键词
- 搜索按钮：触发搜索
- 状态提示：
  - API key 未配置时显示配置提示
  - 搜索中显示加载状态
  - 错误时显示错误信息

### Options 界面

- API key 输入框
- 保存按钮
- 测试按钮：验证 API key 是否有效
- 状态提示：保存成功/失败、测试成功/失败

## 与现有扩展的一致性

本扩展遵循项目中其他扩展的代码风格和结构：

1. **右键菜单**：参考 xcili-search 和 mukaku-search 的实现
2. **Popup 界面**：参考 xcili-search 的 popup 设计
3. **配置存储**：参考 mukaku-search 的 chrome.storage 使用
4. **错误处理**：参考 xcili-search 的错误处理逻辑

## 实现要点

1. **TMDB API 调用**：使用 fetch API，设置超时时间（10秒）
2. **API key 验证**：调用 TMDB API 的配置接口验证 key 是否有效
3. **中文编码**：使用 encodeURIComponent 编码中文关键词
4. **错误降级**：TMDB API 失败时直接用中文搜索 IMDB
5. **用户提示**：使用 chrome.notifications 或页面内提示告知用户状态

## 成功标准

1. 用户可以右键选中中文文字，搜索 IMDB
2. 用户可以在 Popup 中输入中文关键词，搜索 IMDB
3. 中文关键词能正确转换为英文名
4. 错误情况有明确的用户提示
5. API key 配置流程简单易用
