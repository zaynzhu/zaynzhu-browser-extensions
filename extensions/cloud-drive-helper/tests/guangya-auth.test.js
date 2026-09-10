import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createGuangyaAuth, normalizeGuangyaLogin, ACCOUNT_KEY } from '../guangya-auth.js'

const tokens = { access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', sub: 'synthetic-account', expires_in: 3600 }
function storage(values = {}) {
  return { values, async get(keys) { return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, structuredClone(values[key])])) }, async set(data) { Object.assign(values, structuredClone(data)) }, async remove(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key] } }
}
const setup = (initial = {}) => ({ storage: { local: storage(initial), session: storage() } })
const immediate = { run: action => action() }

test('光鸭官方短信流程按验证码请求、校验、登录顺序执行，不保存验证码', async t => {
  const chrome = setup()
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const body = JSON.parse(options.body)
    calls.push({ path: new URL(url).pathname, body, options })
    if (url.endsWith('/captcha/init')) return Response.json({ captcha_token: 'synthetic-captcha', expires_in: 300 })
    if (url.endsWith('/verification')) return Response.json({ verification_id: 'synthetic-verification', is_user: true })
    if (url.endsWith('/verify')) return Response.json({ verification_token: 'synthetic-verification-token' })
    return Response.json(tokens)
  })
  const auth = createGuangyaAuth(chrome, immediate)
  const pending = await auth.sendCode('10000000000')
  await assert.rejects(auth.sendCode('10000000000'), /60 秒/)
  const session = await auth.login(pending.attemptId, '123456')
  assert.equal(session.accountId, tokens.sub)
  assert.equal(session.refreshToken, tokens.refresh_token)
  assert.deepEqual(calls.map(call => call.path), ['/v1/shield/captcha/init', '/v1/auth/verification', '/v1/auth/verification/verify', '/v1/shield/captcha/init', '/v1/auth/signin'])
  assert.equal(calls[1].body.phone_number, '+86 10000000000')
  assert.equal(calls[4].body.verification_token, 'synthetic-verification-token')
  assert.ok(calls.every(call => call.options.credentials === 'omit' && call.options.redirect === 'error'))
  assert.ok(!JSON.stringify(chrome.storage).includes('123456'))
  assert.ok(!JSON.stringify(chrome.storage.local.values).includes('10000000000'))
  assert.equal(chrome.storage.session.values.guangyaSmsPending, undefined)
})

test('光鸭人机验证或未注册账号不会被绕过，不自动发送重复短信或注册', async t => {
  let count = 0
  t.mock.method(globalThis, 'fetch', async () => { count++; return Response.json({ url: 'https://account.guangyapan.com/synthetic-challenge', captcha_token: 'synthetic' }) })
  await assert.rejects(createGuangyaAuth(setup(), immediate).sendCode('10000000000'), /人机验证/)
  assert.equal(count, 1)
  t.mock.restoreAll()
  const chrome = setup()
  t.mock.method(globalThis, 'fetch', async url => Response.json(url.endsWith('/captcha/init') ? { captcha_token: 'synthetic' } : { verification_id: 'synthetic', is_user: false }))
  await assert.rejects(createGuangyaAuth(chrome, immediate).sendCode('10000000000'), /已有光鸭账号/)
  assert.equal(chrome.storage.session.values.guangyaSmsPending, undefined)
})

test('光鸭持久登录可续期并轮换令牌，并发续期只请求一次，连接身份和目标保持', async t => {
  const original = { ...normalizeGuangyaLogin(tokens), expiresAt: Date.now() - 1 }
  const target = { accountId: tokens.sub, target: { id: '42', path: [{ id: '', name: '根目录' }, { id: '42', name: '合成目标' }] } }
  const chrome = setup({ [ACCOUNT_KEY]: original, guangyaWebTarget: target })
  let requests = 0
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests++
    assert.equal(url, 'https://account.guangyapan.com/v1/auth/token')
    assert.equal(JSON.parse(options.body).grant_type, 'refresh_token')
    return Response.json({ ...tokens, access_token: 'synthetic-renewed', refresh_token: 'synthetic-rotated' })
  })
  const auth = createGuangyaAuth(chrome, immediate)
  assert.equal((await auth.getState()).connected, true)
  assert.equal(requests, 0)
  const [first, second] = await Promise.all([auth.getSession(), auth.getSession()])
  assert.equal(requests, 1)
  assert.equal(first.accessToken, 'synthetic-renewed')
  assert.equal(second.connectionId, original.connectionId)
  assert.equal(chrome.storage.local.values[ACCOUNT_KEY].refreshToken, 'synthetic-rotated')
  assert.deepEqual(chrome.storage.local.values.guangyaWebTarget, target)
  assert.equal((await createGuangyaAuth(chrome, immediate).getSession()).accessToken, 'synthetic-renewed')
  assert.equal(requests, 1)
})

