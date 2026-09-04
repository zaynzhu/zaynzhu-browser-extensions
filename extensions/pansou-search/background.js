importScripts('search-url.js')

const MENU_ID = 'search-pansou'
const NAV_WAIT_MS = 20000

// ========== 右键菜单 ==========
chrome.runtime.onInstalled.addListener(() => {
  updateContextMenu()
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[globalThis.PansouSearch.STORAGE_KEY]) {
    updateContextMenu()
  }
})

function updateContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: '在盘搜中搜索"%s"',
      contexts: ['selection'],
    })
  })
}

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText) {
    return
  }

  const keyword = info.selectionText.trim()

  if (!keyword) {
    return
  }

  await searchInPansou(keyword)
})

// popup 手动输入搜索复用同一条链路
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'pansou-search-tab') {
    searchInPansou(msg.keyword)
      .then((result) => sendResponse({ ok: true, data: result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }))
    return true
  }
})

async function searchInPansou(keyword) {
  const data = await chrome.storage.local.get(globalThis.PansouSearch.STORAGE_KEY)
  const baseUrl = globalThis.PansouSearch.normalizeBaseUrl(data[globalThis.PansouSearch.STORAGE_KEY])
  const tabId = await openOrReuseTab(baseUrl)

  if (tabId == null) {
    return { ok: false, error: '无法打开盘搜标签页' }
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: globalThis.PansouSearch.injectSearch,
      args: [keyword],
    })

    const outcome = results && results[0] && results[0].result

    if (!outcome || !outcome.ok) {
      console.error('盘搜注入失败:', outcome && outcome.error)
    }

    return outcome || { ok: false, error: '注入无返回' }
  } catch (error) {
    // 页面加载失败（如服务离线出现 chrome-error 页）时无法注入，浏览器错误页本身已足够提示
    console.error('盘搜注入失败:', error)
    return { ok: false, error: error.message }
  }
}

// ========== 标签页定位与打开 ==========
async function openOrReuseTab(baseUrl) {
  const pattern = `${baseUrl}/*`
  const tabs = await chrome.tabs.query({ url: pattern })

  if (tabs.length === 0) {
    const tab = await chrome.tabs.create({ url: baseUrl, active: true })
    await waitForComplete(tab.id)
    return tab.id
  }

  // 优先复用当前激活的标签页，否则取第一个匹配
  const target = tabs.find((tab) => tab.active) || tabs[0]
  await chrome.windows.update(target.windowId, { focused: true })
  await chrome.tabs.update(target.id, { active: true })

  // 用户停在盘搜子页（如配置/API 文档页）时先导航回搜索首页
  let pathname = '/'
  try {
    pathname = new URL(target.url).pathname
  } catch (error) {
    // url 不可解析时按首页处理
  }

  if (pathname !== '/') {
    await chrome.tabs.update(target.id, { url: baseUrl })
    await waitForComplete(target.id)
  }

  return target.id
}

function waitForComplete(tabId) {
  return new Promise((resolve) => {
    const timer = setTimeout(finish, NAV_WAIT_MS)

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        finish()
      }
    }

    function finish() {
      clearTimeout(timer)
      chrome.tabs.onUpdated.removeListener(listener)
      resolve()
    }

    chrome.tabs.onUpdated.addListener(listener)
  })
}