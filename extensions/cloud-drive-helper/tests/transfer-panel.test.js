import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

function storage(values = {}) {
  return { values, async get(keys) { return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, structuredClone(values[key])])) }, async set(data) { Object.assign(values, structuredClone(data)) }, async remove(key) { delete values[key] }, async setAccessLevel() {} }
}

test('右键立即打开窗口级任务侧栏，图标仍打开配置；网页和旧浮层不能读取任务', async t => {
  const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url)))
  assert.equal(manifest.action.default_popup, undefined)
  assert.equal(manifest.side_panel.default_path, 'transfer-panel.html')
  assert.equal(manifest.web_accessible_resources, undefined)
  assert.ok(!manifest.permissions.includes('activeTab'))
  let listener, click, openConfig
  let configOpened = false
  const opened = []
  const temporary = storage()
  globalThis.chrome = {
    runtime: { id: 'synthetic', getURL: path => `chrome-extension://synthetic/${path}`, openOptionsPage: async () => { configOpened = true }, onMessage: { addListener: value => { listener = value } } },
    action: { setBadgeText: async () => {}, onClicked: { addListener: value => { openConfig = value } } }, storage: { local: storage(), session: temporary },
    contextMenus: { onClicked: { addListener: value => { click = value } } },
    sidePanel: { open: async options => { opened.push(options) } },
    scripting: { executeScript: async () => { throw new Error('不得向网页注入任务框') } },
    tabs: { create: async () => { throw new Error('不得创建任务标签页') } },
  }
  t.after(() => { delete globalThis.chrome })
  t.mock.method(globalThis, 'fetch', () => { throw new Error('无效链接不应请求云盘') })
  await import('../background.js')
  await openConfig()
  assert.equal(configOpened, true)
  click({ menuItemId: 'save-share', selectionText: '合成无效链接' }, { id: 7, windowId: 3 })
  // 同步打开，不能等异步入队后才使用已失效的用户手势。
  assert.deepEqual(opened, [{ windowId: 3 }])
  for (let count = 0; count < 30 && !Object.values(temporary.values.shareTransferJobs || {}).some(job => job.status === 'failed'); count++) await new Promise(resolve => setTimeout(resolve, 5))
  const send = (sender, type = 'list-transfers') => new Promise(resolve => listener({ type }, sender, resolve))
  const panelUrl = 'chrome-extension://synthetic/transfer-panel.html'
  assert.equal((await send({ id: 'synthetic', tab: { id: 7 }, url: 'https://synthetic.example/' })).ok, false)
  assert.equal((await send({ id: 'synthetic', tab: { id: 7 }, url: panelUrl })).ok, false)
  assert.equal((await send({ id: 'synthetic', url: `${panelUrl}?token=old` })).ok, false)
  const allowed = await send({ id: 'synthetic', url: panelUrl })
  assert.equal(allowed.ok, true)
  assert.equal(allowed.data[0].status, 'failed')
  const config = { id: 'synthetic', tab: { id: 9, windowId: 3 }, url: 'chrome-extension://synthetic/popup.html' }
  assert.equal((await send(config, 'open-task-panel')).ok, true)
  assert.deepEqual(opened.at(-1), { windowId: 3 })
})