test('光鸭续期账号不匹配不替换，网络失败保留会话，明确拒绝后停止自动续期', async t => {
  assert.throws(() => normalizeGuangyaLogin({ ...tokens, sub: 'other' }, { accountId: tokens.sub }), /账号不匹配/)
  const original = { ...normalizeGuangyaLogin(tokens), expiresAt: 1 }
  const chrome = setup({ [ACCOUNT_KEY]: original })
  let mode = 'network'
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => { calls++; if (mode === 'network') throw new Error('network'); return Response.json({ error: 'invalid_grant' }, { status: 401 }) })
  const auth = createGuangyaAuth(chrome, immediate)
  await assert.rejects(auth.getSession(), /暂时无法连接/)
  assert.deepEqual(chrome.storage.local.values[ACCOUNT_KEY], original)
  mode = 'reject'
  await assert.rejects(auth.getSession(), error => error.authExpired === true)
  assert.equal((await auth.getState()).connected, false)
  await assert.rejects(auth.getSession(), /已失效/)
  assert.equal(calls, 2)
  await auth.clear()
  assert.equal(chrome.storage.local.values[ACCOUNT_KEY], undefined)
})

test('短信登录写入可信本机状态，保留同账号目标，不向配置页暴露令牌', async t => {
  const local = storage({ guangyaWebTarget: { accountId: tokens.sub, target: { id: '42', path: [{ id: '', name: '根目录' }, { id: '42', name: '合成目标' }] } } })
  local.setAccessLevel = async () => {}
  const temporary = storage()
  let listener
  globalThis.chrome = { storage: { local, session: temporary }, action: {}, runtime: { id: 'synthetic', getURL: path => `chrome-extension://synthetic/${path}`, onMessage: { addListener: handler => { listener = handler } } } }
  t.after(() => { delete globalThis.chrome })
  // 推进合成时钟，验证同一后台消息链而不等待真实限流计时。
  let now = Date.now()
  t.mock.method(Date, 'now', () => (now += 3000))
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.endsWith('/captcha/init')) return Response.json({ captcha_token: 'synthetic-captcha' })
    if (url.endsWith('/verification')) return Response.json({ verification_id: 'synthetic-verification', is_user: true })
    if (url.endsWith('/verify')) return Response.json({ verification_token: 'synthetic-verified' })
    if (url.endsWith('/signin')) return Response.json(tokens)
    return Response.json({ code: 0, data: { list: [], total: 0 } })
  })
  await import('../background.js')
  const sender = { id: 'synthetic', url: 'chrome-extension://synthetic/popup.html' }
  const send = message => new Promise(resolve => listener({ provider: 'guangya', mode: 'web', ...message }, sender, resolve))
  const sms = await send({ type: 'send-sms', phone: '10000000000' })
  assert.equal(sms.ok, true)
  const login = await send({ type: 'connect-sms', attemptId: sms.data.attemptId, code: '123456' })
  assert.equal(login.ok, true)
  assert.equal(login.data.target.id, '42')
  assert.equal(local.values[ACCOUNT_KEY].refreshToken, tokens.refresh_token)
  const state = await send({ type: 'get-state' })
  assert.equal(state.data.connected, true)
  assert.ok(!JSON.stringify([state, login]).includes('synthetic-access'))
  assert.ok(!JSON.stringify([state, login]).includes('synthetic-refresh'))
  assert.ok(!JSON.stringify(local.values).includes('123456'))
  await send({ type: 'disconnect' })
  assert.equal(local.values[ACCOUNT_KEY], undefined)
  assert.equal(local.values.guangyaWebTarget, undefined)
})

test('排队不触发光鸭续期，执行和写入前更新令牌但不误判账号目标变化', async () => {
  const { createTransferService } = await import('../transfer-background.js')
  const target = { id: '42', path: [{ id: '', name: '根目录' }, { id: '42', name: '合成目标' }] }
  const chrome = setup({ guangyaWebTarget: { accountId: tokens.sub, target } })
  let renewals = 0
  const session = { ...normalizeGuangyaLogin(tokens), expiresAt: 1 }
  const getSession = async renew => ({ ...session, accessToken: renew ? `synthetic-renew-${++renewals}` : 'synthetic-expired' })
  const service = createTransferService(chrome, async () => ({ connected: true }), async context => {
    assert.equal(context.session.accessToken, 'synthetic-renew-1')
    await context.beforeWrite()
    assert.equal(context.session.accessToken, 'synthetic-renew-2')
    assert.equal(context.target.id, '42')
    return { count: 1 }
  }, undefined, getSession)
  const jobId = await service.create({ linkUrl: 'https://www.guangyapan.com/s/synthetic' })
  assert.equal(renewals, 0)
  await service.run(jobId)
  assert.equal((await service.read(jobId)).status, 'success')
})
