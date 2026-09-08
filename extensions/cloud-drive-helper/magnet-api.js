import { request123 } from './pan123-api.js'
import { getDirectoryUrl } from './pan115-api.js'

const reject = message => Object.assign(new Error(message), { definitive: true })
const safeId = value => {
  if (!['string', 'number'].includes(typeof value) || (typeof value === 'number' && !Number.isSafeInteger(value)) || !/^[A-Za-z0-9_-]+$/.test(String(value))) throw new Error('接口标识无法精确读取')
  return String(value)
}
const integer = value => {
  const number = Number(safeId(value))
  if (!Number.isSafeInteger(number)) throw reject('目标或资源标识超过可精确提交的范围，未提交任务')
  return number
}
function taskId(value) {
  const id = safeId(value)
  if (id === '0') throw new Error('服务端未返回有效任务标识，结果未确认')
  return id
}
function reason(provider, result) {
  const message = String(result?.err_msg || result?.errMsg || result?.error_msg || result?.message || result?.msg || '')
  if (/无资源|没有资源|资源不存在|解析失败|无法解析|资源失效|资源不可用/.test(message)) return `${provider} 无法解析或获取该磁力资源`
  if (/验证|captcha/i.test(message)) return `${provider} 要求验证，请在官网处理；本版不自动重试`
  if (/空间/.test(message)) return `${provider} 空间不足，离线任务失败`
  if (/会员|配额|次数|权限/.test(message)) return `${provider} 会员、配额或权限不足，离线任务失败`
  const code = [result?.code, result?.errcode, result?.err_code, result?.errno].find(value => Number.isSafeInteger(value))
  return `${provider} 拒绝离线请求${code === undefined ? '' : `（${code}）`}`
}

