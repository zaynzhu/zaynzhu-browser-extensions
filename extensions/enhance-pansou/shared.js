(function () {
  const DEFAULT_SITE_URL = 'https://www.xn--wcv59z.com'
  const DEFAULT_PANSOU_URL = 'http://192.168.50.233:4805'
  const SITE_STORAGE_KEY = 'pansouSiteBaseUrl'
  const PANSOU_STORAGE_KEY = 'pansouBaseUrl'

  function normalizeBaseUrl(baseUrl, fallback, defaultScheme) {
    let url = (baseUrl || fallback).trim().replace(/\/+$/, '')

    if (!url) {
      return fallback
    }

    if (!/^https?:\/\//.test(url)) {
      url = `${defaultScheme}://${url}`
    }

    return url.replace(/\/+$/, '')
  }

  function normalizeSiteUrl(baseUrl) {
    return normalizeBaseUrl(baseUrl, DEFAULT_SITE_URL, 'https')
  }

  function normalizePansouUrl(baseUrl) {
    return normalizeBaseUrl(baseUrl, DEFAULT_PANSOU_URL, 'http')
  }

  // 详情页主标题提取：去掉季/部标记及之后内容、年份，得到"紧急呼救"这类主标题
  function extractTitle(h1Text) {
    return (h1Text || '')
      .replace(/\s+/g, ' ')
      .replace(/[（(]\s*\d{4}\s*[)）]/g, '')
      .replace(/\s*(第[一二三四五六七八九十百千0-90-9]+[季部]|S\d{1,2}|Season\s*\d{1,2}).*$/i, '')
      .replace(/[\s:：·\-—·]+$/, '')
      .trim()
  }

  const api = {
    DEFAULT_SITE_URL,
    DEFAULT_PANSOU_URL,
    SITE_STORAGE_KEY,
    PANSOU_STORAGE_KEY,
    normalizeSiteUrl,
    normalizePansouUrl,
    extractTitle,
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.PansouEnhance = api
  }

  if (typeof module !== 'undefined') {
    module.exports = api
  }
})()