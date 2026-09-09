import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseMagnet } from '../magnet-link.js'
import { createMagnetClient } from '../magnet-api.js'
import { createTransferService } from '../transfer-background.js'

const hash = 'a'.repeat(40)
const uri = `magnet:?xt=urn:btih:${hash}`
const target = { id: '42', path: [{ id: '', name: '根目录' }, { id: '42', name: '合成目标' }] }
const context = provider => ({ share: parseMagnet(uri, provider), target, session: { token: 'synthetic-token', accessToken: 'synthetic-access', expiresAt: Date.now() + 60000, app: 'harmony' }, limiter: { run: action => action() }, with115Cookie: async (url, action) => action() })

test('磁力入口只接受单个 BTIH，支持选中文字、按钮地址和 Base32，不接受种子文件', () => {
  assert.equal(parseMagnet(`合成链接 ${uri}`, '115').infoHash, hash)
  assert.equal(parseMagnet(uri, '115').url, uri)
  assert.equal(parseMagnet('magnet:?xt=urn:btih:' + 'A'.repeat(32), '123').infoHash, '0'.repeat(40))
  assert.ok(parseMagnet(uri + '&dn=synthetic', 'guangya').url.includes('dn=synthetic'))
  for (const bad of ['https://example.test/synthetic.torrent', `${uri} magnet:?xt=urn:btih:${'b'.repeat(40)}`, 'javascript:openMagnet()', 'magnet:?xt=urn:btmh:synthetic']) assert.throws(() => parseMagnet(bad, '115'))
  assert.throws(() => parseMagnet(uri, 'other'))
})

for (const provider of ['115', 'guangya', '123']) test(`${provider} 磁力只提交一次且填写已选目录，提交与完成分开，资源失败不重试`, async t => {
  let writes = 0
  let status = provider === '123' ? 0 : 1
  let marked = false
  let noResource = false
  t.mock.method(globalThis, 'fetch', async (raw, options) => {
    const url = new URL(raw)
    const body = options.body instanceof URLSearchParams ? Object.fromEntries(options.body) : options.body ? JSON.parse(options.body) : Object.fromEntries(url.searchParams)
    const submit = body.ac === 'add_task_url' || url.pathname.endsWith('/create_task') || url.pathname.endsWith('/task/submit')
    if (submit) {
      assert.ok(marked)
      assert.equal(String(body.wp_path_id ?? body.parentId ?? body.upload_dir), '42')
      assert.equal(body.savepath, undefined)
      if (provider === 'guangya') assert.deepEqual(body.fileIndexes, [0])
      writes++
      return Response.json(provider === '115' ? { state: true } : { code: 0, data: provider === '123' ? { task_list: [{ task_id: 77, result: 0 }] } : { taskId: '77' } })
    }
    if (url.pathname.endsWith('/resolve_res')) return Response.json(noResource ? { code: 404, msg: '没有资源' } : { code: 0, data: { btResInfo: { subfiles: [{ isDir: false }] } } })
    if (url.pathname.endsWith('/task/resolve')) return Response.json({ code: 0, data: { list: noResource ? [{ result: 1, err_msg: '解析失败' }] : [{ result: 0, id: 10, files: [{ id: 1 }] }] } })
    if (body.ac === 'task_lists') return Response.json({ state: true, tasks: writes ? [{ info_hash: hash, status, file_id: '900', name: '合成文件' }] : [] })
    if (url.pathname.endsWith('/list_task')) return Response.json({ code: 0, data: { list: [{ taskId: '77', status, fileId: '900', fileName: '合成文件' }] } })
    if (url.pathname.endsWith('/task/list')) return Response.json({ code: 0, data: { list: [{ task_id: 77, status, name: '合成文件' }] } })
    const root = String(body.cid ?? body.parentFileId ?? body.parentId) === '0' || body.parentId === ''
    const present = root || (writes && status === 2)
    const id = root ? '42' : '900'
    const name = root ? '合成目标' : '合成文件'
    if (provider === '115') return Response.json({ state: true, count: present ? 1 : 0, data: present ? [{ fid: id, fn: name, fc: root ? '0' : '1' }] : [] })
    if (provider === '123') return Response.json({ code: 0, data: { Total: present ? 1 : 0, InfoList: present ? [{ FileId: Number(id), FileName: name, Type: root ? 1 : 0 }] : [] } })
    return Response.json({ code: 0, data: { total: present ? 1 : 0, list: present ? [{ fileId: id, fileName: name, resType: root ? 2 : 1 }] : [] } })
  })
  const client = createMagnetClient(context(provider))
  const ref = await client.submit(async () => { marked = true })
  assert.equal(writes, 1)
  assert.equal((await client.check(ref)).status, 'downloading')
  status = 2
  assert.equal((await client.check(ref)).status, 'success')
  status = provider === '115' ? -1 : provider === '123' ? 1 : 3
  assert.equal((await client.check(ref)).status, 'failed')
  assert.equal(writes, 1)
  status = 999
  assert.equal((await client.check(ref)).status, 'unknown')
  if (provider !== '115') {
    noResource = true
    await assert.rejects(client.submit(async () => { throw new Error('解析失败时不应写入') }), /资源|解析/)
    assert.equal(writes, 1)
  } else {
    await assert.rejects(client.submit(async () => { throw new Error('不应重复写入') }), /已存在相同/)
  }
})

