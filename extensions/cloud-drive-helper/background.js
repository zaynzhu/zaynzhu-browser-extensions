import { createGuangyaAuth, ACCOUNT_KEY } from './guangya-auth.js'
import { RateLimiter, readFolderPage, validateCredentials } from './guangya-api.js'
import { readGuangyaWebSession } from './web-session.js'
import { createTransferService } from './transfer-background.js'
import { createCachedHandler } from './directory-cache.js'
import { create123Handler } from './pan123-background.js'
import { create115Handler } from './pan115-background.js'

const CREDENTIALS_KEY = 'guangyaCredentials'
const TARGET_KEY = 'guangyaTarget'
const WEB_KEY = 'guangyaWebSession'
const WEB_TARGET_KEY = 'guangyaWebTarget'
const limiter = new RateLimiter(chrome.storage.session)
const guangyaAuth = createGuangyaAuth(chrome, limiter)
const ready = chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
let commands = Promise.resolve()
const handle115 = create115Handler(chrome)
const handle123 = create123Handler(chrome)

chrome.action.onClicked?.addListener(() => chrome.runtime.openOptionsPage())

async function getWebSession() {
  const session = await guangyaAuth.getSession()
  if (!session || session.expiresAt <= Date.now()) throw new Error('请先连接光鸭普通账号；官网备用连接过期时可重新连接或改用短信登录')
  return session
}

async function getCredentials() {
  const state = await chrome.storage.local.get(CREDENTIALS_KEY)
  if (!state[CREDENTIALS_KEY]) throw new Error('请先连接光鸭账号')
  return state[CREDENTIALS_KEY]
}

