// xcili-search/background.js — 搜索 xcili.com，解析 HTML，过滤合集，取最优结果

const XCILI_BASE = 'https://xcili.com'
const REQUEST_TIMEOUT = 10000

// ========== 右键菜单 ==========
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'search-xcili',
    title: '在无极磁力搜索"%s"',
    contexts: ['selection'],
  })
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'search-xcili' && info.selectionText) {
    const code = info.selectionText.trim()
    doSearch(code).then((result) => {
      chrome.storage.local.set({ lastSearch: { code, result } })
    })
  }
})

// ========== 消息处理（来自 popup） ==========
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SEARCH') {
    doSearch(message.code).then((result) => {
      chrome.storage.local.set({ lastSearch: { code: message.code, result } })
      sendResponse(result)
    })
    return true
  }
  if (message.type === 'GET_LAST') {
    chrome.storage.local.get('lastSearch').then((data) => {
      sendResponse(data.lastSearch || null)
    })
    return true
  }
})

// ========== 搜索主流程 ==========
async function doSearch(code) {
  try {
    const searchUrl = `${XCILI_BASE}/search?q=${encodeURIComponent(code)}`
    const html = await fetchWithTimeout(searchUrl)
    const results = parseSearchResults(html)

    if (results.length === 0) {
      return { status: 'not_found', code }
    }

    const filterResult = filterResults(results, code)
    const best = filterResult.best

    if (!best) {
      return { status: 'not_found', code, excluded: filterResult.excluded.length }
    }

    // 获取详情页磁力链接
    const detail = await fetchMagnetDetail(best.detailUrl)

    return {
      status: 'confirmed',
      code,
      title: detail.title || best.title || best.fileName,
      size: detail.size || best.size,
      sizeBytes: parseSize(detail.size || best.size),
      magnet: detail.magnet,
      date: detail.date,
      hash: detail.hash,
      detailUrl: best.detailUrl,
    }
  } catch (error) {
    return { status: 'error', code, error: error.message }
  }
}

// ========== 网络请求 ==========
async function fetchWithTimeout(url, timeoutMs = REQUEST_TIMEOUT) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.text()
  } finally {
    clearTimeout(timer)
  }
}

// ========== HTML 解析（移植自 av-pipeline html-parser.js） ==========
function parseSearchResults(html) {
  const results = []
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const row = rowMatch[1]

    const linkMatch = row.match(/<a[^>]+href="(\/![^"]+)"/)
    if (!linkMatch) continue
    const detailUrl = linkMatch[1]

    let fileName = ''
    const sampleMatch = row.match(/<p[^>]+class="sample"[^>]*>([\s\S]*?)<\/p>/)
    if (sampleMatch) {
      fileName = sampleMatch[1]
        .replace(/<[^>]+>/g, '')
        .replace(/\[email\]/g, '')
        .replace(/^\S+@/, '')
        .trim()
    }

    let linkText = ''
    const linkInnerMatch = row.match(/<a[^>]+href="\/![^"]*"([\s\S]*?)<\/a>/)
    if (linkInnerMatch) {
      linkText = linkInnerMatch[1]
        .replace(/<p[\s\S]*?<\/p>/g, '')
        .replace(/<[^>]+>/g, '')
        .trim()
    }

    let title = ''
    const titleMatch = row.match(/<b[^>]*>([\s\S]*?)<\/b>/)
    if (titleMatch) {
      title = titleMatch[1].replace(/<[^>]+>/g, '').trim()
    }

    let size = ''
    const sizeMatch = row.match(/<td[^>]+class="[^"]*td-size[^"]*"[^>]*>([\s\S]*?)<\/td>/)
    if (sizeMatch) {
      size = sizeMatch[1].replace(/<[^>]+>/g, '').trim()
    }

    results.push({ title, fileName, linkText, size, detailUrl })
  }

  return results
}

function parseDetailPage(html) {
  let magnet = null
  const magnetInputMatch = html.match(/<input[^>]+id="input-magnet"[^>]*value="([^"]+)"/)
  if (magnetInputMatch) {
    magnet = magnetInputMatch[1]
  }
  if (!magnet) {
    const magnetLinkMatch = html.match(/href="(magnet:[^"]+)"/)
    if (magnetLinkMatch) magnet = magnetLinkMatch[1]
  }

  let title = ''
  const titleMatch = html.match(/<h2[^>]+class="magnet-title"[^>]*>([\s\S]*?)<\/h2>/)
  if (titleMatch) title = titleMatch[1].replace(/<[^>]+>/g, '').trim()

  let size = '', date = '', hash = ''
  const dtRegex = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi
  let dtMatch
  while ((dtMatch = dtRegex.exec(html)) !== null) {
    const label = dtMatch[1].replace(/<[^>]+>/g, '').trim()
    const value = dtMatch[2].replace(/<[^>]+>/g, '').trim()
    if (label.includes('文件大小')) size = value
    else if (label.includes('发布日期')) date = value
    else if (label.includes('种子特征码') || label.includes('特征码')) hash = value
  }

  return { magnet, title, size, date, hash }
}

