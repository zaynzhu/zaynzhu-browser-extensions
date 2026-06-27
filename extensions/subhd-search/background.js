importScripts('search-url.js')

const MENU_ID = 'search-subhd'

// ========== 右键菜单 ==========
chrome.runtime.onInstalled.addListener(() => {
  updateContextMenu()
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[globalThis.SubhdSearch.STORAGE_KEY]) {
    updateContextMenu()
  }
})

function updateContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: '在 SubHD 搜索"%s"',
      contexts: ['selection'],
    })
  })
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText) {
    return
  }

  const keyword = info.selectionText.trim()

  if (!keyword) {
    return
  }

  const data = await chrome.storage.local.get(globalThis.SubhdSearch.STORAGE_KEY)
  const baseUrl = data[globalThis.SubhdSearch.STORAGE_KEY] || globalThis.SubhdSearch.DEFAULT_BASE_URL
  const url = globalThis.SubhdSearch.buildSearchUrl(baseUrl, keyword)

  chrome.tabs.create({ url })
})