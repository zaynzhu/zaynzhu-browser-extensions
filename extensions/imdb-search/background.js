// imdb-search/background.js — 右键搜索 IMDB，通过 TMDB API 翻译中文

const TMDB_API_BASE = 'https://api.themoviedb.org/3'
const IMDB_SEARCH_URL = 'https://www.imdb.com/find/'
const REQUEST_TIMEOUT = 10000

// ========== 右键菜单 ==========
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'search-imdb',
    title: '在 IMDB 搜索"%s"',
    contexts: ['selection'],
  })
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'search-imdb' && info.selectionText) {
    const keyword = info.selectionText.trim()
    await searchIMDB(keyword)
  }
})

// ========== 消息处理（来自 popup） ==========
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SEARCH') {
    searchIMDB(message.keyword).then((result) => {
      sendResponse(result)
    })
    return true
  }
})

// ========== 搜索主流程 ==========
async function searchIMDB(keyword) {
  try {
    // 获取 API key
    const { tmdbApiKey } = await chrome.storage.local.get('tmdbApiKey')

    if (!tmdbApiKey) {
      // API key 未配置，直接用中文搜索
      const url = `${IMDB_SEARCH_URL}?q=${encodeURIComponent(keyword)}`
      chrome.tabs.create({ url })
      return { status: 'no_api_key', keyword }
    }

    // 调用 TMDB API 翻译
    const translated = await translateWithTMDB(keyword, tmdbApiKey)

    if (translated) {
      // 翻译成功，用英文搜索
      const url = `${IMDB_SEARCH_URL}?q=${encodeURIComponent(translated)}`
      chrome.tabs.create({ url })
      return { status: 'translated', keyword, translated }
    } else {
      // 翻译失败，用中文搜索
      const url = `${IMDB_SEARCH_URL}?q=${encodeURIComponent(keyword)}`
      chrome.tabs.create({ url })
      return { status: 'fallback', keyword }
    }
  } catch (error) {
    console.error('[imdb] 搜索失败:', error)
    // 出错时用中文搜索
    const url = `${IMDB_SEARCH_URL}?q=${encodeURIComponent(keyword)}`
    chrome.tabs.create({ url })
    return { status: 'error', keyword, error: error.message }
  }
}

// ========== TMDB API 调用 ==========
async function translateWithTMDB(keyword, apiKey) {
  try {
    const url = `${TMDB_API_BASE}/search/movie?query=${encodeURIComponent(keyword)}&language=zh-CN&api_key=${apiKey}`
    const response = await fetchWithTimeout(url)
    const data = await response.json()

    if (data.results && data.results.length > 0) {
      const result = data.results[0]
      // 中文电影的 original_title 本身就是中文，翻译无意义
      if (result.original_language === 'zh') {
        return null
      }
      // 返回第一个结果的原始语言标题（通常为英文）
      return result.original_title
    }
    return null
  } catch (error) {
    console.error('[imdb] TMDB API 调用失败:', error)
    return null
  }
}

// ========== 网络请求 ==========
async function fetchWithTimeout(url, timeoutMs = REQUEST_TIMEOUT) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response
  } finally {
    clearTimeout(timer)
  }
}
