import { RateLimiter } from './guangya-api.js'

export const ACCOUNT_KEY = 'guangyaAccountSession'
const CLIENT_ID = 'aMe-8VSlkrbQXpUR'
const PENDING_KEY = 'guangyaSmsPending'
const ORIGIN = 'https://account.guangyapan.com'
const validToken = value => typeof value === 'string' && value.length > 0 && value.length <= 16384 && !/\s/.test(value)

export function normalizeGuangyaLogin(data, previous) {
  const accountId = data?.sub ?? previous?.accountId
  const refreshToken = data?.refresh_token ?? previous?.refreshToken
  if (!validToken(data?.access_token) || !validToken(refreshToken) || typeof accountId !== 'string' || !accountId
    || !Number.isSafeInteger(data?.expires_in) || data.expires_in <= 0
    || (previous && accountId !== previous.accountId)) throw new Error('光鸭登录响应或账号不匹配，未替换连接')
  return { accessToken: data.access_token, refreshToken, accountId, expiresAt: Date.now() + data.expires_in * 1000, connectionId: previous?.connectionId || crypto.randomUUID() }
}

export function createGuangyaAuth(chromeApi, limiter = new RateLimiter(chromeApi.storage.session)) {
  const local = chromeApi.storage.local
  const temporary = chromeApi.storage.session
  let refreshing = null
  async function deviceId() {
    let { guangyaAuthDeviceId: value } = await local.get('guangyaAuthDeviceId')
    if (!value) { value = crypto.randomUUID().replaceAll('-', ''); await local.set({ guangyaAuthDeviceId: value }) }
    return value
  }
  async function request(path, body, captchaToken) {
    const device = await deviceId()
    return limiter.run(async () => {
      let response
      try {
        response = await fetch(`${ORIGIN}${path}`, {
          method: 'POST', credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(15000),
          headers: { 'Content-Type': 'application/json', 'Accept-Language': 'zh-CN', 'x-client-id': CLIENT_ID, 'x-device-id': device, ...(captchaToken ? { 'x-captcha-token': captchaToken } : {}) },
          body: JSON.stringify({ client_id: CLIENT_ID, ...body }),
        })
      } catch { throw new Error('光鸭登录服务暂时无法连接，请稍后重试') }
      let data
      try { data = await response.json() } catch { throw new Error('光鸭登录服务响应异常') }
      if (!response.ok || data?.error) {
        const error = new Error('光鸭拒绝登录或续期，请检查验证码、账号状态，必要时重新登录')
        error.authRejected = [400, 401, 403].includes(response.status)
        throw error
      }
      return data
    })
  }
  async function captcha(path, phone) {
    const data = await request('/v1/shield/captcha/init', { action: `POST:${path}`, device_id: await deviceId(), meta: { phone_number: phone } })
    if (data?.url !== undefined) throw new Error('光鸭要求人机验证，当前直连流程已停止；请使用下方官网登录备用入口')
    if (!validToken(data?.captcha_token)) throw new Error('光鸭未返回有效验证凭证，未继续登录')
    return data.captcha_token
  }
  return {
    async sendCode(phone) {
      if (typeof phone !== 'string' || !/^1\d{10}$/.test(phone)) throw new Error('请输入正确的中国大陆手机号')
      const { guangyaSmsSentAt = 0 } = await local.get('guangyaSmsSentAt')
      if (Date.now() - guangyaSmsSentAt < 60000) throw new Error('验证码请求间隔至少 60 秒，请稍后再试')
      await temporary.remove(PENDING_KEY)
      const formatted = `+86 ${phone}`
      const token = await captcha('/v1/auth/verification', formatted)
      // 发送结果不明也不自动重发，避免重复短信。
      await local.set({ guangyaSmsSentAt: Date.now() })
      const result = await request('/v1/auth/verification', { phone_number: formatted, target: 'ANY' }, token)
      if (!validToken(result?.verification_id)) throw new Error('短信请求结果无法确认，请稍后重试')
      if (result.is_user !== true) throw new Error('仅支持已有光鸭账号，请先在官网确认该手机号已注册')
      const attemptId = crypto.randomUUID()
      await temporary.set({ [PENDING_KEY]: { phone: formatted, verificationId: result.verification_id, attemptId, expiresAt: Date.now() + 300000 } })
      return { attemptId }
    },
    async login(attemptId, code) {
      const pending = (await temporary.get(PENDING_KEY))[PENDING_KEY]
      if (!pending || pending.attemptId !== attemptId || pending.expiresAt <= Date.now()) throw new Error('验证码请求已失效，请重新获取')
      if (typeof code !== 'string' || !/^\d{4,8}$/.test(code)) throw new Error('请输入有效验证码')
      const verified = await request('/v1/auth/verification/verify', { verification_id: pending.verificationId, verification_code: code })
      if (!validToken(verified?.verification_token)) throw new Error('光鸭未确认验证码，未继续登录')
      const token = await captcha('/v1/auth/signin', pending.phone)
      const data = await request('/v1/auth/signin', { username: pending.phone, verification_code: code, verification_token: verified.verification_token }, token)
      await temporary.remove(PENDING_KEY)
      return normalizeGuangyaLogin(data)
    },
    async getSession() {
      const session = (await local.get(ACCOUNT_KEY))[ACCOUNT_KEY]
      if (!session) return (await temporary.get('guangyaWebSession')).guangyaWebSession
      if (session.invalid) throw new Error('光鸭登录已失效，请重新输入手机号和验证码')
      if (session.expiresAt > Date.now() + 120000) return session
      if (!refreshing) {
        refreshing = (async () => {
          try {
            const data = await request('/v1/auth/token', { grant_type: 'refresh_token', refresh_token: session.refreshToken })
            const renewed = normalizeGuangyaLogin(data, session)
            await local.set({ [ACCOUNT_KEY]: renewed })
            return renewed
          } catch (error) {
            if (error.authRejected) {
              await local.set({ [ACCOUNT_KEY]: { ...session, invalid: true } })
              error.authExpired = true
            }
            throw error
          } finally { refreshing = null }
        })()
      }
      return refreshing
    },
    async getState() {
      const session = (await local.get(ACCOUNT_KEY))[ACCOUNT_KEY] || (await temporary.get('guangyaWebSession')).guangyaWebSession
      return { session, connected: Boolean(session && !session.invalid && (session.expiresAt > Date.now() || session.refreshToken)) }
    },
    async clear() {
      await local.remove(ACCOUNT_KEY)
      await temporary.remove(PENDING_KEY)
    },
  }
}
