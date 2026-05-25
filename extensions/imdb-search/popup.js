const keywordInput = document.getElementById('keywordInput')
const searchBtn = document.getElementById('searchBtn')
const statusEl = document.getElementById('status')
const settingsLink = document.getElementById('settingsLink')

// 搜索按钮
searchBtn.addEventListener('click', doSearch)
keywordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSearch()
})

// 配置链接
settingsLink.addEventListener('click', (e) => {
  e.preventDefault()
  chrome.runtime.openOptionsPage()
})

// 检查 API key 配置状态
chrome.storage.local.get('tmdbApiKey', (data) => {
  if (!data.tmdbApiKey) {
    showStatus('warning', '请先配置 TMDB API Key')
  }
})

async function doSearch() {
  const keyword = keywordInput.value.trim()
  if (!keyword) return

  searchBtn.disabled = true
  showStatus('info', '搜索中...')

  chrome.runtime.sendMessage({ type: 'SEARCH', keyword }, (result) => {
    searchBtn.disabled = false

    if (result.status === 'no_api_key') {
      showStatus('warning', '未配置 API Key，已用中文搜索')
    } else if (result.status === 'translated') {
      showStatus('success', `已翻译: ${result.translated}`)
    } else if (result.status === 'fallback') {
      showStatus('warning', '翻译失败，已用中文搜索')
    } else if (result.status === 'error') {
      showStatus('error', `搜索失败: ${result.error}`)
    }
  })
}

function showStatus(type, text) {
  statusEl.textContent = text
  statusEl.className = `status ${type}`
  statusEl.classList.remove('hidden')
}
