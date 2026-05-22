const DEFAULT_BASE_URL = 'https://web2.mukaku.com'

// ========== 右键菜单 ==========
chrome.runtime.onInstalled.addListener(async () => {
  const { mukakuBaseUrl } = await chrome.storage.local.get('mukakuBaseUrl')
  const baseUrl = mukakuBaseUrl || DEFAULT_BASE_URL
  updateContextMenu(baseUrl)
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.mukakuBaseUrl) {
    updateContextMenu(changes.mukakuBaseUrl.newValue || DEFAULT_BASE_URL)
  }
})

function updateContextMenu(baseUrl) {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'search-mukaku',
      title: '在不太灵搜索"%s"',
      contexts: ['selection'],
    })
  })
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'search-mukaku' && info.selectionText) {
    const { mukakuBaseUrl } = await chrome.storage.local.get('mukakuBaseUrl')
    const baseUrl = mukakuBaseUrl || DEFAULT_BASE_URL
    const query = encodeURIComponent(info.selectionText.trim())
    const url = `${baseUrl}/search?sb=${query}`
    chrome.tabs.create({ url })
  }
})