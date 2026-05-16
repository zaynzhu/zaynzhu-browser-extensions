const SITE_URL = "https://us.pan1.me"

// 将搜索关键词编码为123盘搜索URL格式
// 规则：encodeURIComponent 后将 % 替换为 _
function encodeSearchQuery(text) {
  return encodeURIComponent(text).replace(/%/g, '_')
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "search-123pan",
    title: '在123盘搜索"%s"',
    contexts: ["selection"],
  })
})

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "search-123pan" && info.selectionText) {
    const query = encodeSearchQuery(info.selectionText.trim())
    const url = `${SITE_URL}/?search-${query}-1.htm`
    chrome.tabs.create({ url })
  }
})