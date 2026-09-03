const pansou = globalThis.PansouEnhance
const siteUrlInput = document.getElementById('siteUrlInput')
const pansouUrlInput = document.getElementById('pansouUrlInput')
const saveBtn = document.getElementById('saveBtn')
const resetBtn = document.getElementById('resetBtn')
const testBtn = document.getElementById('testBtn')
const testResult = document.getElementById('testResult')
const statusEl = document.getElementById('status')

// 加载当前设置
chrome.storage.local.get(
  [pansou.SITE_STORAGE_KEY, pansou.PANSOU_STORAGE_KEY],
  (data) => {
    siteUrlInput.value = data[pansou.SITE_STORAGE_KEY] || pansou.DEFAULT_SITE_URL
    pansouUrlInput.value = data[pansou.PANSOU_STORAGE_KEY] || pansou.DEFAULT_PANSOU_URL
  }
)

// 保存
saveBtn.addEventListener('click', () => {
  const siteUrl = pansou.normalizeSiteUrl(siteUrlInput.value)
  const pansouUrl = pansou.normalizePansouUrl(pansouUrlInput.value)

  siteUrlInput.value = siteUrl
  pansouUrlInput.value = pansouUrl

  chrome.storage.local.set(
    {
      [pansou.SITE_STORAGE_KEY]: siteUrl,
      [pansou.PANSOU_STORAGE_KEY]: pansouUrl,
    },
    () => {
      showStatus('已保存', 'success')
    }
  )
})

// 恢复默认
resetBtn.addEventListener('click', () => {
  siteUrlInput.value = pansou.DEFAULT_SITE_URL
  pansouUrlInput.value = pansou.DEFAULT_PANSOU_URL

  chrome.storage.local.set(
    {
      [pansou.SITE_STORAGE_KEY]: pansou.DEFAULT_SITE_URL,
      [pansou.PANSOU_STORAGE_KEY]: pansou.DEFAULT_PANSOU_URL,
    },
    () => {
      showStatus('已恢复默认', 'success')
    }
  )
})

// 测试盘搜连接（health 端点）
testBtn.addEventListener('click', async () => {
  const pansouUrl = pansou.normalizePansouUrl(pansouUrlInput.value)

  testBtn.disabled = true
  testBtn.textContent = '测试中...'
  showTestResult('info', '正在连接...')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(`${pansouUrl}/api/health`, { signal: controller.signal })

    if (response.ok) {
      const body = await response.json()
      showTestResult('success', `连接正常（status: ${body.status || 'ok'}）`)
    } else {
      showTestResult('error', `连接异常 (${response.status})`)
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      showTestResult('error', '连接超时，请检查网络')
    } else {
      showTestResult('error', `连接失败: ${error.message}`)
    }
  } finally {
    clearTimeout(timer)
    testBtn.disabled = false
    testBtn.textContent = '测试盘搜连接'
  }
})

function showStatus(text, type) {
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