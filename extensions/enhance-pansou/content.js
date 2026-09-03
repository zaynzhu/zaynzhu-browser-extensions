// PanSou 类型 id → 详情页子筛选文案
const CLOUD_TYPE_NAMES = {
  quark: '夸克网盘',
  guangya: '光鸭网盘',
  115: '115网盘',
  123: '123网盘',
}

// 只注入这四类云盘
const WANTED_CLOUD_TYPES = ['quark', 'guangya', '115', '123']
const MAGNET_TYPES = ['magnet', 'ed2k']

const ICON_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.34-4.34"></path><path d="M11 8v6M8 11h6"></path></svg>'

let currentKeyword = ''
let loaded = false
let loading = false

// ========== 入口：详情页标题后注入盘搜图标 ==========
async function init() {
  const config = await send({ type: 'get-config' })

  if (!config || !sameSite(location.origin, config.siteUrl)) {
    return
  }

  mountIcon()
}

function sameSite(origin, siteUrl) {
  try {
    return new URL(siteUrl).origin === origin
  } catch (error) {
    return false
  }
}

function mountIcon() {
  const h1 = document.querySelector('.main-ui-meta h1')

  if (!h1 || document.getElementById('pansou-enhance-icon')) {
    return
  }

  const icon = document.createElement('span')
  icon.id = 'pansou-enhance-icon'
  icon.className = 'pansou-enhance-icon'
  icon.title = '盘搜'
  icon.innerHTML = ICON_SVG
  icon.addEventListener('click', onIconClick)
  h1.appendChild(icon)

  // 改词铅笔按钮（点击图标后出现）
  const edit = document.createElement('span')
  edit.id = 'pansou-enhance-edit'
  edit.className = 'pansou-enhance-edit'
  edit.title = '修改盘搜关键词'
  edit.textContent = '✎'
  edit.addEventListener('click', openKeywordEditor)
  h1.appendChild(edit)

  currentKeyword = extractTitleFromH1(h1)
}

function extractTitleFromH1(h1) {
  // shared.js 在 manifest 中先于 content.js 加载
  return globalThis.PansouEnhance.extractTitle(h1.innerText)
}

// ========== 点击图标：搜索 + 注入 ==========
async function onIconClick() {
  if (loading) {
    return
  }

  // 已加载过：再次点击 = 强制刷新（绕过 PanSou 缓存重新搜索）
  await searchAndInject(currentKeyword, loaded)
}

async function searchAndInject(keyword, refresh) {
  loading = true
  const icon = document.getElementById('pansou-enhance-icon')
  icon.classList.add('loading')
  icon.title = '盘搜中...'

  try {
    const data = await send({ type: 'pansou-search', keyword, refresh })
    injectAll(data)
    loaded = true
    icon.classList.remove('loading')
    icon.classList.add('done')
    icon.title = `盘搜：已注入，再点强制刷新`
  } catch (error) {
    icon.classList.remove('loading')
    icon.title = `盘搜失败：${error.message}，点击重试`
  } finally {
    loading = false
  }
}

function send(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (res) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
      } else if (!res.ok) {
        reject(new Error(res.error))
      } else {
        resolve(res.data)
      }
    })
  })
}

// ========== 结果分发：云盘 → 网盘表格，磁力 → 磁力表格 ==========
function injectAll(data) {
  const merged = data.merged_by_type || {}
  const cloudItems = []

  for (const type of WANTED_CLOUD_TYPES) {
    for (const item of merged[type] || []) {
      cloudItems.push({ ...item, panType: type })
    }
  }

  const magnetItems = []

  for (const type of MAGNET_TYPES) {
    for (const item of merged[type] || []) {
      magnetItems.push({ ...item, panType: type })
    }
  }

  if (cloudItems.length > 0) {
    injectCloudItems(cloudItems)
  }

  if (magnetItems.length > 0) {
    injectMagnetItems(magnetItems)
  }
}

