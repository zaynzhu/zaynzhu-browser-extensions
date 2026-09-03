importScripts('shared.js')

const CACHE_TTL_MS = 10 * 60 * 1000
const MIN_REQUEST_INTERVAL_MS = 2000
const REQUEST_TIMEOUT_MS = 15000

// 同一关键词的内存缓存（service worker 存活期内有效）
const cache = new Map()
let lastRequestAt = 0

// ========== 消息处理 ==========
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'pansou-search') {
    handleSearch(msg)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }))
    return true
  }

  if (msg.type === 'get-config') {
    getConfig().then((config) => sendResponse({ ok: true, data: config }))
    return true
  }
})

async function getConfig() {
  const data = await chrome.storage.local.get([
    globalThis.PansouEnhance.SITE_STORAGE_KEY,
    globalThis.PansouEnhance.PANSOU_STORAGE_KEY,
  ])

  return {
    siteUrl: globalThis.PansouEnhance.normalizeSiteUrl(data[globalThis.PansouEnhance.SITE_STORAGE_KEY]),
    pansouUrl: globalThis.PansouEnhance.normalizePansouUrl(data[globalThis.PansouEnhance.PANSOU_STORAGE_KEY]),
  }
}

async function handleSearch({ keyword, refresh }) {
  const { pansouUrl } = await getConfig()
  const kw = (keyword || '').trim()

  if (!kw) {
    throw new Error('关键词为空')
  }

  const cacheKey = `${pansouUrl}|${kw}`
  const cached = cache.get(cacheKey)

  if (!refresh && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data
  }

  // 外部 API 频率限制：连续请求间隔不低于 2 秒
  const sinceLast = Date.now() - lastRequestAt
  if (sinceLast < MIN_REQUEST_INTERVAL_MS) {
    await sleep(MIN_REQUEST_INTERVAL_MS - sinceLast)
  }

  const data = await fetchPansou(pansouUrl, kw)
  lastRequestAt = Date.now()
  cache.set(cacheKey, { at: Date.now(), data })

  return data
}

async function fetchPansou(pansouUrl, keyword) {
  const params = new URLSearchParams({ kw: keyword, res: 'merge' })
  const url = `${pansouUrl}/api/search?${params.toString()}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, { signal: controller.signal })

    if (!response.ok) {
      throw new Error(`PanSou 响应异常 (${response.status})`)
    }

    const body = await response.json()

    if (body.code !== 0 || !body.data) {
      throw new Error(body.message || 'PanSou 返回数据异常')
    }

    return body.data
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('PanSou 请求超时')
    }

    throw error
  } finally {
    clearTimeout(timer)
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}