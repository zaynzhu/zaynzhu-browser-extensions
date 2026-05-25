const codeInput = document.getElementById('codeInput')
const searchBtn = document.getElementById('searchBtn')
const statusEl = document.getElementById('status')
const resultEl = document.getElementById('result')
const resultTitle = document.getElementById('resultTitle')
const resultSize = document.getElementById('resultSize')
const resultDate = document.getElementById('resultDate')
const resultHash = document.getElementById('resultHash')
const magnetInput = document.getElementById('magnetInput')
const copyBtn = document.getElementById('copyBtn')

// 加载上次搜索结果
chrome.storage.local.get(['lastSearch', 'searchInProgress'], (store) => {
  if (store.searchInProgress) {
    codeInput.value = store.searchInProgress
    showStatus('loading', '搜索中...')
    searchBtn.disabled = true
    pollForResult(store.searchInProgress)
  } else if (store.lastSearch?.result?.status === 'confirmed') {
    codeInput.value = store.lastSearch.code
    showResult(store.lastSearch.result)
  }
})

function pollForResult(code) {
  const timer = setInterval(() => {
    chrome.storage.local.get(['lastSearch', 'searchInProgress'], (store) => {
      if (!store.searchInProgress) {
        clearInterval(timer)
        searchBtn.disabled = false
        if (store.lastSearch?.result?.status === 'confirmed') {
          showResult(store.lastSearch.result)
        } else {
          showStatus('empty', '未找到结果')
        }
      }
    })
  }, 500)
  // 10 秒超时
  setTimeout(() => { clearInterval(timer); searchBtn.disabled = false }, 10000)
}

// 搜索按钮
searchBtn.addEventListener('click', doSearch)
codeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSearch()
})

// 复制按钮
copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(magnetInput.value).then(() => {
    copyBtn.textContent = '已复制'
    copyBtn.classList.add('copied')
    setTimeout(() => {
      copyBtn.textContent = '复制'
      copyBtn.classList.remove('copied')
    }, 1500)
  })
})

function doSearch() {
  const code = codeInput.value.trim()
  if (!code) return

  showStatus('loading', '搜索中...')
  resultEl.classList.add('hidden')
  searchBtn.disabled = true

  chrome.runtime.sendMessage({ type: 'SEARCH', code }, (result) => {
    searchBtn.disabled = false

    if (result.status === 'confirmed') {
      showResult(result)
    } else if (result.status === 'not_found') {
      showStatus('empty', '未找到结果')
    } else {
      showStatus('error', result.error || '搜索失败')
    }
  })
}

function showResult(result) {
  statusEl.classList.add('hidden')
  resultEl.classList.remove('hidden')

  resultTitle.textContent = result.title || '—'
  resultSize.textContent = result.size || '—'
  resultDate.textContent = result.date ? `发布: ${result.date}` : ''
  resultHash.textContent = result.hash ? `Hash: ${result.hash}` : ''
  magnetInput.value = result.magnet || ''
}

function showStatus(type, text) {
  statusEl.className = `status ${type}`
  statusEl.textContent = text
  statusEl.classList.remove('hidden')
}
