const DEFAULT_BASE_URL = 'https://www.kuakeq.com'

// ========== 右键菜单 ==========
chrome.runtime.onInstalled.addListener(async () => {
  const { kuakeqBaseUrl } = await chrome.storage.local.get('kuakeqBaseUrl')
  const baseUrl = kuakeqBaseUrl || DEFAULT_BASE_URL
  updateContextMenu(baseUrl)
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.kuakeqBaseUrl) {
    updateContextMenu(changes.kuakeqBaseUrl.newValue || DEFAULT_BASE_URL)
  }
})

function updateContextMenu(baseUrl) {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'search-kuakeq',
      title: '在KuakeQ搜索"%s"',
      contexts: ['selection'],
    })
  })
}

// ========== 搜索逻辑 ==========
function encodeQuery(keyword) {
  return encodeURIComponent(keyword).replace(/%/g, '_')
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'search-kuakeq' && info.selectionText) {
    const { kuakeqBaseUrl } = await chrome.storage.local.get('kuakeqBaseUrl')
    const baseUrl = kuakeqBaseUrl || DEFAULT_BASE_URL
    const encoded = encodeQuery(info.selectionText.trim())
    const url = `${baseUrl}/search-${encoded}-1-1.htm`
    chrome.tabs.create({ url })
  }
})