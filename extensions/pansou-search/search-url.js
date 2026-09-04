(function () {
  const DEFAULT_BASE_URL = 'http://192.168.50.233:4805'
  const STORAGE_KEY = 'pansouSearchBaseUrl'

  // 盘搜是 http 服务，裸主机名默认补 http://（区别于其他扩展的 https）
  function normalizeBaseUrl(baseUrl) {
    let url = (baseUrl || DEFAULT_BASE_URL).trim().replace(/\/+$/, '')

    if (!url) {
      return DEFAULT_BASE_URL
    }

    if (!/^https?:\/\//.test(url)) {
      url = `http://${url}`
    }

    return url.replace(/\/+$/, '')
  }

  // 盘搜前端不读 URL 参数，搜索为纯前端状态：注入脚本填词并模拟 Enter（在 background 的注入函数中使用）
  function injectSearch(keyword) {
    const selector = 'input[placeholder^="搜索资源"]'
    const input = document.querySelector(selector)

    if (!input) {
      return { ok: false, error: '未找到盘搜输入框' }
    }

    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, keyword)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.focus()
    ;['keydown', 'keypress', 'keyup'].forEach((type) => {
      input.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }))
    })

    return { ok: true }
  }

  const api = {
    DEFAULT_BASE_URL,
    STORAGE_KEY,
    normalizeBaseUrl,
    injectSearch,
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.PansouSearch = api
  }

  if (typeof module !== 'undefined') {
    module.exports = api
  }
})()