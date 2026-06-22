// ====================================================================
// SSE 订阅 composable (P1 业务事件基础设施)
// 用法:
//   useSSE('device-status-change', (payload) => {
//     console.log('设备状态变了:', payload)
//   })
//
// 特性:
// - 共享单条 EventSource 连接 (按 url), 所有 useSSE 复用同一连接
// - 自动 onMounted 订阅 / onUnmounted 取消
// - 相对路径 /api/events 自动走 vite 代理 (P0-5 修复)
// - 事件名区分大小写
// ====================================================================
import { ref, onUnmounted } from 'vue'

interface SSEClient {
  source: EventSource
  listeners: Map<string, Set<(data: any) => void>>
}

// 全局共享连接 (按 URL 复用)
const sharedClients = new Map<string, SSEClient>()

function getOrCreateClient(url: string): SSEClient {
  if (sharedClients.has(url)) return sharedClients.get(url)!
  const source = new EventSource(url)
  const listeners = new Map<string, Set<(data: any) => void>>()
  const client: SSEClient = { source, listeners }

  // 转发所有事件到对应 listener 集合
  source.onerror = () => {
    // SSE 自动重连, 不需要处理
  }
  source.onopen = () => {
    // console.debug('[SSE] 连接已建立:', url)
  }

  // 用 onmessage 接收不到自定义事件, 必须 addEventListener
  // 这里用 onadd event (不靠谱), 改为每个事件 addEventListener
  // 因为我们不知道后端会 emit 哪些事件, 采用 wildcard 不可行
  // → 改为在 registerListener 里 addEventListener

  sharedClients.set(url, client)
  return client
}

function registerListener(url: string, eventName: string, handler: (data: any) => void): () => void {
  const client = getOrCreateClient(url)
  if (!client.listeners.has(eventName)) {
    client.listeners.set(eventName, new Set())
    // 第一次注册该事件时, 给 EventSource 加监听
    client.source.addEventListener(eventName, (e: MessageEvent) => {
      let payload: any = {}
      try { payload = JSON.parse(e.data) } catch {}
      // 通知所有订阅该事件的 handler
      for (const h of client.listeners.get(eventName) || []) {
        try { h(payload) } catch (err) { console.error(`[SSE] handler error for ${eventName}:`, err) }
      }
    })
  }
  client.listeners.get(eventName)!.add(handler)
  // 返回取消订阅函数
  return () => {
    const set = client.listeners.get(eventName)
    if (!set) return
    set.delete(handler)
    if (set.size === 0) {
      // 无人订阅, 移除 EventSource 监听 (实际: EventSource 不支持 removeEventListener 移除自定义事件)
      // 简化: 保留 set 空, addEventListener 仍然存在但没人调用
      // 极端情况下 (页面全卸载), 应该关闭 EventSource, 但 Vue 路由切换不卸载 composable
      // 这里不处理, 接受 EventSource 一直开着 (轻量)
    }
  }
}

// 引用计数: 当 useSSE 全部卸载后, 关闭连接
const refCount = new Map<string, number>()

/**
 * 订阅一个 SSE 事件
 * @param eventName 事件名 (e.g. 'rbac-update', 'device-status-change')
 * @param handler 事件处理函数, 接收 payload
 * @param options.url SSE 连接地址, 默认 '/api/events' (走 vite 代理)
 * @returns 取消订阅函数
 */
export function useSSE(
  eventName: string,
  handler: (data: any) => void,
  options: { url?: string } = {}
): void {
  const url = options.url || '/api/events'
  // 引用计数
  refCount.set(url, (refCount.get(url) || 0) + 1)
  const unsubscribe = registerListener(url, eventName, handler)
  onUnmounted(() => {
    unsubscribe()
    const cnt = (refCount.get(url) || 1) - 1
    refCount.set(url, cnt)
    if (cnt <= 0) {
      // 关闭 EventSource
      const client = sharedClients.get(url)
      if (client) {
        client.source.close()
        sharedClients.delete(url)
      }
      refCount.delete(url)
    }
  })
}
