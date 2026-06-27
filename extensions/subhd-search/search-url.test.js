const assert = require('node:assert/strict')
const test = require('node:test')

let searchUrl = {}

try {
  searchUrl = require('./search-url.js')
} catch (error) {
  searchUrl = {}
}

test('buildSearchUrl 使用默认 SubHD 域名生成路径式搜索地址', () => {
  assert.equal(typeof searchUrl.buildSearchUrl, 'function')

  const url = searchUrl.buildSearchUrl('', '无路可退')

  assert.equal(
    url,
    'https://subhd.tv/search/%E6%97%A0%E8%B7%AF%E5%8F%AF%E9%80%80',
  )
})

test('buildSearchUrl 使用配置域名并清理尾部斜杠', () => {
  assert.equal(typeof searchUrl.buildSearchUrl, 'function')

  const url = searchUrl.buildSearchUrl('https://example.com///', 'Alien: Rubicon')

  assert.equal(
    url,
    'https://example.com/search/Alien%3A%20Rubicon',
  )
})

test('normalizeBaseUrl 为裸域名补全 https 协议', () => {
  assert.equal(typeof searchUrl.normalizeBaseUrl, 'function')

  const url = searchUrl.normalizeBaseUrl('subhd.tv/')

  assert.equal(url, 'https://subhd.tv')
})