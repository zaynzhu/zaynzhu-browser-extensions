const pansou = globalThis.PansouSearch
const keywordInput = document.getElementById('keywordInput')
const searchBtn = document.getElementById('searchBtn')
const baseUrlInput = document.getElementById('baseUrlInput')
const saveBtn = document.getElementById('saveBtn')
const resetBtn = document.getElementById('resetBtn')
const statusEl = document.getElementById('status')

// 加载当前设置
chrome.storage.local.get(pansou.STORAGE_KEY, (data) => {
  baseUrlInput.value = data[pansou.STORAGE_KEY] || pansou.DEFAULT_BASE_URL
})

// 手动输入搜索
searchBtn.addEventListener('click', () => {
  const keyword = keywordInput.value.trim()

  if (!keyword) {
    showStatus('请输入关键词', 'error')
    return
  }

  searchBtn.disabled = true
  searchBtn.textContent = '搜索中...'
  showStatus('正在打开盘搜...', 'info')

  chrome.runtime.sendMessage({ type: 'pansou-search-tab', keyword }, (res) => {
    searchBtn.disabled = false
    searchBtn.textContent = '搜索'

    if (chrome.runtime.lastError || !res.ok) {
      showStatus(`失败: ${(res && res.error) || chrome.runtime.lastError.message}`, 'error')
      return
    }

    if (res.data && res.data.ok) {
      showStatus('已在盘搜中搜索', 'success')
      window.close()
    } else {
      showStatus(`失败: ${(res.data && res.data.error) || '未知错误'}`, 'error')
    }
  })
})

keywordInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    searchBtn.click()
  }
})

// 保存地址
saveBtn.addEventListener('click', () => {
  const url = pansou.normalizeBaseUrl(baseUrlInput.value)
  baseUrlInput.value = url

  chrome.storage.local.set({ [pansou.STORAGE_KEY]: url }, () => {
    showStatus('已保存', 'success')
  })
})

// 恢复默认
resetBtn.addEventListener('click', () => {
  baseUrlInput.value = pansou.DEFAULT_BASE_URL
  chrome.storage.local.set({ [pansou.STORAGE_KEY]: pansou.DEFAULT_BASE_URL }, () => {
    showStatus('已恢复默认', 'success')
  })
})

function showStatus(text, type) {
  statusEl.textContent = text
  statusEl.className = `status ${type}`
  statusEl.classList.remove('hidden')
  setTimeout(() => statusEl.classList.add('hidden'), 2500)
}