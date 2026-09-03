const pansou = globalThis.PansouEnhance
const siteUrlInput = document.getElementById('siteUrlInput')
const pansouUrlInput = document.getElementById('pansouUrlInput')
const saveBtn = document.getElementById('saveBtn')
const resetBtn = document.getElementById('resetBtn')
const optionsBtn = document.getElementById('optionsBtn')
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

// 打开 options 高级设置页
optionsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage()
})

function showStatus(text, type) {
  statusEl.textContent = text
  statusEl.className = `status ${type}`
  statusEl.classList.remove('hidden')
  setTimeout(() => statusEl.classList.add('hidden'), 2000)
}