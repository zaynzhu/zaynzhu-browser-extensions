(function () {
  const DEFAULT_BASE_URL = 'https://m.dian115.com'
  const STORAGE_KEY = 'dianyingBaseUrl'

  // 癫影发现的三个类型（不带 kind 时站点默认电影）
  const KINDS = ['movie', 'tv', 'anime']

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

  function buildSearchUrl(baseUrl, keyword, kind) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
    const query = encodeURIComponent(keyword.trim())

    return `${normalizedBaseUrl}/discover?kind=${kind}&q=${query}`
  }

  const api = {
    DEFAULT_BASE_URL,
    STORAGE_KEY,
    KINDS,
    normalizeBaseUrl,
    buildSearchUrl,
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.DianYingSearch = api
  }

  if (typeof module !== 'undefined') {
    module.exports = api
  }
})()