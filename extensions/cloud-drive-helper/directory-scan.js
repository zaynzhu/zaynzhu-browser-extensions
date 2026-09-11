// 配置页每次只推进一页；后台不自动循环，关闭页面后不再产生扫描请求。
export function createDirectoryScan(handle, identity, now = Date.now) {
  const scans = new Map()
  const scopeOf = message => message.provider === '115' ? `115-${message.app}` : message.provider === 'guangya' ? `guangya-${message.mode}` : '123'

  function cancel(id, owner) {
    const scan = scans.get(id)
    if (scan?.owner === owner) scans.delete(id)
  }

  async function execute(message, owner) {
    if (message.type === 'scan-start') {
      const key = await identity(message)
      const scope = scopeOf(message)
      for (const [id, scan] of scans) {
        if (scan.owner === owner || scan.scope === scope) scans.delete(id)
      }
      const id = crypto.randomUUID()
      scans.set(id, { owner, scope, key, base: { provider: message.provider, mode: message.mode, app: message.app, connectionId: message.connectionId },
        queue: [[{ id: '', name: '根目录' }]], index: 0, page: 0, folders: [], seen: new Set(['']), requests: 0, nextAt: 0 })
      return { id }
    }
    const scan = scans.get(message.scanId)
    if (!scan || scan.owner !== owner) throw new Error('扫描已停止或后台已重启，请重新开启扫描')
    try {
      if (await identity(scan.base) !== scan.key) throw new Error('连接已变化，扫描已停止，请重新加载配置页')
      if (scans.get(message.scanId) !== scan) throw new Error('扫描已停止')
      if (message.type === 'scan-target') {
        const path = scan.folders[message.index]
        if (!path || scan.index < scan.queue.length) throw new Error('请等待扫描完成后选择目标')
        return await handle({ ...scan.base, type: 'save-target', path, fullScan: true })
      }
      if (message.type !== 'scan-step') throw new Error('未知扫描操作')
      if (now() < scan.nextAt) return { waiting: scan.nextAt - now(), requests: scan.requests, count: scan.folders.length }
      if (scan.index < scan.queue.length) {
        const path = scan.queue[scan.index]
        const result = await handle({ ...scan.base, type: 'list-folders', parentId: path.at(-1).id, page: scan.page, force: true, fullScan: true })
        if (scans.get(message.scanId) !== scan) throw new Error('扫描已停止')
        scan.requests++
        scan.nextAt = now() + 5000
        if (!Number.isSafeInteger(result.total) || result.total < 0 || !Number.isSafeInteger(result.pageSize) || result.pageSize <= 0 || result.page !== scan.page) throw new Error('目录分页异常，扫描已停止')
        for (const folder of result.folders) {
          if (typeof folder.id !== 'string' || !folder.id || typeof folder.name !== 'string' || !folder.name || scan.seen.has(folder.id)) throw new Error('目录重复或结构变化，请稍后重新扫描')
          const next = [...path, folder]
          if (next.length > 100) throw new Error('目录层级超过目标路径支持范围')
          scan.seen.add(folder.id)
          scan.folders.push(next)
          scan.queue.push(next)
        }
        if ((scan.page + 1) * result.pageSize < result.total) scan.page++
        else { scan.index++; scan.page = 0 }
      }
      const done = scan.index === scan.queue.length
      return { done, requests: scan.requests, count: scan.folders.length, ...(done ? { folders: scan.folders } : {}) }
    } catch (error) {
      scans.delete(message.scanId)
      throw error
    }
  }

  function close(owner) {
    for (const [id, scan] of scans) if (scan.owner === owner) scans.delete(id)
  }
  return { execute, cancel, close }
}