export function createMagnetClient({ share, target, session, limiter, with115Cookie }) {
  const provider = share.provider
  const name = provider === 'guangya' ? '光鸭' : provider
  async function json(url, body, cookie = false) {
    return limiter.run(async () => {
      const action = async () => {
        let response
        try {
          response = await fetch(url, {
            method: body ? 'POST' : 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(15000),
            ...(body ? { body: cookie ? new URLSearchParams(body) : JSON.stringify(body) } : {}),
            headers: cookie ? {} : { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
          })
        } catch { throw new Error(`${name} 请求超时或网络失败`) }
        if (!response.ok) {
          const error = new Error(`${name} 请求失败（HTTP ${response.status}）`)
          error.definitive = response.status >= 400 && response.status < 500
          throw error
        }
        let result
        try { result = await response.json() } catch { throw new Error(`${name} 响应格式无法确认`) }
        if (cookie ? ![true, 1].includes(result?.state) : !result || (result.code === undefined ? result.msg !== 'success' : result.code !== 0)) throw reject(reason(name, result))
        return cookie ? result : result.data
      }
      return cookie ? with115Cookie(url.split('?')[0], action) : action()
    })
  }
  const pan123 = (path, body) => limiter.run(() => request123(path, { token: session.token, body }))
  const guangya = (path, body) => json(`https://api.guangyapan.com/${path}`, body)
  const pan115 = (params, write = false) => json(`https://clouddownload.115.com/web/${write ? '' : `?${new URLSearchParams(params)}`}`, write ? params : undefined, true)

  async function files(parentId) {
    const items = []
    for (let page = 0; page < 30; page++) {
      let list, total
      if (provider === '115') {
        const alternate = session.app !== 'web'
        const url = `${getDirectoryUrl(session.app, alternate)}?${new URLSearchParams({ cid: parentId || '0', offset: page * 100, limit: 100, show_dir: 1, cur: 1, record_open_time: 0 })}`
        const data = await json(url, undefined, true)
        list = data.data?.map(item => ({ id: safeId(alternate ? item.fid : item.fid ?? item.cid), name: alternate ? item.fn || item.n || item.file_name : item.n, folder: alternate ? [0, '0'].includes(item.fc) : item.fid === undefined }))
        total = Number(data.count)
      } else if (provider === '123') {
        const data = await limiter.run(() => request123('file/list/new', { token: session.token, params: { parentFileId: parentId || '0', Page: page + 1, limit: 100, next: 0, driveId: 0, trashed: false, orderBy: 'file_id', orderDirection: 'desc' } }))
        list = data?.InfoList?.map(item => ({ id: safeId(item.FileId), name: item.FileName, folder: item.Type === 1 }))
        total = data?.Total
      } else {
        const data = await guangya('userres/v1/file/get_file_list', { parentId, page, pageSize: 100, orderBy: 0, sortType: 0 })
        list = data?.list?.map(item => ({ id: safeId(item.fileId), name: item.fileName, folder: item.resType === 2 }))
        total = data?.total ?? 0
      }
      if (!Array.isArray(list) || !Number.isSafeInteger(total) || total < 0 || list.some(item => typeof item.name !== 'string')) throw reject(`${name} 目录结构无法核实，停止操作`)
      items.push(...list)
      if (items.length === total) return items
      if (!list.length || items.length > total) break
    }
    throw reject(`${name} 目录分页不完整，停止操作`)
  }

  async function verifyTarget() {
    if (!target || typeof target.id !== 'string' || !Array.isArray(target.path) || !target.path.length || target.path.at(-1)?.id !== target.id) throw reject('未选定目标目录，未提交任务')
    if (target.id === '' && target.path.length === 1 && provider === 'guangya') return
    const parentId = target.path.at(-2)?.id
    if (typeof parentId !== 'string') throw reject('目标目录路径不完整，未提交任务')
    const list = await files(parentId)
    if (!list.some(item => item.id === target.id && item.folder && item.name === target.path.at(-1).name)) throw reject(`${name} 目标目录 ID 或名称不匹配，未提交任务`)
  }

  async function findTask(ref) {
    if (provider === 'guangya') {
      const data = await guangya('cloudcollection/v1/list_task', { taskIds: [ref.taskId] })
      if (!Array.isArray(data?.list)) throw new Error('光鸭任务列表格式无法确认')
      return data.list.find(item => String(item.taskId) === ref.taskId)
    }
    for (let page = 1; page <= 20; page++) {
      const data = provider === '123'
        ? await pan123('offline_download/task/list', { current_page: page, page_size: 100, status_arr: [0, 1, 2, 3] })
        : await pan115({ ac: 'task_lists', page, page_size: 100 })
      const list = provider === '123' ? data?.list : data?.tasks
      if (!Array.isArray(list)) throw new Error(`${name} 任务列表格式无法确认`)
      const task = list.find(item => provider === '123' ? String(item.task_id) === ref.taskId : String(item.info_hash).toLowerCase() === share.infoHash)
      if (task) return task
      if (list.length < 100) return null
    }
    throw new Error(`${name} 任务列表超过本版查询范围`)
  }

  return {
    async submit(beforeWrite) {
      await verifyTarget()
      const beforeIds = (await files(target.id)).map(item => item.id)
      if (provider === '115') {
        if (await findTask({})) throw reject('115 已存在相同磁力任务，未重复提交，也不会更改原任务目录')
        await beforeWrite()
        await pan115({ ac: 'add_task_url', url: share.url, wp_path_id: target.id }, true)
        return { taskId: share.infoHash, beforeIds }
      }
      if (provider === 'guangya') {
        const data = await guangya('cloudcollection/v1/resolve_res', { url: share.url })
        if (!data?.btResInfo) throw reject('光鸭无法解析该磁力资源，未提交任务')
        const indexes = []
        function walk(items) {
          if (!Array.isArray(items)) throw reject('光鸭磁力清单不完整，未提交任务')
          for (const item of items) {
            if (item.isDir) walk(item.subfiles)
            else if (Number.isSafeInteger(item.fileIndex) && item.fileIndex >= 0) indexes.push(item.fileIndex)
            else throw reject('光鸭磁力清单缺少文件标识，未提交任务')
          }
        }
        walk(data.btResInfo.subfiles)
        if (!indexes.length) throw reject('光鸭未找到可下载资源，未提交任务')
        await beforeWrite()
        const result = await guangya('cloudcollection/v1/create_task', { url: share.url, fileIndexes: indexes, parentId: target.id })
        return { taskId: taskId(result?.taskId), beforeIds }
      }
      const data = await pan123('v2/offline_download/task/resolve', { urls: share.url })
      const resource = data?.list?.[0]
      if (!resource || resource.result !== 0) throw reject(reason('123', resource) + '，未提交任务')
      if (!Array.isArray(resource.files) || !resource.files.length) throw reject('123 未找到可下载资源，未提交任务')
      const payload = { resource_list: [{ resource_id: integer(resource.id), select_file_id: resource.files.map(item => integer(item.id)) }], upload_dir: integer(target.id) }
      await beforeWrite()
      const result = await pan123('v2/offline_download/task/submit', payload)
      const task = result?.task_list?.[0]
      if (task?.result !== 0) throw reject(reason('123', task))
      return { taskId: taskId(task.task_id), beforeIds }
    },
    async check(ref) {
      const task = await findTask(ref)
      if (!task) return { status: 'downloading', message: '离线任务已提交，暂未查询到记录；尚未确认完成' }
      const state = Number(task.status)
      const knownStates = provider === '115' ? [-1, 0, 1, 2] : provider === 'guangya' ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3]
      if (task.status === undefined || !knownStates.includes(state)) return { status: 'unknown', message: `${name} 返回未知离线状态，未确认结果，不自动重试` }
      const failed = provider === '115' ? state === -1 : provider === '123' ? state === 1 : [3, 4, 5].includes(state)
      if (failed) return { status: 'failed', message: `${name} 服务端确认离线失败${provider === 'guangya' && state === 5 ? '（仅部分完成）' : ''}：${reason(name, task)}。不重试、不切换目录。` }
      if (state !== 2) {
        const phase = provider === '123' ? state === 3 ? '服务端重试中（插件未重复提交）' : '下载中' : state === 0 ? '排队中' : '下载中'
        return { status: 'downloading', message: `${name} 离线${phase}，尚未完成` }
      }
      const expectedId = provider === 'guangya' ? task.fileId : provider === '115' ? task.file_id : undefined
      const expectedName = provider === 'guangya' ? task.fileName : task.name
      await verifyTarget()
      const after = await files(target.id)
      const saved = after.find(item => !ref.beforeIds.includes(item.id) && (expectedId ? item.id === String(expectedId) : typeof expectedName === 'string' && item.name === expectedName))
      if (!saved) return { status: 'unknown', message: `${name} 返回离线完成，但未能在已选目录核实新增文件；结果未确认，不自动重试` }
      return { status: 'success', message: '磁力下载完成，已在原先选定的目录核实新增项目' }
    },
  }
}
