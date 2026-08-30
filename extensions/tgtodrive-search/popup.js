const ttdSearch = globalThis.TtdSearch
const baseUrlInput = document.getElementById('baseUrlInput')
const saveBtn = document.getElementById('saveBtn')
const resetBtn = document.getElementById('resetBtn')
const statusEl = document.getElementById('status')

// 加载当前设置
chrome.storage.local.get(ttdSearch.STORAGE_KEY, (data) => {
  baseUrlInput.value = data[ttdSearch.STORAGE_KEY] || ttdSearch.DEFAULT_BASE_URL
})

// 保存
saveBtn.addEventListener('click', () => {
  const inputUrl = baseUrlInput.value.trim()

  if (!inputUrl) {
    showStatus('请输入 TTD 管理台地址', 'error')
    return
  }

  const url = ttdSearch.normalizeBaseUrl(inputUrl)
  baseUrlInput.value = url

  chrome.storage.local.set({ [ttdSearch.STORAGE_KEY]: url }, () => {
    showStatus('已保存', 'success')
  })
})

// 恢复默认
resetBtn.addEventListener('click', () => {
  baseUrlInput.value = ttdSearch.DEFAULT_BASE_URL
  chrome.storage.local.set({ [ttdSearch.STORAGE_KEY]: ttdSearch.DEFAULT_BASE_URL }, () => {
    showStatus('已恢复默认', 'success')
  })
})

function showStatus(text, type) {
  statusEl.textContent = text
  statusEl.className = `status ${type}`
  statusEl.classList.remove('hidden')
  setTimeout(() => statusEl.classList.add('hidden'), 2000)
}
