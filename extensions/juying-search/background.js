importScripts('search-url.js')

const MENU_IDS = {
  aggregate: 'search-juying-aggregate',
  site: 'search-juying-site',
}
const NAV_WAIT_MS = 20000

// ========== 右键菜单 ==========
chrome.runtime.onInstalled.addListener(() => {
  updateContextMenu()
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[globalThis.JuYingSearch.STORAGE_KEY]) {
    updateContextMenu()
  }
})

function updateContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_IDS.aggregate,
      title: '聚影·搜网盘资源"%s"',
      contexts: ['selection'],
    })
    chrome.contextMenus.create({
      id: MENU_IDS.site,
      title: '聚影·搜站内影片"%s"',
      contexts: ['selection'],
    })
  })
}

chrome.contextMenus.onClicked.addListener(async (info) => {
  const mode = Object.keys(MENU_IDS).find((key) => MENU_IDS[key] === info.menuItemId)

  if (!mode || !info.selectionText) {
    return
  }

  const keyword = info.selectionText.trim()

  if (!keyword) {
    return
  }

  await searchInJuYing(keyword, mode)
})

// popup 手动输入搜索复用同一条链路
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'juying-search-tab') {
    searchInJuYing(msg.keyword, msg.mode)
      .then((result) => sendResponse({ ok: true, data: result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }))
    return true
  }
})

async function searchInJuYing(keyword, mode) {
  const data = await chrome.storage.local.get(globalThis.JuYingSearch.STORAGE_KEY)
  const baseUrl = globalThis.JuYingSearch.normalizeBaseUrl(data[globalThis.JuYingSearch.STORAGE_KEY])
  const tabId = await openOrReuseTab(baseUrl)

  if (tabId == null) {
    return { ok: false, error: '无法打开聚影标签页' }
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: globalThis.JuYingSearch.injectSearch,
      args: [keyword, mode],
    })

    const outcome = results && results[0] && results[0].result

    if (!outcome || !outcome.ok) {
      console.error('聚影注入失败:', outcome && outcome.error)
    }

    return outcome || { ok: false, error: '注入无返回' }
  } catch (error) {
    // 页面加载失败（如网络不通出现 chrome-error 页）时无法注入，浏览器错误页本身已足够提示
    console.error('聚影注入失败:', error)
    return { ok: false, error: error.message }
  }
}

// ========== 标签页定位与打开 ==========
async function openOrReuseTab(baseUrl) {
  const pattern = `${baseUrl}/*`
  const tabs = await chrome.tabs.query({ url: pattern })

  if (tabs.length === 0) {
    const tab = await chrome.tabs.create({ url: globalThis.JuYingSearch.buildSearchUrl(baseUrl), active: true })
    await waitForComplete(tab.id)
    return tab.id
  }

  // 优先复用当前激活的标签页，否则取第一个匹配
  const target = tabs.find((tab) => tab.active) || tabs[0]
  await chrome.windows.update(target.windowId, { focused: true })
  await chrome.tabs.update(target.id, { active: true })

  // 用户停在聚影其他页面（如首页、影视库）时先导航到搜索页
  let pathname = '/'
  try {
    pathname = new URL(target.url).pathname
  } catch (error) {
    // url 不可解析时按搜索页处理
  }

  if (pathname !== '/search') {
    await chrome.tabs.update(target.id, { url: globalThis.JuYingSearch.buildSearchUrl(baseUrl) })
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