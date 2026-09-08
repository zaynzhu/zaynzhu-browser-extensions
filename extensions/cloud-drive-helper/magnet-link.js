export function parseMagnet(text, provider) {
  if (!['115', 'guangya', '123'].includes(provider)) throw new Error('请选择磁力任务使用的云盘')
  if (typeof text !== 'string' || text.length > 10000) throw new Error('请选择一个磁力链接')
  const links = [...text.matchAll(/magnet:\?[^\s<>"'，。；）)]+/gi)].map(match => match[0])
  if (new Set(links).size !== 1) throw new Error('请一次选择一个磁力链接，不支持种子文件或纯脚本按钮')
  const url = new URL(links[0])
  const hashes = url.searchParams.getAll('xt')
  if (hashes.length !== 1) throw new Error('磁力链接必须包含一个 BTIH 标识')
  const match = hashes[0].match(/^urn:btih:([a-f\d]{40}|[a-z2-7]{32})$/i)
  if (!match) throw new Error('暂不支持此磁力格式，仅支持 BTIH 磁力链接')
  let infoHash = match[1].toLowerCase()
  if (infoHash.length === 32) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    let bits = ''
    for (const char of infoHash.toUpperCase()) bits += alphabet.indexOf(char).toString(2).padStart(5, '0')
    infoHash = bits.match(/.{4}/g).map(part => Number.parseInt(part, 2).toString(16)).join('')
  }
  url.searchParams.delete('xt')
  const extra = url.searchParams.toString()
  return { provider, kind: 'magnet', infoHash, shareId: infoHash, url: `magnet:?xt=urn:btih:${infoHash}${extra ? `&${extra}` : ''}` }
}