async function fetchMagnetDetail(detailUrl) {
  const url = detailUrl.startsWith('http') ? detailUrl : `${XCILI_BASE}${detailUrl}`
  const html = await fetchWithTimeout(url)
  return parseDetailPage(html)
}

// ========== 大小解析（移植自 av-pipeline size-parser.js） ==========
const SIZE_UNITS = { 'B': 1, 'KB': 1024, 'MB': 1024 ** 2, 'GB': 1024 ** 3, 'TB': 1024 ** 4 }

function parseSize(sizeStr) {
  if (!sizeStr || typeof sizeStr !== 'string') return null
  const match = sizeStr.trim().match(/^([\d.]+)\s*(B|KB|MB|GB|TB)$/i)
  if (!match) return null
  const value = parseFloat(match[1])
  const unit = match[2].toUpperCase()
  if (isNaN(value) || !SIZE_UNITS[unit]) return null
  return Math.round(value * SIZE_UNITS[unit])
}

// ========== 过滤逻辑（移植自 av-pipeline filter.js） ==========
const EXCLUDE_KEYWORDS = /合集|精選|精选|部合集|pack|专辑|連發|连发|纯净|完整版|特供|解说|破坏版/i
const EXCLUDE_DATE_PATTERN = /^\d{1,2}月\d{1,2}日[-—]/
const EXCLUDE_COUNT_PATTERN = /x\d+部?/i
const EXCLUDE_COUNT_DESC = /[一二三四五六七八九十百]+部/
const EXCLUDE_SITE_PATTERN = /\[.*\]|BT-|\.com@|wi92|btt\.com/i
const SUSPECT_KEYWORDS = /part\s*\d+|第\d+部/i
const SUSPECT_SIZE_BYTES = 50 * 1024 * 1024 * 1024
const HD_MARKERS = /4K|FHD|60fps/i
const CN_MARKERS = /[-_]C$|[-_]ch$|[-_]CH$/i
const UC_MARKERS = /[-_]UC$|uncensored/i

function shouldExclude(text) {
  return EXCLUDE_KEYWORDS.test(text) ||
    EXCLUDE_DATE_PATTERN.test(text) ||
    EXCLUDE_COUNT_PATTERN.test(text) ||
    EXCLUDE_COUNT_DESC.test(text) ||
    EXCLUDE_SITE_PATTERN.test(text)
}

function shouldMarkSuspect(text, sizeBytes) {
  return SUSPECT_KEYWORDS.test(text) || sizeBytes >= SUSPECT_SIZE_BYTES
}

function getCodeMatchScore(result, searchCode) {
  if (!searchCode) return 0
  const text = ((result.title || '') + (result.fileName || '')).toUpperCase()
  const code = searchCode.toUpperCase()
  if (text.includes(code)) return 100
  const codeParts = code.split('-')
  if (codeParts.length === 2 && text.includes(codeParts[1])) return 50
  return 0
}

function filterResults(results, searchCode) {
  const excluded = []
  const candidates = []

  for (const result of results) {
    const fullText = (result.title || '') + ' ' + (result.fileName || '') + ' ' + (result.linkText || '')
    const sizeBytes = parseSize(result.size) || 0

    if (shouldExclude(fullText)) {
      excluded.push({ ...result, reason: '合集/打包' })
      continue
    }
    if (shouldMarkSuspect(fullText, sizeBytes)) {
      excluded.push({ ...result, reason: '疑似合集' })
      continue
    }
    candidates.push({ ...result, sizeBytes })
  }

  candidates.sort((a, b) => {
    const aMatch = getCodeMatchScore(a, searchCode)
    const bMatch = getCodeMatchScore(b, searchCode)
    if (aMatch !== bMatch) return bMatch - aMatch
    return (b.sizeBytes || 0) - (a.sizeBytes || 0)
  })

  // 选择最优
  let best = null
  let bestScore = -1
  for (const c of candidates.slice(0, 3)) {
    let score = getCodeMatchScore(c, searchCode) * 10
    const text = (c.title || '') + (c.fileName || '')
    if (CN_MARKERS.test(text)) score += 100
    if (UC_MARKERS.test(text)) score += 50
    if (HD_MARKERS.test(text)) score += 20
    score += (c.sizeBytes || 0) / (1024 ** 3)
    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }

  return { best, excluded, candidates }
}