// ---------- 网盘资源 tab ----------
function injectCloudItems(items) {
  const ptList = document.querySelector('.pt-list ul')
  const tables = collectCloudTables()

  // 按类型分组，逐类去重后拼进对应表格；页面上没有的类型新建表格
  const byType = new Map()

  for (const item of items) {
    const typeName = CLOUD_TYPE_NAMES[item.panType]
    const table = tables.find((t) => t.name === typeName)

    if (table) {
      const existingUrls = new Set(
        [...table.table.querySelectorAll('tbody tr a[href]')].map((a) => a.href)
      )

      if (!existingUrls.has(item.url)) {
        table.table.querySelector('tbody').appendChild(buildCloudRow(item, typeName))
        bumpBadge(ptList, typeName)
        bumpBadge(null, '全部')
      }
    } else {
      if (!byType.has(typeName)) {
        byType.set(typeName, [])
      }
      byType.get(typeName).push(item)
    }
  }

  for (const [typeName, typeItems] of byType) {
    createCloudTable(typeName, typeItems, ptList)
  }
}

function collectCloudTables() {
  // 网盘资源 tab：每类一张表，类型名在表格的 <caption> 里
  const result = []

  for (const table of document.querySelectorAll('table.bit_list')) {
    const caption = table.querySelector('caption')
    const name = caption ? caption.innerText.trim() : null

    if (name && name.length < 20) {
      result.push({ name, table })
    }
  }

  return result
}

function buildCloudRow(item, typeName) {
  const tr = document.createElement('tr')
  tr.setAttribute('data-pansou', '1')

  const tdName = document.createElement('td')
  const link = document.createElement('a')
  link.href = item.url
  link.target = '_blank'
  link.rel = 'noreferrer noopener'
  link.textContent = `盘搜～${item.note || '未命名资源'}`
  link.style.color = '#7ab8ff'
  tdName.appendChild(link)

  const tdPwd = document.createElement('td')
  tdPwd.setAttribute('align', 'center')
  tdPwd.textContent = item.password || ''

  const tdFrom = document.createElement('td')
  tdFrom.setAttribute('align', 'center')
  tdFrom.style.color = '#4a9eff'
  tdFrom.textContent = `盘搜～${item.source || 'pansou'}`

  const tdTime = document.createElement('td')
  tdTime.setAttribute('align', 'center')
  tdTime.textContent = formatDateTime(item.datetime)

  tr.append(tdName, tdPwd, tdFrom, tdTime)
  return tr
}

function createCloudTable(typeName, items, ptList) {
  // 页面没有该类型的表格：新建同款表（caption 为类型名），追加在最后一张云盘表后面
  const lastTable = [...document.querySelectorAll('table.bit_list')].pop()
  const table = document.createElement('table')
  table.className = 'bit_list'
  table.setAttribute('width', '100%')
  table.setAttribute('border', '0')
  table.setAttribute('cellpadding', '0')
  table.setAttribute('cellspacing', '0')
  table.setAttribute('data-pansou-table', '1')
  table.innerHTML = `
    <caption class="pansou-caption">${typeName}</caption>
    <tbody>
      <tr style="background: 0px 0px;">
        <th width="820px" align="left">名称</th>
        <th width="80px" align="center">提取码</th>
        <th width="140px" align="center">发布者</th>
        <th width="80px" align="center">更新时间</th>
      </tr>
    </tbody>`

  const tbody = table.querySelector('tbody')

  for (const item of items) {
    tbody.appendChild(buildCloudRow(item, typeName))
  }

  lastTable.parentElement.insertBefore(table, lastTable.nextSibling)

  if (ptList) {
    const li = document.createElement('li')
    li.setAttribute('data-pansou-li', '1')
    li.innerHTML = `${typeName} <i class="badge">${items.length}</i>`
    ptList.appendChild(li)
  }
}

// ---------- 磁力资源 tab ----------
function injectMagnetItems(items) {
  const table = findMagnetTable()

  if (!table) {
    return
  }

  const tbody = table.querySelector('tbody')
  const existing = new Set(
    [...table.querySelectorAll('tbody tr a[href^="magnet:"]')].map((a) => a.href)
  )

  for (const item of items) {
    if (existing.has(item.url)) {
      continue
    }

    tbody.appendChild(buildMagnetRow(item))
  }
}

function findMagnetTable() {
  // 磁力表表头：名称 / 下载 / 大小 / 做种 / 发布时间
  const tables = [...document.querySelectorAll('table.bit_list')]

  return tables.find((t) => {
    const ths = [...t.querySelectorAll('tr th')].map((th) => th.innerText)
    return ths.length === 5 && ths[0].includes('名称') && ths[1].includes('下载')
  })
}

