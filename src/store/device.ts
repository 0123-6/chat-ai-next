import type {IUseSyncExternalStoreProps} from '@/util/hooks/IUseSyncExternalStoreProps.ts'

// 设备状态 store
let isMobile = false
const subSet = new Set<() => void>()

export const deviceStore: IUseSyncExternalStoreProps<boolean> = {
  subscribe: (sub: () => void) => {
    subSet.add(sub)
    return () => {
      subSet.delete(sub)
    }
  },
  getSnapshot: () => isMobile,
  set: newValue => {
    if (isMobile === newValue) {
      return
    }

    isMobile = newValue
    // 通知订阅者
    for (const sub of subSet) {
      sub()
    }
  },
}

const checkMobile = () => {
  const isMobile = window.innerWidth < 768
  deviceStore.set(isMobile)
}

// 仅在客户端执行
if (typeof window !== 'undefined') {
  checkMobile()
  window.addEventListener('resize', checkMobile)
}
