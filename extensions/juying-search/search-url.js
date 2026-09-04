(function () {
  const DEFAULT_BASE_URL = 'https://www.jying.top'
  const STORAGE_KEY = 'juyingBaseUrl'

  function normalizeBaseUrl(baseUrl) {
    let url = (baseUrl || DEFAULT_BASE_URL).trim().replace(/\/+$/, '')

    if (!url) {
      return DEFAULT_BASE_URL
    }

    if (!/^https?:\/\//.test(url)) {
      url = `https://${url}`
    }

    return url.replace(/\/+$/, '')
  }

  // 聚影前端不读 URL 参数（站内/聚合搜索都是纯前端状态）：搜索页固定为 /search
  function buildSearchUrl(baseUrl) {
    return `${normalizeBaseUrl(baseUrl)}/search`
  }

  // 注入脚本：切到目标搜索 tab（站内/聚合），填词并点击搜索按钮
  // tab 与输入框随 pane 切换重新渲染，切换后需等待一帧再取输入框
  async function injectSearch(keyword, mode) {
    const TAB_TEXT = mode === 'aggregate' ? '聚合搜索' : '站内搜索'
    const tab = [...document.querySelectorAll('.n-tabs-tab')].find(
      (el) => el.textContent.trim() === TAB_TEXT
    )

    if (!tab) {
      return { ok: false, error: `未找到"${TAB_TEXT}"标签页` }
    }

    if (!tab.className.includes('n-tabs-tab--active')) {
      tab.click()
      await new Promise((resolve) => setTimeout(resolve, 300))
    }

    // 只取当前激活 pane 中的可见输入框（隐藏 pane 的输入框可能仍留在 DOM）
    const input = [...document.querySelectorAll('input.n-input__input-el')].find(
      (el) => el.offsetParent !== null
    )

    if (!input) {
      return { ok: false, error: '未找到搜索输入框' }
    }

    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, keyword)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.focus()

    const button = [...document.querySelectorAll('main button')].find(
      (el) => el.textContent.trim() === '搜索' && el.offsetParent !== null
    )

    if (!button) {
      return { ok: false, error: '未找到搜索按钮' }
    }

    button.click()

    return { ok: true }
  }

  const api = {
    DEFAULT_BASE_URL,
    STORAGE_KEY,
    normalizeBaseUrl,
    buildSearchUrl,
    injectSearch,
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.JuYingSearch = api
  }

  if (typeof module !== 'undefined') {
    module.exports = api
  }
})()