async function handleMessage(message) {
  await ready
  if (message.provider === '115') return handle115(message)
  if (message.provider === '123') return handle123(message)
  if (message.provider && message.provider !== 'guangya') throw new Error('此云盘尚未接入')
  const web = message.mode === 'web'
  const targetKey = web ? WEB_TARGET_KEY : TARGET_KEY
  if (message.type === 'send-sms') return guangyaAuth.sendCode(message.phone)
  if (message.type === 'connect-sms') {
    const session = await guangyaAuth.login(message.attemptId, message.code)
    const previous = (await guangyaAuth.getState()).session
    const saved = (await chrome.storage.local.get(WEB_TARGET_KEY))[WEB_TARGET_KEY]
    const target = saved?.accountId === session.accountId ? saved.target : null
    const save = async () => {
      await chrome.storage.local.set({ [ACCOUNT_KEY]: session, [WEB_TARGET_KEY]: { accountId: session.accountId, target } })
      await chrome.storage.session.remove(WEB_KEY)
    }
    const keep = !previous || previous.accountId === session.accountId
    if (keep) await save()
    let root
    try { root = await limiter.run(() => readFolderPage(session, '', 0, true)) }
    catch (error) {
      if (!keep) throw error
      return { root: null, target, directoryError: error.message }
    }
    if (!keep) await save()
    return { root, target }
  }
  if (message.type === 'open-web-login') {
    const tab = await chrome.tabs.create({ url: 'https://www.guangyapan.com/' })
    await chrome.storage.session.set({ guangyaLoginTabId: tab.id })
    return null
  }
  if (message.type === 'connect-web') {
    const { guangyaLoginTabId } = await chrome.storage.session.get('guangyaLoginTabId')
    if (!Number.isInteger(guangyaLoginTabId)) throw new Error('请先点击“打开光鸭官网登录”')
    let results
    try {
      const tab = await chrome.tabs.get(guangyaLoginTabId)
      if (new URL(tab.url).origin !== 'https://www.guangyapan.com') throw new Error()
      results = await chrome.scripting.executeScript({ target: { tabId: guangyaLoginTabId }, func: readGuangyaWebSession })
    } catch {
      throw new Error('登录标签页已关闭或地址已改变，请重新打开光鸭官网登录')
    }
    const session = results?.[0]?.result
    if (!session) throw new Error('尚未登录或登录已过期，请在刚打开的光鸭官网完成登录或刷新后重试')
    const root = await limiter.run(() => readFolderPage(session, '', 0, true))
    const state = await chrome.storage.local.get(WEB_TARGET_KEY)
    const saved = state[WEB_TARGET_KEY]
    const target = saved?.accountId === session.accountId ? saved.target : null
    await guangyaAuth.clear()
    await chrome.storage.session.set({ [WEB_KEY]: session })
    await chrome.storage.local.set({ [WEB_TARGET_KEY]: { accountId: session.accountId, target } })
    return { root, target }
  }
  if (message.type === 'get-state') {
    if (web) {
      const { session, connected } = await guangyaAuth.getState()
      const saved = (await chrome.storage.local.get(WEB_TARGET_KEY))[WEB_TARGET_KEY]
      return { connected, target: connected && saved?.accountId === session.accountId ? saved.target : null }
    }
    const state = await chrome.storage.local.get([CREDENTIALS_KEY, TARGET_KEY])
    return { connected: Boolean(state[CREDENTIALS_KEY]), target: state[TARGET_KEY] || null }
  }
  if (message.type === 'connect') {
    const credentials = validateCredentials(message.credentials)
    const root = await limiter.run(() => readFolderPage(credentials))
    const state = await chrome.storage.local.get([CREDENTIALS_KEY, TARGET_KEY])
    const sameAccount = state[CREDENTIALS_KEY]?.clientId === credentials.clientId
    const target = sameAccount ? state[TARGET_KEY] || null : null
    // 只有根目录读取成功才替换连接；失败时保留原连接和目标。
    await chrome.storage.local.set({ [CREDENTIALS_KEY]: credentials, [TARGET_KEY]: target })
    return { root, target }
  }
  if (message.type === 'disconnect') {
    if (web) {
      await guangyaAuth.clear()
      await chrome.storage.session.remove([WEB_KEY, 'guangyaLoginTabId'])
      await chrome.storage.local.remove(WEB_TARGET_KEY)
      return null
    }
    await chrome.storage.local.remove([CREDENTIALS_KEY, TARGET_KEY])
    return null
  }
  if (message.type === 'list-folders') {
    const credentials = web ? await getWebSession() : await getCredentials()
    return limiter.run(() => readFolderPage(credentials, message.parentId, message.page, web))
  }
  if (message.type === 'save-target') {
    const session = web ? await getWebSession() : await getCredentials()
    const path = message.path
    if (!Array.isArray(path) || !path.length || path.length > 100 || path[0]?.id !== ''
      || path.some((entry, index) => !entry || typeof entry.id !== 'string' || (index > 0 && !entry.id)
        || typeof entry.name !== 'string' || !entry.name)) {
      throw new Error('目标文件夹无效，请重新选择')
    }
    const target = { id: path.at(-1).id, path: path.map(({ id, name }) => ({ id, name })) }
    await chrome.storage.local.set({ [targetKey]: web ? { accountId: session.accountId, target } : target })
    return target
  }
  throw new Error('未知操作')
}

const handleCachedMessage = createCachedHandler(chrome.storage.local, handleMessage)