function buildMagnetRow(item) {
  const tr = document.createElement('tr')
  tr.setAttribute('data-pansou', '1')
  const size = extractSize(item.note) || '—'

  const tdName = document.createElement('td')
  const link = document.createElement('a')
  link.href = item.url
  link.className = 'svg-tf'
  link.title = item.note || ''
  link.textContent = `盘搜～${item.note || '未命名资源'}`
  link.style.color = '#7ab8ff'
  tdName.appendChild(link)

  const tdDownload = document.createElement('td')
  tdDownload.setAttribute('align', 'center')
  const copyBtn = document.createElement('a')
  copyBtn.textContent = '复制'
  copyBtn.href = 'javascript:void(0)'
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(item.url)
    copyBtn.textContent = '已复制'
    setTimeout(() => (copyBtn.textContent = '复制'), 1500)
  })
  tdDownload.appendChild(copyBtn)

  const tdSize = document.createElement('td')
  tdSize.setAttribute('align', 'center')
  tdSize.textContent = size

  const tdSeed = document.createElement('td')
  tdSeed.setAttribute('align', 'center')
  tdSeed.textContent = '—'

  const tdTime = document.createElement('td')
  tdTime.setAttribute('align', 'center')
  tdTime.textContent = formatDateTime(item.datetime)

  tr.append(tdName, tdDownload, tdSize, tdSeed, tdTime)
  return tr
}

// ========== 改词 ==========
function openKeywordEditor() {
  const existing = document.getElementById('pansou-enhance-editor')

  if (existing) {
    existing.remove()
    return
  }

  const h1 = document.querySelector('.main-ui-meta h1')

  const editor = document.createElement('span')
  editor.id = 'pansou-enhance-editor'
  editor.className = 'pansou-enhance-editor'

  const input = document.createElement('input')
  input.type = 'text'
  input.value = currentKeyword
  input.placeholder = '盘搜关键词'

  const go = document.createElement('button')
  go.textContent = '搜'
  go.addEventListener('click', () => applyKeyword(input.value))

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      applyKeyword(input.value)
    }

    if (event.key === 'Escape') {
      editor.remove()
    }
  })

  editor.append(input, go)
  h1.parentElement.insertBefore(editor, h1.nextSibling)
  input.focus()
  input.select()
}

function applyKeyword(keyword) {
  const kw = (keyword || '').trim()

  if (!kw) {
    return
  }

  currentKeyword = kw
  document.getElementById('pansou-enhance-editor')?.remove()

  if (loaded) {
    loaded = false
    removeAllInjected()
  }

  searchAndInject(currentKeyword, true)
}

function removeAllInjected() {
  // 撤掉注入行（标记了 data-pansou）和新建的整表，恢复原生状态
  document.querySelectorAll('tr[data-pansou]').forEach((el) => el.remove())
  document.querySelectorAll('table.bit_list caption').forEach((caption) => {
    const table = caption.closest('table')

    if (table.getAttribute('data-pansou-table') === '1') {
      table.remove()
    }
  })
  document.querySelectorAll('.pt-list li[data-pansou-li]').forEach((el) => el.remove())
}

// ========== 工具 ==========
function extractSize(text) {
  const match = (text || '').match(/(\d+(?:\.\d+)?)\s*(TB|GB|MB|Gb|Tb|Mb)/i)

  return match ? `${match[1]}${match[2].toUpperCase()}` : null
}

function formatDateTime(iso) {
  if (!iso) {
    return ''
  }

  const date = new Date(iso)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const now = new Date()
  const diffDays = Math.floor((now - date) / (24 * 3600 * 1000))

  if (diffDays <= 0) {
    return '今天'
  }

  if (diffDays === 1) {
    return '昨天'
  }

  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function bumpBadge(ptList, typeName) {
  // 更新 .pt-list 中对应类型的计数徽标
  const items = ptList ? [...ptList.querySelectorAll('li')] : []

  for (const li of items) {
    const label = li.childNodes[0] && li.childNodes[0].textContent.trim()

    if (label === typeName) {
      const badge = li.querySelector('.badge')

      if (badge) {
        badge.textContent = String(Number(badge.textContent || '0') + 1)
      }
    }
  }
}

init()