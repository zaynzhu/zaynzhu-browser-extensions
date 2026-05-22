const DEFAULT_BASE_URL = 'https://web2.mukaku.com'

const baseUrlInput = document.getElementById('baseUrlInput')
const saveBtn = document.getElementById('saveBtn')
const resetBtn = document.getElementById('resetBtn')
const statusEl = document.getElementById('status')

// 加载当前设置
chrome.storage.local.get('mukakuBaseUrl', (data) => {
  baseUrlInput.value = data.mukakuBaseUrl || DEFAULT_BASE_URL
})

// 保存
saveBtn.addEventListener('click', () => {
  let url = baseUrlInput.value.trim().replace(/\/+$/, '')
  if (!url) {
    showStatus('请输入搜索主页地址', 'error')
    return
  }
  if (!/^https?:\/\//.test(url)) {
    url = 'https://' + url
    baseUrlInput.value = url
  }
  chrome.storage.local.set({ mukakuBaseUrl: url }, () => {
    showStatus('已保存', 'success')
  })
})

// 恢复默认
resetBtn.addEventListener('click', () => {
  baseUrlInput.value = DEFAULT_BASE_URL
  chrome.storage.local.set({ mukakuBaseUrl: DEFAULT_BASE_URL }, () => {
    showStatus('已恢复默认', 'success')
  })
})

function showStatus(text, type) {
  statusEl.textContent = text
  statusEl.className = `status ${type}`
  statusEl.classList.remove('hidden')
  setTimeout(() => statusEl.classList.add('hidden'), 2000)
}