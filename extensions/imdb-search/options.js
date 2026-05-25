const apiKeyInput = document.getElementById('apiKeyInput')
const saveBtn = document.getElementById('saveBtn')
const testBtn = document.getElementById('testBtn')
const testResult = document.getElementById('testResult')
const statusEl = document.getElementById('status')

const TMDB_API_BASE = 'https://api.themoviedb.org/3'

// 加载已保存的 API key
chrome.storage.local.get('tmdbApiKey', (data) => {
  if (data.tmdbApiKey) {
    apiKeyInput.value = data.tmdbApiKey
  }
})

// 保存按钮
saveBtn.addEventListener('click', () => {
  const apiKey = apiKeyInput.value.trim()
  if (!apiKey) {
    showStatus('error', '请输入 API Key')
    return
  }

  chrome.storage.local.set({ tmdbApiKey: apiKey }, () => {
    showStatus('success', '已保存')
  })
})

// 测试按钮
testBtn.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim()
  if (!apiKey) {
    showTestResult('error', '请先输入 API Key')
    return
  }

  testBtn.disabled = true
  testBtn.textContent = '测试中...'
  showTestResult('info', '正在测试...')

  try {
    const url = `${TMDB_API_BASE}/configuration?api_key=${apiKey}`
    const response = await fetch(url)

    if (response.ok) {
      showTestResult('success', 'API Key 有效')
    } else {
      const data = await response.json()
      showTestResult('error', `API Key 无效: ${data.status_message || '未知错误'}`)
    }
  } catch (error) {
    showTestResult('error', `测试失败: ${error.message}`)
  } finally {
    testBtn.disabled = false
    testBtn.textContent = '测试 API Key'
  }
})

function showStatus(type, text) {
  statusEl.textContent = text
  statusEl.className = `status ${type}`
  statusEl.classList.remove('hidden')
  setTimeout(() => statusEl.classList.add('hidden'), 3000)
}

function showTestResult(type, text) {
  testResult.textContent = text
  testResult.className = `status ${type}`
  testResult.classList.remove('hidden')
}