test('未选择目标或目标被替换时不会提交离线任务', async t => {
  let requests = 0
  t.mock.method(globalThis, 'fetch', async () => { requests++; return Response.json({ code: 0, data: { Total: 0, InfoList: [] } }) })
  await assert.rejects(createMagnetClient({ ...context('123'), target: null }).submit(async () => {}), /未选定/)
  assert.equal(requests, 0)
  await assert.rejects(createMagnetClient(context('123')).submit(async () => { throw new Error('不得调用') }), /不匹配/)
  assert.equal(requests, 1)
})

function storage(values = {}) {
  return { values, async get(keys) { return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, structuredClone(values[key])])) }, async set(data) { Object.assign(values, structuredClone(data)) }, async remove(key) { delete values[key] } }
}

test('磁力提交后释放执行队列，后台重启只查原任务，换目录停止查询，分享链路仍独立', async () => {
  const local = storage({ pan123Session: { accountId: 'account', token: 'synthetic-secret-token' }, pan123Target: { accountId: 'account', target } })
  const temporary = storage()
  const chrome = { storage: { local, session: temporary } }
  let writes = 0, reads = 0, shareWrites = 0
  const getState = async () => ({ connected: true })
  const executeShare = async () => { shareWrites++; return { count: 1 } }
  const client = () => ({ submit: async beforeWrite => { await beforeWrite(); writes++; return { taskId: '77', beforeIds: [] } }, check: async () => { reads++; return { status: 'downloading', message: '合成下载中' } } })
  let service = createTransferService(chrome, getState, executeShare, client)
  const jobId = await service.create({ kind: 'magnet', provider: '123', selectionText: uri })
  await service.run(jobId)
  assert.equal((await service.read(jobId)).status, 'downloading')
  assert.deepEqual((await service.read(jobId)).offline, { taskId: '77' })
  const shareId = await service.create({ linkUrl: 'https://www.123pan.com/s/synthetic' })
  await service.run(shareId)
  assert.equal(shareWrites, 1)
  service = createTransferService(chrome, getState, executeShare, client)
  await service.monitorOffline()
  assert.equal(writes, 1)
  assert.equal(reads, 2)
  local.values.pan123Target.target = { id: '99', path: [{ id: '', name: '根目录' }, { id: '99', name: '其他目录' }] }
  await service.monitorOffline()
  assert.equal((await service.read(jobId)).status, 'unknown')
  assert.equal(reads, 2)
  assert.equal(writes, 1)
  assert.ok(!JSON.stringify(temporary.values).includes('synthetic-secret-token'))
})

test('光鸭省略零值编号后若出现重复编号，停止且不创建任务', async t => {
  let createCalls = 0
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const body = JSON.parse(options.body)
    if (url.endsWith('/resolve_res')) return Response.json({ code: 0, data: { btResInfo: { subfiles: [{}, {}] } } })
    if (url.endsWith('/create_task')) { createCalls++; throw new Error('不应创建任务') }
    const list = body.parentId === '' ? [{ fileId: '42', fileName: '合成目标', resType: 2 }] : []
    return Response.json({ code: 0, data: { total: list.length, list } })
  })
  await assert.rejects(createMagnetClient(context('guangya')).submit(async () => {}), /编号重复/)
  assert.equal(createCalls, 0)
})
