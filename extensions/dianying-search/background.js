importScripts('search-url.js')

const MENU_IDS = {
  movie: 'search-dianying-movie',
  tv: 'search-dianying-tv',
  anime: 'search-dianying-anime',
}
const MENU_TITLES = {
  movie: '癫影·搜电影"%s"',
  tv: '癫影·搜剧集"%s"',
  anime: '癫影·搜动漫"%s"',
}

// ========== 右键菜单 ==========
chrome.runtime.onInstalled.addListener(() => {
  updateContextMenu()
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[globalThis.DianYingSearch.STORAGE_KEY]) {
    updateContextMenu()
  }
})

function updateContextMenu() {
  chrome.contextMenus.removeAll(() => {
    Object.keys(MENU_IDS).forEach((kind) => {
      chrome.contextMenus.create({
        id: MENU_IDS[kind],
        title: MENU_TITLES[kind],
        contexts: ['selection'],
      })
    })
  })
}

chrome.contextMenus.onClicked.addListener(async (info) => {
  const kind = Object.keys(MENU_IDS).find((key) => MENU_IDS[key] === info.menuItemId)

  if (!kind || !info.selectionText) {
    return
  }

  const keyword = info.selectionText.trim()

  if (!keyword) {
    return
  }

  const data = await chrome.storage.local.get(globalThis.DianYingSearch.STORAGE_KEY)
  const baseUrl = data[globalThis.DianYingSearch.STORAGE_KEY] || globalThis.DianYingSearch.DEFAULT_BASE_URL
  const url = globalThis.DianYingSearch.buildSearchUrl(baseUrl, keyword, kind)

  chrome.tabs.create({ url })
})