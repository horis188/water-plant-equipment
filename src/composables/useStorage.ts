/**
 * localStorage 持久化工具
 */

const PREFIX = 'water_plant_'

export function save(key: string, data: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(data))
  } catch (e) {
    console.error('[storage] save failed:', key, e)
  }
}

export function load<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw === null) return defaultValue
    return JSON.parse(raw) as T
  } catch (e) {
    console.error('[storage] load failed:', key, e)
    return defaultValue
  }
}

export function remove(key: string) {
  localStorage.removeItem(PREFIX + key)
}
