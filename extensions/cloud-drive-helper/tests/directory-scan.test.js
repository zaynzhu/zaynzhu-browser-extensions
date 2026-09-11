import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDirectoryScan } from '../directory-scan.js'

function fixture() {
  let clock = 0
  let key = 'synthetic-account'
  const calls = []
  const page = (folders, total = folders.length) => ({ folders, total, page: 0, pageSize: 50 })
  const pages = { '': page([{ id: '1', name: '合成父目录' }]), '1': page([{ id: '2', name: '合成子目录' }]), '2': page([]) }
  const service = createDirectoryScan(async message => {
    calls.push(message)
    if (message.type === 'save-target') return { id: message.path.at(-1).id, path: message.path }
    return pages[message.parentId]
  }, async () => key, () => clock)
  const base = { provider: '123', mode: 'web', app: '', connectionId: 'synthetic' }
  return { service, calls, pages, base, tick() { clock += 5000 }, change() { key = 'changed' } }
}

test('默认不请求；逐页串行遍历全部层级，五秒节流，完成后保存完整路径', async () => {
  const f = fixture()
  assert.equal(f.calls.length, 0)
  const { id } = await f.service.execute({ ...f.base, type: 'scan-start' }, 1)
  assert.equal(f.calls.length, 0)
  const step = () => f.service.execute({ type: 'scan-step', scanId: id }, 1)
  assert.equal((await step()).count, 1)
  assert.equal((await step()).waiting, 5000)
  assert.equal(f.calls.length, 1)
  await assert.rejects(f.service.execute({ type: 'scan-target', scanId: id, index: 0 }, 2), /停止/)
  f.tick(); assert.equal((await step()).count, 2)
  f.tick(); const done = await step()
  assert.equal(done.done, true)
  assert.deepEqual(f.calls.map(call => call.parentId), ['', '1', '2'])
  const target = await f.service.execute({ type: 'scan-target', scanId: id, index: 1 }, 1)
  assert.equal(target.id, '2')
  assert.equal(target.path.length, 3)
  assert.equal(f.calls.at(-1).fullScan, true)
})

test('停止、账号变化与后台重建均不继续请求；拒绝跨页面读取', async () => {
  for (const action of ['stop', 'account', 'close']) {
    const f = fixture()
    const { id } = await f.service.execute({ ...f.base, type: 'scan-start' }, 1)
    if (action === 'stop') f.service.cancel(id, 1)
    if (action === 'account') f.change()
    if (action === 'close') f.service.close(1)
    await assert.rejects(f.service.execute({ type: 'scan-step', scanId: id }, 1))
    assert.equal(f.calls.length, 0)
  }
})

test('同范围重复开启替换旧扫描，分页处理无目录的文件页，循环目录与接口拒绝即停止', async () => {
  const f = fixture()
  const old = await f.service.execute({ ...f.base, type: 'scan-start' }, 1)
  const { id } = await f.service.execute({ ...f.base, type: 'scan-start' }, 2)
  await assert.rejects(f.service.execute({ type: 'scan-step', scanId: old.id }, 1))
  f.pages[''] = { folders: [], total: 51, page: 0, pageSize: 50 }
  await f.service.execute({ type: 'scan-step', scanId: id }, 2)
  f.tick()
  f.pages[''] = { folders: [{ id: '1', name: '合成' }], total: 51, page: 1, pageSize: 50 }
  await f.service.execute({ type: 'scan-step', scanId: id }, 2)
  assert.equal(f.calls.at(-1).page, 1)
  f.tick()
  f.pages['1'] = { folders: [{ id: '1', name: '循环' }], total: 1, page: 0, pageSize: 50 }
  await assert.rejects(f.service.execute({ type: 'scan-step', scanId: id }, 2), /重复/)
  const count = f.calls.length
  await assert.rejects(f.service.execute({ type: 'scan-step', scanId: id }, 2))
  assert.equal(f.calls.length, count)
})

test('停止发生在请求过程中时丢弃响应，不返回目录结果', async () => {
  let resolve
  const service = createDirectoryScan(() => new Promise(done => { resolve = done }), async () => 'synthetic')
  const { id } = await service.execute({ type: 'scan-start', provider: '115' }, 1)
  const pending = service.execute({ type: 'scan-step', scanId: id }, 1)
  await new Promise(done => setImmediate(done))
  service.cancel(id, 1)
  resolve({ folders: [], total: 0, page: 0, pageSize: 50 })
  await assert.rejects(pending, /停止/)
})
