// 事件广播模块（避免循环引用）
export const sseClients = new Map()
let clientSeq = 0

export function addClient(res) {
  const id = ++clientSeq
  sseClients.set(id, res)
  return id
}

export function removeClient(id) {
  sseClients.delete(id)
}

export function sseEmit(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const client of sseClients.values()) {
    client.write(payload)
  }
}