const transfers = createTransferService(chrome, handleCachedMessage, undefined, undefined, async renew => renew ? getWebSession() : (await guangyaAuth.getState()).session)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id === chrome.runtime.id && sender.url === chrome.runtime.getURL('popup.html') && message.type === 'open-task-panel') {
    if (!Number.isInteger(sender.tab?.windowId)) { sendResponse({ ok: false, error: '无法定位当前浏览器窗口' }); return }
    // 在用户点击的消息处理阶段立即打开，不能排到下载任务之后而丢失用户手势。
    chrome.sidePanel.open({ windowId: sender.tab.windowId }).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false, error: '侧边栏未能打开，请再次点击“全部任务”' }))
    return true
  }
  if (sender.id === chrome.runtime.id && ['list-transfers', 'check-offline'].includes(message.type)) {
    const panelUrl = chrome.runtime.getURL('transfer-panel.html')
    const read = async () => {
      await ready
      const trusted = sender.url === panelUrl && !sender.tab
      if (!trusted) throw new Error('任务面板未授权')
      if (message.type === 'check-offline') {
        const pending = commands.then(() => transfers.checkOffline(message.jobId))
        commands = pending.catch(() => {})
        await pending
      }
      const jobs = await transfers.list()
      const pending = jobs.filter(job => ['queued', 'preparing', 'submitting', 'downloading'].includes(job.status)).length
      await chrome.action.setBadgeText({ text: pending ? String(pending) : '' })
      return jobs
    }
    read().then(data => sendResponse({ ok: true, data })).catch(error => sendResponse({ ok: false, error: error.message }))
    return true
  }
  if (sender.id === chrome.runtime.id && sender.url?.startsWith(chrome.runtime.getURL('transfer.html') + '?') && message.type === 'read-transfer') {
    transfers.read(message.jobId).then(data => sendResponse({ ok: true, data })).catch(error => sendResponse({ ok: false, error: error.message }))
    return true
  }
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup.html')) return
  // 将连接、读目录和断开串行执行，避免切换账号时混入旧账号数据。
  const pending = commands.then(async () => { await ready; return handleCachedMessage(message) })
  commands = pending.catch(() => {})
  pending.then(data => sendResponse({ ok: true, data }))
    .catch(error => sendResponse({ ok: false, error: error.message, authExpired: Boolean(error.authExpired) }))
  return true
})


async function registerTransferMenu() {
  await chrome.contextMenus.removeAll()
  chrome.contextMenus.create({ id: 'save-share', title: '转存分享至已选目录', contexts: ['selection', 'link', 'page'] })
  chrome.contextMenus.create({ id: 'save-magnet', title: '磁力下载到已选目录', contexts: ['selection', 'link'] })
  for (const [provider, name] of [['115', '115'], ['guangya', '光鸭'], ['123', '123']]) chrome.contextMenus.create({ id: `save-magnet-${provider}`, parentId: 'save-magnet', title: name, contexts: ['selection', 'link'] })
  await chrome.alarms?.create('magnet-status', { periodInMinutes: 1 })
}
chrome.runtime.onInstalled?.addListener(registerTransferMenu)
chrome.runtime.onStartup?.addListener(registerTransferMenu)
// 接收提交与执行转存使用不同队列：提交只读本机状态，长任务不阻塞下一次右键。
let submissions = Promise.resolve()
chrome.contextMenus?.onClicked.addListener((info, tab) => {
  const magnetProvider = /^save-magnet-(115|guangya|123)$/.exec(String(info.menuItemId))?.[1]
  if (info.menuItemId !== 'save-share' && !magnetProvider) return
  // 全局侧边栏属于浏览器窗口，跨标签页保持打开；立即调用以保留右键用户手势。
  if (Number.isInteger(tab?.windowId)) chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {})
  const receipt = submissions.then(async () => {
    await ready
    const jobId = await transfers.create({ linkUrl: info.linkUrl, selectionText: info.selectionText, ...(magnetProvider ? { kind: 'magnet', provider: magnetProvider } : {}) })
    const pending = commands.then(() => transfers.run(jobId))
    commands = pending.catch(() => {})
    await chrome.action.setBadgeText({ text: String((await transfers.list()).filter(job => ['queued', 'preparing', 'submitting', 'downloading'].includes(job.status)).length) })
    pending.finally(async () => {
      const count = (await transfers.list()).filter(job => ['queued', 'preparing', 'submitting', 'downloading'].includes(job.status)).length
      await chrome.action.setBadgeText({ text: count ? String(count) : '' })
    }).catch(() => {})
  })
  submissions = receipt.catch(() => {})
})

let monitoringOffline = false
chrome.alarms?.onAlarm.addListener(alarm => {
  if (alarm.name !== 'magnet-status' || monitoringOffline) return
  monitoringOffline = true
  const pending = commands.then(async () => {
    await ready
    await transfers.monitorOffline()
    const count = (await transfers.list()).filter(job => ['queued', 'preparing', 'submitting', 'downloading'].includes(job.status)).length
    await chrome.action.setBadgeText({ text: count ? String(count) : '' })
  }).finally(() => { monitoringOffline = false })
  commands = pending.catch(() => {})
})
