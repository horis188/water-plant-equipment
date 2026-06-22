// ====================================================================
// 权限判断钩子 (P0-5 RBAC)
// 用法:
//   const { has, hasAny, hasAll } = usePermission()
//   if (has('btn:wo_create')) ...
//   if (hasAny(['btn:wo_review', 'btn:wo_complete'])) ...
// ====================================================================
import { computed } from 'vue'
import { permissionCodes } from './useDeviceStore'

export function usePermission() {
  // 用 Set 加速查找
  const codeSet = computed(() => new Set(permissionCodes.value))

  function has(code: string): boolean {
    return codeSet.value.has(code)
  }

  function hasAny(codes: string[]): boolean {
    if (!codes || codes.length === 0) return false
    return codes.some(c => codeSet.value.has(c))
  }

  function hasAll(codes: string[]): boolean {
    if (!codes || codes.length === 0) return true
    return codes.every(c => codeSet.value.has(c))
  }

  return { has, hasAny, hasAll, codes: permissionCodes }
}
