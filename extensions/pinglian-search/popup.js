const pinglian = globalThis.PanLianSearch
const keywordInput = document.getElementById('keywordInput')
const searchBtn = document.getElementById('searchBtn')
const baseUrlInput = document.getElementById('baseUrlInput')
const saveBtn = document.getElementById('saveBtn')
const resetBtn = document.getElementById('resetBtn')
const statusEl = document.getElementById('status')

// 加载当前设置
chrome.storage.local.get(pinglian.STORAGE_KEY, (data) => {
  baseUrlInput.value = data[pinglian.STORAGE_KEY] || pinglian.DEFAULT_BASE_URL
})

// 手动输入搜索：直接拼搜索 URL 新开标签页，与右键菜单同一条链路
function doSearch() {
  const keyword = keywordInput.value.trim()

  if (!keyword) {
    showStatus('请输入关键词', 'error')
    return
  }

  chrome.storage.local.get(pinglian.STORAGE_KEY, (data) => {
    const baseUrl = data[pinglian.STORAGE_KEY] || pinglian.DEFAULT_BASE_URL
    const url = pinglian.buildSearchUrl(baseUrl, keyword)

    chrome.tabs.create({ url })
    window.close()
  })
}

searchBtn.addEventListener('click', doSearch)

keywordInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    doSearch()
  }
})

// 保存地址
saveBtn.addEventListener('click', () => {
  const url = pinglian.normalizeBaseUrl(baseUrlInput.value)
  baseUrlInput.value = url

  chrome.storage.local.set({ [pinglian.STORAGE_KEY]: url }, () => {
    showStatus('已保存', 'success')
  })
})

// 恢复默认
resetBtn.addEventListener('click', () => {
  baseUrlInput.value = pinglian.DEFAULT_BASE_URL
  chrome.storage.local.set({ [pinglian.STORAGE_KEY]: pinglian.DEFAULT_BASE_URL }, () => {
    showStatus('已恢复默认', 'success')
  })
})

function showStatus(text, type) {
  statusEl.textContent = text
  statusEl.className = `status ${type}`
  statusEl.classList.remove('hidden')
  setTimeout(() => statusEl.classList.add('hidden'), 2500)
}
