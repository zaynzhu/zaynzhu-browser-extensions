const juying = globalThis.JuYingSearch

const keywordInput = document.getElementById('keywordInput')
const searchAggregateBtn = document.getElementById('searchAggregateBtn')
const searchSiteBtn = document.getElementById('searchSiteBtn')
const baseUrlInput = document.getElementById('baseUrlInput')
const saveBtn = document.getElementById('saveBtn')
const resetBtn = document.getElementById('resetBtn')
const statusEl = document.getElementById('status')

// 加载当前设置
chrome.storage.local.get(juying.STORAGE_KEY, (data) => {
  baseUrlInput.value = data[juying.STORAGE_KEY] || juying.DEFAULT_BASE_URL
})

// 手动输入搜索：网盘按钮走聚合搜索，站内按钮走站内影片搜索
function doSearch(mode, button) {
  const keyword = keywordInput.value.trim()

  if (!keyword) {
    showStatus('请输入关键词', 'error')
    return
  }

  button.disabled = true
  const originalText = button.textContent
  button.textContent = '...'
  showStatus('正在打开聚影...', 'info')

  chrome.runtime.sendMessage({ type: 'juying-search-tab', keyword, mode }, (res) => {
    searchAggregateBtn.disabled = false
    searchSiteBtn.disabled = false
    button.textContent = originalText

    if (chrome.runtime.lastError || !res.ok) {
      showStatus(`失败: ${(res && res.error) || chrome.runtime.lastError.message}`, 'error')
      return
    }

    if (res.data && res.data.ok) {
      showStatus('已在聚影中搜索', 'success')
      window.close()
    } else {
      showStatus(`失败: ${(res.data && res.data.error) || '未知错误'}`, 'error')
    }
  })
}

searchAggregateBtn.addEventListener('click', () => doSearch('aggregate', searchAggregateBtn))
searchSiteBtn.addEventListener('click', () => doSearch('site', searchSiteBtn))

keywordInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    searchAggregateBtn.click()
  }
})

// 保存地址
saveBtn.addEventListener('click', () => {
  const url = juying.normalizeBaseUrl(baseUrlInput.value)
  baseUrlInput.value = url

  chrome.storage.local.set({ [juying.STORAGE_KEY]: url }, () => {
    showStatus('已保存', 'success')
  })
})

// 恢复默认
resetBtn.addEventListener('click', () => {
  baseUrlInput.value = juying.DEFAULT_BASE_URL
  chrome.storage.local.set({ [juying.STORAGE_KEY]: juying.DEFAULT_BASE_URL }, () => {
    showStatus('已恢复默认', 'success')
  })
})

function showStatus(text, type) {
  statusEl.textContent = text
  statusEl.className = `status ${type}`
  statusEl.classList.remove('hidden')
  setTimeout(() => statusEl.classList.add('hidden'), 2500)
}
