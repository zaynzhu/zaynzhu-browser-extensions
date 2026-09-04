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

// ========== 结果分发：云盘 → 网盘镜像表，磁力 → 磁力表 ==========
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
// 重要：网盘资源区的表格由 Vue 管理（容器 #pan，子筛选点击时 Vue 按索引重排/重建表格）。
// 向 #pan 内插行或插表会破坏 Vue 的列表 diff——表现为点"光鸭网盘"筛选显示的是别的类型。
// 因此盘搜结果全部放在 #pan 之外（pan 后面的兄弟位置），不碰原生 DOM；
// 用 MutationObserver 监听 #pan 变化，跟随原生子筛选同步镜像区的显隐。
function injectCloudItems(items) {
  const pan = document.getElementById('pan')

  if (!pan) {
    return
  }

  // 按类型分组（PanSou 结果内部已按 URL 合并，无需二次去重）
  const byType = new Map()

  for (const item of items) {
    const typeName = CLOUD_TYPE_NAMES[item.panType]

    if (!byType.has(typeName)) {
      byType.set(typeName, [])
    }
    byType.get(typeName).push(item)
  }

  // 与原生结果去重：原生表中已有的链接不再出现在盘搜镜像区
  const nativeUrls = new Set(
    [...pan.querySelectorAll('table.bit_list tbody tr a[href]')].map((a) => a.href)
  )

  for (const [typeName, typeItems] of byType) {
    const filtered = typeItems.filter((item) => !nativeUrls.has(item.url))

    if (filtered.length > 0) {
      createMirrorTable(typeName, filtered, pan)
    }
  }

  watchPan(pan)
  syncMirrorVisibility()
}

function createMirrorTable(typeName, items, pan) {
  const table = document.createElement('table')
  table.className = 'bit_list'
  table.setAttribute('width', '100%')
  table.setAttribute('border', '0')
  table.setAttribute('cellpadding', '0')
  table.setAttribute('cellspacing', '0')
  table.setAttribute('data-pansou-table', '1')
  table.setAttribute('data-pansou-type', typeName)
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

  // 磁力表（若存在）之后的区域是磁力 tab 的渲染位，网盘镜像区插在 #pan 之后、磁力表之前
  const magnetTable = findMagnetTable()
  const anchor = magnetTable || pan
  anchor.parentElement.insertBefore(table, magnetTable ? anchor : pan.nextSibling)

  // 子筛选区追加"类型 + 徽标"，点击切到全部态即可看到盘搜镜像区
  const ptList = document.querySelector('.pt-list ul')

  if (ptList && !ptList.querySelector(`li[data-pansou-li="${typeName}"]`)) {
    const li = document.createElement('li')
    li.setAttribute('data-pansou-li', typeName)
    li.innerHTML = `${typeName} <i class="badge">${items.length}</i>`
    li.addEventListener('click', () => syncMirrorVisibility(typeName))
    ptList.appendChild(li)
  } else if (ptList) {
    const badge = ptList.querySelector(`li[data-pansou-li="${typeName}"] .badge`)
    if (badge) {
      badge.textContent = String(Number(badge.textContent || '0') + items.length)
    }
  }
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

// 跟随原生显隐：网盘 tab 隐藏（磁力 tab 活跃）时镜像区整体隐藏；
// 全部态显示全部镜像表，单类态只显示对应类型的镜像表
function syncMirrorVisibility(forceType) {
  const pan = document.getElementById('pan')
  const panVisible = pan && pan.style.display !== 'none'

  const active = pan
    ? [...pan.querySelectorAll('table.bit_list')].map((t) =>
        t.querySelector('caption') ? t.querySelector('caption').innerText.trim() : null
      )
    : []

  const isAll = active.length > 1 || document.querySelector('.pt-list li.on')?.innerText.includes('全部')
  const current = isAll ? null : active[0] || forceType || null

  document.querySelectorAll('table[data-pansou-table]').forEach((table) => {
    const type = table.getAttribute('data-pansou-type')

    if (!panVisible) {
      table.style.display = 'none'
      return
    }

    if (forceType && forceType !== '全部') {
      table.style.display = type === forceType ? '' : 'none'
      return
    }

    table.style.display = !current || type === current ? '' : 'none'
  })
}

let panObserver = null

function watchPan(pan) {
  if (panObserver) {
    return
  }

  // childList 跟随子筛选重建；attributes 跟随磁力/网盘 tab 切换（Vue 直接改 #pan 的 style.display）
  panObserver = new MutationObserver(() => syncMirrorVisibility())
  panObserver.observe(pan, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] })
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
  // 移除盘搜镜像表与子筛选项，恢复原生状态
  document.querySelectorAll('table[data-pansou-table]').forEach((el) => el.remove())
  document.querySelectorAll('li[data-pansou-li]').forEach((el) => el.remove())

  if (panObserver) {
    panObserver.disconnect()
    panObserver = null
  }
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

init()