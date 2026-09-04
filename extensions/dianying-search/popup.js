const dianying = globalThis.DianYingSearch
const keywordInput = document.getElementById('keywordInput')
const kindButtons = {
  movie: document.getElementById('searchMovieBtn'),
  tv: document.getElementById('searchTvBtn'),
  anime: document.getElementById('searchAnimeBtn'),
}
const baseUrlInput = document.getElementById('baseUrlInput')
const saveBtn = document.getElementById('saveBtn')
const resetBtn = document.getElementById('resetBtn')
const statusEl = document.getElementById('status')

// 加载当前设置
chrome.storage.local.get(dianying.STORAGE_KEY, (data) => {
  baseUrlInput.value = data[dianying.STORAGE_KEY] || dianying.DEFAULT_BASE_URL
})

// 手动输入搜索：直接拼搜索 URL 新开标签页，与右键菜单同一条链路
function doSearch(kind) {
  const keyword = keywordInput.value.trim()

  if (!keyword) {
    showStatus('请输入关键词', 'error')
    return
  }

  chrome.storage.local.get(dianying.STORAGE_KEY, (data) => {
    const baseUrl = data[dianying.STORAGE_KEY] || dianying.DEFAULT_BASE_URL
    const url = dianying.buildSearchUrl(baseUrl, keyword, kind)

    chrome.tabs.create({ url })
    window.close()
  })
}

Object.keys(kindButtons).forEach((kind) => {
  kindButtons[kind].addEventListener('click', () => doSearch(kind))
})

keywordInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    doSearch('movie')
  }
})

// 保存地址
saveBtn.addEventListener('click', () => {
  const url = dianying.normalizeBaseUrl(baseUrlInput.value)
  baseUrlInput.value = url

  chrome.storage.local.set({ [dianying.STORAGE_KEY]: url }, () => {
    showStatus('已保存', 'success')
  })
})

// 恢复默认
resetBtn.addEventListener('click', () => {
  baseUrlInput.value = dianying.DEFAULT_BASE_URL
  chrome.storage.local.set({ [dianying.STORAGE_KEY]: dianying.DEFAULT_BASE_URL }, () => {
    showStatus('已恢复默认', 'success')
  })
})

function showStatus(text, type) {
  statusEl.textContent = text
  statusEl.className = `status ${type}`
  statusEl.classList.remove('hidden')
  setTimeout(() => statusEl.classList.add('hidden'), 2500)
}
