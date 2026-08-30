(function () {
  const DEFAULT_BASE_URL = 'http://192.168.50.233:12366'
  const STORAGE_KEY = 'ttdBaseUrl'
  // TTD 影视探索页搜索框；页面由 media_discovery.js 动态渲染，需轮询等待
  const INPUT_SELECTOR = '#md-library-query'
  const INPUT_WAIT_MS = 15000

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

  // 注入 TTD 页面的搜索函数：必须自包含（executeScript 序列化不带闭包）
  async function injectSearch(keyword) {
    const selector = '#md-library-query'
    const waitMs = 15000
    // TTD 是单页多 section：URL 不变，靠 .nav-item[data-target] 切换显示区块，
    // 搜索框所在的影视探索 section 不在前台时也能搜但用户看不到结果，需先切过去
    const sectionId = 'media-library-section'
    const navSelector = `.nav-item[data-target="${sectionId}"]`

    function showToast(message) {
      const toast = document.createElement('div')
      toast.textContent = message
      toast.style.cssText = [
        'position: fixed',
        'left: 50%',
        'bottom: 40px',
        'transform: translateX(-50%)',
        'z-index: 2147483647',
        'padding: 10px 18px',
        'border-radius: 8px',
        'background: rgba(20, 20, 20, 0.85)',
        'color: #fff',
        'font-size: 13px',
        'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3)',
        'transition: opacity 0.4s',
      ].join(';')
      document.body.appendChild(toast)
      setTimeout(() => {
        toast.style.opacity = '0'
        setTimeout(() => toast.remove(), 400)
      }, 4000)
    }

    function waitFor(testFn) {
      return new Promise((resolve) => {
        const startedAt = Date.now()
        const timer = setInterval(() => {
          const result = testFn()
          if (result) {
            clearInterval(timer)
            resolve(result)
            return
          }
          if (Date.now() - startedAt > waitMs) {
            clearInterval(timer)
            resolve(null)
          }
        }, 300)
      })
    }

    // 影视探索不在前台时，点击应用自己的导航项切过去（switchTab 会调
    // MediaDiscovery.activate 加载区块数据；TTD 内部深链接也用 navItem.click()）。
    // nav 由 media_discovery.js 异步渲染，需轮询等待；等不到就退化为直接找输入框
    let navClicked = false
    await waitFor(() => {
      const el = document.getElementById(sectionId)
      if (el && el.classList.contains('active')) return el
      if (!navClicked) {
        const nav = document.querySelector(navSelector)
        if (nav) {
          navClicked = true
          nav.click()
        }
      }
      return null
    })

    const input = await waitFor(() => document.querySelector(selector))

    if (!input) {
      showToast('未找到 TTD 搜索框，请确认已登录且地址配置正确')
      return 'timeout'
    }

    // React 类框架屏蔽直接赋值，用原型 native setter 赋值后再派发 input 事件
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    nativeSetter.call(input, keyword)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.focus()
    // Enter 监听委托在容器上，事件必须冒泡
    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
    }))
    return 'ok'
  }

  const api = {
    DEFAULT_BASE_URL,
    STORAGE_KEY,
    INPUT_SELECTOR,
    INPUT_WAIT_MS,
    normalizeBaseUrl,
    injectSearch,
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.TtdSearch = api
  }

  if (typeof module !== 'undefined') {
    module.exports = api
  }
})()
