(function () {
  const DEFAULT_BASE_URL = 'https://www.xn--wcv59z.com'
  const STORAGE_KEY = 'jiaofuBaseUrl'

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

  function buildSearchUrl(baseUrl, keyword) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
    const query = encodeURIComponent(keyword.trim())

    return `${normalizedBaseUrl}/search?q=${query}&type=&mode=1`
  }

  const api = {
    DEFAULT_BASE_URL,
    STORAGE_KEY,
    normalizeBaseUrl,
    buildSearchUrl,
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.JiaofuSearch = api
  }

  if (typeof module !== 'undefined') {
    module.exports = api
  }
})()
